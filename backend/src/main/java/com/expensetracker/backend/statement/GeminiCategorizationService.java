package com.expensetracker.backend.statement;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.URI;
import java.time.Duration;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.List;
import java.util.ArrayList;

@Service
public class GeminiCategorizationService {

    @Value("${gemini.api.key}")
    private String apiKey;

    // Connect timeout only — guards against a dead connection, but does NOT
    // limit how long we wait for Gemini to actually respond (large batches
    // of 50+ transactions can legitimately take a while).
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final String GEMINI_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";

    private static final int MAX_ATTEMPTS = 3;
    private static final long INITIAL_BACKOFF_MS = 1000; // 1s, then 2s

    public record CategorizationResult(String category, String merchant) {}

    public List<CategorizationResult> categorize(List<String> descriptions) {
        String prompt = buildPrompt(descriptions);

        Exception lastError = null;
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                String rawResponse = callGemini(prompt);
                return parseResults(rawResponse, descriptions.size());
            } catch (Exception e) {
                lastError = e;
                System.err.println("Gemini attempt " + attempt + "/" + MAX_ATTEMPTS + " failed: " + e);
                e.printStackTrace(); // TEMP: remove once we've confirmed the real cause
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

        throw new RuntimeException("Categorization failed after " + MAX_ATTEMPTS + " attempts: "
                + (lastError != null ? lastError.getMessage() : "unknown error"), lastError);
    }

    private String buildPrompt(List<String> descriptions) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("You are a financial transaction categorizer. ");
        prompt.append("For each transaction description below, do two things: ");
        prompt.append("1) Classify it into exactly one of these categories: ");
        prompt.append("Food & Dining, Groceries, Transport, Shopping, Bills & Utilities, Entertainment, ");
        prompt.append("Health & Fitness, Rent/Housing, Income, Other/People. ");
        prompt.append("2) Extract the merchant name - the actual business or person being paid, ");
        prompt.append("cleaned up from bank noise (e.g. 'POS DEBIT SWIGGY BANGALORE IN 4482' -> 'Swiggy'). ");
        prompt.append("If no clear merchant can be identified, use \"Unknown\". ");
        prompt.append("Respond with ONLY a JSON array of objects, in the same order as the transactions, ");
        prompt.append("with no other text. Each object must have \"category\" and \"merchant\" keys. ");
        prompt.append("Example: [{\"category\": \"Food & Dining\", \"merchant\": \"Swiggy\"}]\n\n");
        prompt.append("Transactions:\n");

        for (int i = 0; i < descriptions.size(); i++) {
            prompt.append((i + 1)).append(". ").append(descriptions.get(i)).append("\n");
        }

        return prompt.toString();
    }

    private String callGemini(String prompt) throws Exception {
        ObjectNode requestBody = objectMapper.createObjectNode();
        ArrayNode contents = requestBody.putArray("contents");
        ObjectNode contentItem = contents.addObject();
        ArrayNode parts = contentItem.putArray("parts");
        parts.addObject().put("text", prompt);

        String requestJson = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_URL + "?key=" + apiKey))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestJson))
                .build();
        // no .timeout() here on purpose — large batches shouldn't get killed
        // just for taking a while. connectTimeout on httpClient above still
        // guards against a connection that never establishes.

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API call failed: " + response.statusCode() + " - " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        return root.path("candidates").get(0)
                .path("content").path("parts").get(0)
                .path("text").asText();
    }

    private List<CategorizationResult> parseResults(String rawResponse, int expectedCount) throws Exception {
        // Gemini sometimes wraps its JSON in markdown code fences - strip those if present
        String cleaned = rawResponse.trim()
                .replaceAll("^```json", "")
                .replaceAll("^```", "")
                .replaceAll("```$", "")
                .trim();

        JsonNode arrayNode = objectMapper.readTree(cleaned);
        List<CategorizationResult> results = new ArrayList<>();
        for (JsonNode node : arrayNode) {
            String category = node.path("category").asText();
            String merchant = node.path("merchant").asText();
            results.add(new CategorizationResult(category, merchant));
        }

        if (results.size() != expectedCount) {
            throw new RuntimeException("Expected " + expectedCount + " results but got " + results.size());
        }

        return results;
    }

}