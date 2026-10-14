package com.expensetracker.backend.service;

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
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class SavingsInsightService {

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    @Autowired
    private AiCacheService aiCacheService;

    @Autowired
    private UserRepository userRepository;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Cached version: same numbers for the same month = same saved tips, no Gemini call.
    public List<String> getSavingsSuggestions(String username, Map<String, Object> stats) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return getSavingsSuggestions(stats);
        }

        String inputHash = AiCacheService.hash(stats.toString());
        String cacheKey = "TIPS:" + inputHash.substring(0, 16);

        Optional<List<String>> cached = aiCacheService.get(
                user, cacheKey, inputHash, new TypeReference<List<String>>() {});
        if (cached.isPresent()) {
            System.out.println("Savings tips for " + cacheKey + " served from cache (no Gemini call)");
            return cached.get();
        }

        List<String> tips = getSavingsSuggestions(stats);

        // Only a full set of 3 tips is worth saving; a failure returns an empty list
        if (tips.size() == 3) {
            aiCacheService.put(user, cacheKey, inputHash, tips);
        }
        return tips;
    }

    // Only looks in the saved tips. Never calls Gemini. Empty list means nothing saved yet.
    public List<String> getCachedSuggestions(String username, Map<String, Object> stats) {
        User user = userRepository.findByUsername(username).orElse(null);
        if (user == null) {
            return new ArrayList<>();
        }
        String inputHash = AiCacheService.hash(stats.toString());
        String cacheKey = "TIPS:" + inputHash.substring(0, 16);
        return aiCacheService.get(user, cacheKey, inputHash, new TypeReference<List<String>>() {})
                .orElse(new ArrayList<>());
    }

    public List<String> getSavingsSuggestions(Map<String, Object> stats) {
        String prompt = buildPrompt(stats);

        try {
            // Tries only once now — no hanging loops or sleeping threads
            String rawResponse = callGemini(prompt);
            return parseSuggestions(rawResponse);
        } catch (Exception e) {
            System.err.println("Savings insight failed: " + e.getMessage());
            return new ArrayList<>();
        }
    }

    private String callGemini(String prompt) throws Exception {
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                ))
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + geminiApiKey))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API call failed: " + response.statusCode() + " - " + response.body());
        }

        return response.body();
    }

    private String buildPrompt(Map<String, Object> stats) {
        String promptTemplate = """
        You are a friendly, down-to-earth personal finance buddy. Write 3 short, super conversational savings tips based on the user's spending data.

        RULES:
        1. FORMAT: Output MUST be a valid raw JSON array containing exactly 3 string elements. No Markdown, no code fences, or extra text.
        2. NO WEIRD PERCENTAGES: Do not use exaggerated or confusing percentages. If you mention a number, use clear rupee amounts (like ₹1,200) or talk about everyday habits simply without sounding like a math textbook.
        3. PLAIN, HUMAN LANGUAGE: Talk like a real friend giving casual advice. Avoid stiff corporate jargon like "scale back," "optimize," "tame," or "allocate." Use words like "try," "cut back a bit on," "swap," or "skip."
        4. PRACTICAL & SIMPLE ACTIONS: Suggest everyday fixes like:
        - Cooking at home or ordering delivery a bit less.
        - Making a shopping list before hitting the grocery store.
        - Checking for small recurring subscriptions you don't use.
        - Choosing local or budget-friendly options.
        5. DIVERSITY: Each tip must focus on a completely different spending category.
        6. FOCUS ON WHAT IS HIGHER THAN USUAL: If "spikes" lists categories, build the tips around those first, using the rupee amounts given. If there are no spikes, base the tips on the top category and the biggest transaction.

        SPENDING DATA:
        """;

        return promptTemplate + stats.toString();
    }

    private List<String> parseSuggestions(String rawResponse) throws Exception {
        JsonNode root = objectMapper.readTree(rawResponse);

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new RuntimeException("Gemini response had no candidates: " + rawResponse);
        }

        String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
        text = text.replaceAll("(?i)```json", "").replaceAll("```", "").trim();

        JsonNode arrayNode = objectMapper.readTree(text);
        List<String> suggestions = new ArrayList<>();
        if (arrayNode.isArray()) {
            arrayNode.forEach(node -> suggestions.add(node.asText()));
        }
        return suggestions;
    }
}