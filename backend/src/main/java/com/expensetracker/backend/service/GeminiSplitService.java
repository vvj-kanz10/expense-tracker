package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.SavingsGoalDtos.GoalProgress;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

@Service
public class GeminiSplitService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";
    private static final int MAX_ATTEMPTS = 2;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    // What Gemini suggests for one goal (not trusted until the backend validates it)
    public record Suggestion(Long goalId, BigDecimal amount, String reason) {}

    // Gemini only sees totals and goal details. It never sees any transaction.
    public List<Suggestion> suggest(String month, BigDecimal income, BigDecimal expenses,
                                    BigDecimal leftover, BigDecimal maxToAllocate,
                                    List<GoalProgress> goals) throws Exception {
        String prompt = buildPrompt(month, income, expenses, leftover, maxToAllocate, goals);

        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                return parse(callGemini(prompt));
            } catch (Exception e) {
                lastError = e;
                System.err.println("Gemini split attempt " + attempt + "/" + MAX_ATTEMPTS + " failed: " + e.getMessage());
                if (attempt < MAX_ATTEMPTS) {
                    Thread.sleep(1000);
                }
            }
        }
        throw lastError;
    }

    private String buildPrompt(String month, BigDecimal income, BigDecimal expenses,
                               BigDecimal leftover, BigDecimal maxToAllocate, List<GoalProgress> goals) {
        StringBuilder p = new StringBuilder();
        p.append("You help a student in India decide how to split the money left over in one month ");
        p.append("across their savings goals. All amounts are in rupees.\n\n");
        p.append("Month: ").append(month).append("\n");
        p.append("Income: ").append(income.toPlainString()).append("\n");
        p.append("Expenses: ").append(expenses.toPlainString()).append("\n");
        p.append("Leftover: ").append(leftover.toPlainString()).append("\n");
        p.append("Maximum you may give to goals in total: ").append(maxToAllocate.toPlainString()).append("\n\n");
        p.append("Goals:\n");
        for (GoalProgress g : goals) {
            p.append("- goalId ").append(g.id())
                    .append(", name: ").append(g.name().replaceAll("[\\r\\n]+", " "))
                    .append(", still needs ").append(g.remaining().toPlainString())
                    .append(", needs ").append(g.requiredPerMonth().toPlainString()).append(" a month")
                    .append(", ").append(g.daysLeft()).append(" days left")
                    .append(", status ").append(g.status()).append("\n");
        }
        p.append("\nRules:\n");
        p.append("1. Only use the goalIds listed above.\n");
        p.append("2. Each amount must be a whole number, and no more than what that goal still needs.\n");
        p.append("3. The amounts together must not go above the maximum.\n");
        p.append("4. Goals with status BEHIND and the nearest deadlines come first.\n");
        p.append("5. You do not have to fund every goal. Leaving money free to spend is fine.\n");
        p.append("6. Each reason is ONE plain sentence under 20 words. Use only numbers given above.\n");
        p.append("7. Respond with ONLY a JSON array and no other text, like: ");
        p.append("[{\"goalId\": 1, \"amount\": 5000, \"reason\": \"Due soon, so it gets the most.\"}]\n");
        return p.toString();
    }

    private String callGemini(String prompt) throws Exception {
        ObjectNode body = objectMapper.createObjectNode();
        ArrayNode contents = body.putArray("contents");
        ArrayNode parts = contents.addObject().putArray("parts");
        parts.addObject().put("text", prompt);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL + "?key=" + apiKey))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(15))
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini returned status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (text.isMissingNode() || text.asText().isBlank()) {
            throw new RuntimeException("Gemini returned no text");
        }
        return text.asText();
    }

    private List<Suggestion> parse(String raw) throws Exception {
        String cleaned = raw.trim()
                .replaceAll("^```json", "")
                .replaceAll("^```", "")
                .replaceAll("```$", "")
                .trim();

        JsonNode array = objectMapper.readTree(cleaned);
        if (!array.isArray()) {
            throw new RuntimeException("Gemini did not return a JSON array");
        }

        List<Suggestion> result = new ArrayList<>();
        for (JsonNode node : array) {
            result.add(new Suggestion(
                    node.path("goalId").asLong(),
                    new BigDecimal(node.path("amount").asText()),
                    node.path("reason").asText("")
            ));
        }
        return result;
    }
}