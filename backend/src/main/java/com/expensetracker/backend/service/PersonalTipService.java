package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.PersonalTipDtos.PersonalTip;
import com.expensetracker.backend.dto.SpendingProfileDtos.*;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.UserRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Tailored savings tips.
 * 1) SpendingProfileService computes the facts (no AI).
 * 2) Gemini picks what matters most for this person and explains it.
 * 3) This class checks Gemini's answer against the facts before anything is shown.
 */
@Service
public class PersonalTipService {

    // Same model name as SavingsInsightService
    private static final String GEMINI_MODEL = "gemini-3.5-flash-lite";

    // Tips are never allowed to target these
    private static final Set<String> NOT_TIP_TARGETS =
            Set.of("Other/People", "Withdrawal", "Income", "Uncategorized");

    private static final Pattern NUMBER = Pattern.compile("\\d[\\d,]*(?:\\.\\d+)?");

    // A code-style word such as changeVsUsualPercent or usualMonthly (starts with 2+ lowercase letters,
    // then a capital). Brand names like iPhone or eBay do not match.
    private static final Pattern FIELD_NAME = Pattern.compile("\\b[a-z]{2,}[A-Z][a-z]+[A-Za-z]*\\b");

    // Used to tidy numbers: ₹3,282.0 -> ₹3,282 and 36.02% -> 36%
    private static final Pattern RUPEE_DECIMAL = Pattern.compile("₹\\s?(\\d[\\d,]*)\\.(\\d+)");
    private static final Pattern PERCENT_DECIMAL = Pattern.compile("(\\d+)\\.(\\d+)%");

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    @Autowired
    private SpendingProfileService spendingProfileService;

    @Autowired
    private AiCacheService aiCacheService;

    @Autowired
    private UserRepository userRepository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    /* ---------- public methods ---------- */

    // Only looks in the saved tips. Never calls Gemini. Empty list means nothing saved for the current numbers.
    public List<PersonalTip> getCached(String username, String month) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return new ArrayList<>();

        SpendingProfile profile = spendingProfileService.build(username, month);
        if (profile.month() == null) return new ArrayList<>();

