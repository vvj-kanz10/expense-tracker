package com.expensetracker.backend.statement;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

@Service
public class SavingsInsightService {

    @Value("${gemini.api.key}")
    private String geminiApiKey;

    // Connect timeout only — no request timeout, since we don't want to kill
    // a slow-but-working response (same reasoning as GeminiCategorizationService).
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final int MAX_ATTEMPTS = 3;
    private static final long INITIAL_BACKOFF_MS = 1000; // 1s, then 2s

    public List<String> getSavingsSuggestions(Map<String, Object> stats) {
        String prompt = buildPrompt(stats);

        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                String rawResponse = callGemini(prompt);
                return parseSuggestions(rawResponse);
            } catch (Exception e) {
                lastError = e;
                System.err.println("Savings insight attempt " + attempt + "/" + MAX_ATTEMPTS + " failed: " + e);
                if (attempt < MAX_ATTEMPTS) {
                    long backoff = INITIAL_BACKOFF_MS * (1L << (attempt - 1)); // 1s, 2s
                    try {
                        Thread.sleep(backoff);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        }

        System.err.println("Savings insights failed after " + MAX_ATTEMPTS + " attempts: "
                + (lastError != null ? lastError.getMessage() : "unknown error"));
        // Don't crash the request — fall back to empty list, frontend can show
        // "insights temporarily unavailable" instead of a 500 error.
        return new ArrayList<>();
    }

    private String callGemini(String prompt) throws Exception {
        String requestBody = objectMapper.writeValueAsString(Map.of(
                "contents", List.of(Map.of(
                        "parts", List.of(Map.of("text", prompt))
                ))
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=" + geminiApiKey))
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
        return """
            You are a personal finance assistant generating spending insights for a user.

            TASK:
            Analyze the provided spending summary data and generate EXACTLY 3 short, data-driven savings insights.

            RULES:
            1. FORMAT: Output MUST be a valid raw JSON array containing exactly 3 string elements. No Markdown formatting, code fences, or intro/outro text.
            2. STRUCTURE: Each insight must be EXACTLY ONE conversational sentence.
            3. DATA-GROUNDED: Every insight must cite EXACTLY ONE specific metric (an absolute amount OR a percentage) from the data.
            4. ACTIONABLE METHOD: Provide a concrete, practical habit or strategy (e.g., meal prepping, cooling-off periods, subscription audits, price comparison).
               - DO NOT simply restate a spending number as a target/budget cap (e.g., "Limit spending to ₹X").
               - DO NOT suggest cutting essentials (rent, utilities, medical).
            5. DIVERSITY: Each of the 3 insights must focus on a DIFFERENT category or metric.

            EXAMPLES:
            - BAD: ["Your food spending hit ₹8,500, so try to cap it at ₹5,000 next month."] (Reason: Restates data as a budget limit without a practical method)
            - GOOD: ["Your grocery spend jump 72%% this month—try bringing a strict checklist on your next trip to curb extra items."] (Reason: Uses 1 metric + actionable strategy)

            SPENDING DATA:
            %s
            """.formatted(stats.toString());
    }

    private List<String> parseSuggestions(String rawResponse) throws Exception {
        JsonNode root = objectMapper.readTree(rawResponse);

        JsonNode candidates = root.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) {
            throw new RuntimeException("Gemini response had no candidates: " + rawResponse);
        }

        String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
        text = text.replaceAll("```json", "").replaceAll("```", "").trim();

        JsonNode arrayNode = objectMapper.readTree(text);
        List<String> suggestions = new ArrayList<>();
        arrayNode.forEach(node -> suggestions.add(node.asText()));
        return suggestions;
    }
}