        String inputHash = AiCacheService.hash(fingerprint(profile));
        return aiCacheService.get(user, cacheKey(profile), inputHash, new TypeReference<List<PersonalTip>>() {})
                .orElse(new ArrayList<>());
    }

    // Saved tips if the numbers have not changed, otherwise a fresh Gemini call
    public List<PersonalTip> getTips(String username, String month) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) return new ArrayList<>();

        SpendingProfile profile = spendingProfileService.build(username, month);
        if (profile.month() == null || profile.categories().isEmpty()) return new ArrayList<>();

        String key = cacheKey(profile);
        String inputHash = AiCacheService.hash(fingerprint(profile));

        var cached = aiCacheService.get(user, key, inputHash, new TypeReference<List<PersonalTip>>() {});
        if (cached.isPresent()) {
            System.out.println("Personal tips for " + key + " served from cache (no Gemini call)");
            return cached.get();
        }

        List<PersonalTip> tips = generate(profile);

        // Only save a decent result; a failure returns an empty or tiny list
        if (tips.size() >= 2) {
            aiCacheService.put(user, key, inputHash, tips);
        }
        return tips;
    }

    /* ---------- generation ---------- */

    private List<PersonalTip> generate(SpendingProfile profile) {
        List<PersonalTip> best = new ArrayList<>();

        for (int attempt = 1; attempt <= 2; attempt++) {
            try {
                String raw = callGemini(buildPrompt(profile));
                List<PersonalTip> valid = validate(parseTips(raw), profile);
                System.out.println("Personal tips attempt " + attempt + ": " + valid.size() + " tips passed the checks");

                if (valid.size() > best.size()) best = valid;
                if (best.size() >= 2) break;
            } catch (Exception e) {
                System.err.println("Personal tips attempt " + attempt + " failed: " + e.getMessage());
                pause(1500);
            }
        }
        return best;
    }

    private String callGemini(String prompt) throws Exception {
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "contents", List.of(Map.of("parts", List.of(Map.of("text", prompt)))),
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.4
                )
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/"
                        + GEMINI_MODEL + ":generateContent?key=" + geminiApiKey))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API call failed: " + response.statusCode() + " - " + response.body());
        }
        return response.body();
    }

    private String buildPrompt(SpendingProfile profile) throws Exception {
        String instructions = """
        You are a personal finance coach for a student in India. Using ONLY the spending profile below, write exactly 3 tailored savings tips as a JSON array.

        Each element must be an object with these fields:
        - "category": one category name copied exactly from the profile's categories list
        - "headline": a short title, at most 8 words
        - "evidence": one sentence that explains, in plain English, why this tip matters, using specific numbers from the profile
        - "action": one concrete, practical step the user can take this month (at most 2 sentences)
        - "monthlySaving": a realistic number of rupees the user could save per month by following the action
        - "goalImpact": one short sentence linking the saving to one of the user's goals, using the exact goal name, or null if no goal is active

        RULES:
        1. Output ONLY the raw JSON array. No Markdown, no code fences, no extra text.
        2. Every number in "evidence" and "goalImpact" must be copied exactly from the profile. Do not do arithmetic and do not invent figures.
        3. Never target a category marked "fixed": true, and never target "Other/People" or "Withdrawal". Never tell the user to cancel rent, utilities or hostel/mess fees.
        4. Prefer categories that are over budget, far above their usual, or driven by repeated purchases at one merchant (see habits).
        5. Each tip must use a different category.
        6. "monthlySaving" must be less than 60 percent of that category's "spent" amount.
        7. If a goal has status ACTIVE, at least one tip should help fund it. Do not mention goals with status ACHIEVED.
        8. Plain, friendly English. Do not guess why the user spent what they spent.
        9. Write money as whole rupees like ₹1,500 (no decimals) and percentages as whole numbers like 36%.
        10. NEVER write the profile's field names in your sentences. Words like changeVsUsualPercent, usualMonthly, percentOfSpend, averageTicket, overBy, percentUsed or any word written in camelCase must not appear. Say it the way a person would, for example "36% above your usual" or "₹1,555 over your budget".
        11. Write "evidence" like a sentence a friend would say, for example: "You spent ₹8,455 on Groceries this month, 36% more than usual and ₹1,555 over your budget."

        SPENDING PROFILE (JSON):
        """;

        return instructions + objectMapper.writeValueAsString(profile);
    }

    private List<PersonalTip> parseTips(String rawResponse) throws Exception {
        JsonNode root = objectMapper.readTree(rawResponse);

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new RuntimeException("Gemini response had no candidates: " + rawResponse);
        }

        String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
        text = text.replaceAll("(?i)```json", "").replaceAll("```", "").trim();

        JsonNode array = objectMapper.readTree(text);
        List<PersonalTip> tips = new ArrayList<>();
        if (array.isArray()) {
            for (JsonNode n : array) {
                tips.add(new PersonalTip(
                        n.path("category").asText("").trim(),
                        n.path("headline").asText("").trim(),
                        n.path("evidence").asText("").trim(),
                        n.path("action").asText("").trim(),
                        n.path("monthlySaving").asDouble(0),
                        n.hasNonNull("goalImpact") ? n.get("goalImpact").asText().trim() : null
                ));
            }
        }
        return tips;
    }

    /* ---------- the checks: nothing reaches the user without passing these ---------- */

    private List<PersonalTip> validate(List<PersonalTip> tips, SpendingProfile profile) {
        Map<String, CategoryStat> byCategory = profile.categories().stream()
                .collect(Collectors.toMap(CategoryStat::category, c -> c, (a, b) -> a));
        List<Double> allowed = allowedNumbers(profile);
        Set<String> usedCategories = new HashSet<>();
        List<PersonalTip> valid = new ArrayList<>();

        for (PersonalTip tip : tips) {
            CategoryStat category = byCategory.get(tip.category());

            if (category == null || category.fixed() || NOT_TIP_TARGETS.contains(tip.category())) {
                reject(tip, "category is missing, fixed or not allowed");
                continue;
            }
            if (usedCategories.contains(tip.category())) {
                reject(tip, "category already used");
                continue;
            }
            if (tip.headline().isBlank() || tip.evidence().isBlank() || tip.action().isBlank()
                    || tip.headline().length() > 80 || tip.evidence().length() > 300 || tip.action().length() > 350) {
                reject(tip, "text is empty or too long");
                continue;
            }
            if (tip.monthlySaving() <= 0 || tip.monthlySaving() > category.spent() * 0.6) {
                reject(tip, "saving is not realistic for this category");
                continue;
            }
            if (containsFieldName(tip.headline()) || containsFieldName(tip.evidence())
                    || containsFieldName(tip.action()) || containsFieldName(tip.goalImpact())) {
                reject(tip, "text contains a raw field name");
                continue;
            }
            if (!numbersAreGrounded(tip.evidence(), allowed)
                    || !numbersAreGrounded(tip.goalImpact(), allowed)) {
                reject(tip, "a rupee figure is not from the profile");
                continue;
            }

            // A goal line is kept only if it names a real goal
            String goalImpact = tip.goalImpact();
            if (goalImpact != null && !mentionsRealGoal(goalImpact, profile)) {
                goalImpact = null;
            }
            if (goalImpact != null && goalImpact.isBlank()) {
                goalImpact = null;
            }

            double rounded = Math.round(tip.monthlySaving() / 10.0) * 10.0;
            usedCategories.add(tip.category());
            valid.add(new PersonalTip(
                    tip.category(),
                    tidy(tip.headline()),
                    tidy(tip.evidence()),
                    tidy(tip.action()),
                    rounded,
                    tidy(goalImpact)));
        }
        return valid;
    }

    private void reject(PersonalTip tip, String reason) {
        System.out.println("Rejected tip for \"" + tip.category() + "\": " + reason);
    }

    private boolean containsFieldName(String text) {
        return text != null && FIELD_NAME.matcher(text).find();
    }

    // Turns ₹3,282.0 into ₹3,282 and 36.02% into 36% so the text reads like a person wrote it
    private String tidy(String text) {
        if (text == null) return null;

        Matcher money = RUPEE_DECIMAL.matcher(text);
        StringBuilder sb = new StringBuilder();
        while (money.find()) {
            double value = Double.parseDouble((money.group(1) + "." + money.group(2)).replace(",", ""));
            String whole = String.format(Locale.US, "₹%,d", Math.round(value));
            money.appendReplacement(sb, Matcher.quoteReplacement(whole));
        }
        money.appendTail(sb);

        Matcher percent = PERCENT_DECIMAL.matcher(sb.toString());
        StringBuilder out = new StringBuilder();
        while (percent.find()) {
            double value = Double.parseDouble(percent.group(1) + "." + percent.group(2));
            percent.appendReplacement(out, Matcher.quoteReplacement(Math.round(value) + "%"));
        }
        percent.appendTail(out);

        return out.toString();
    }

    // Every rupee-sized number (100 or more) in the text must exist in the profile.
    // Small numbers (counts, days) are ignored, they are too easy to write in different ways.
    private boolean numbersAreGrounded(String text, List<Double> allowed) {
        if (text == null) return true;

        Matcher matcher = NUMBER.matcher(text);
        while (matcher.find()) {
            double value;
            try {
                value = Double.parseDouble(matcher.group().replace(",", ""));
            } catch (NumberFormatException e) {
                continue;
            }
            if (value < 100) continue;

            boolean found = false;
            for (double a : allowed) {
                if (Math.abs(a - value) <= Math.max(1.0, a * 0.01)) {
                    found = true;
                    break;
                }
            }
            if (!found) return false;
        }
        return true;
    }

    private boolean mentionsRealGoal(String text, SpendingProfile profile) {
        String lower = text.toLowerCase();
        return profile.goals().stream()
                .anyMatch(g -> g.name() != null && lower.contains(g.name().toLowerCase()));
    }

    // Every figure in the profile, so quoted numbers can be checked against it
    private List<Double> allowedNumbers(SpendingProfile p) {
        List<Double> n = new ArrayList<>();

        n.add(p.totalSpent());
        n.add(p.totalIncome());
        n.add(p.goalsNeededPerMonth());
        if (p.typicalMonthlySavings() != null) n.add(Math.abs(p.typicalMonthlySavings()));
        n.add(p.weekendSplit().weekendSpent());
        n.add(p.weekendSplit().weekdaySpent());
        n.add(p.weekendSplit().weekendSharePercent());

        // The month's year, in case a sentence mentions it
        try {
            n.add((double) YearMonth.parse(p.month()).getYear());
        } catch (Exception ignored) {
            // not a valid month text: nothing to add
        }

        for (CategoryStat c : p.categories()) {
            n.add(c.spent());
            n.add(c.percentOfSpend());
            if (c.usualMonthly() != null) {
                n.add(c.usualMonthly());
                n.add(Math.abs(c.spent() - c.usualMonthly()));
            }
            if (c.changeVsUsualPercent() != null) n.add(Math.abs(c.changeVsUsualPercent()));
        }
        for (MerchantHabit h : p.habits()) {
            n.add((double) h.count());
            n.add(h.total());
            n.add(h.averageTicket());
            n.add((double) h.weekendCount());
        }
        for (RecurringBill r : p.recurringBills()) {
            n.add(r.typicalAmount());
            n.add((double) r.monthsSeen());
        }
        for (GoalStatus g : p.goals()) {
            n.add(g.targetAmount());
            n.add(g.savedAmount());
            n.add(g.remaining());
            n.add((double) g.daysLeft());
            n.add(g.monthlyNeeded());
        }
        for (BudgetStatus b : p.budgets()) {
            n.add(b.limit());
            n.add(b.spent());
            n.add(b.percentUsed());
            n.add(b.overBy());
        }
        return n;
    }

    /* ---------- cache helpers ---------- */

    // PTIPS2 (not PTIPS) on purpose: tips saved earlier contain raw field names,
    // so the new key makes them ignored and fresh ones get generated.
    private String cacheKey(SpendingProfile profile) {
        return "PTIPS2:" + profile.month();
    }

    // What the saved tips depend on. Days left on a goal is left out on purpose,
    // otherwise the saved tips would be thrown away every single day.
    private String fingerprint(SpendingProfile p) {
        String goals = p.goals().stream()
                .map(g -> g.name() + ":" + g.remaining() + ":" + g.targetDate())
                .collect(Collectors.joining("|"));

        return p.month() + "|" + p.totalSpent() + "|" + p.totalIncome() + "|"
                + p.categories() + "|" + p.habits() + "|" + p.recurringBills() + "|"
                + p.budgets() + "|" + goals;
    }

    private void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}