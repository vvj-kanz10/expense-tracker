package com.expensetracker.backend.dto;

import java.time.LocalDate;
import java.util.List;

public final class AssistantDtos {

    private AssistantDtos() {}

    // Body of POST /api/assistant/ask
    public record AskRequest(String question) {}

    // One line of a table-style answer (a date and shop with an amount, a category with its share, ...)
    public record Row(String label, String value) {}

    public record AskResponse(String answer, String intent, List<Row> rows) {}

    // The only kinds of question the assistant will answer
    public enum Intent {
        TOTAL_SPENT, TOTAL_INCOME, COMPARE_SPENT, BIGGEST_EXPENSES, TOP_CATEGORIES, UNSUPPORTED
    }

    // What Gemini's JSON turns into after it has been checked
    public record ParsedQuestion(
            Intent intent,
            String category,            // one of our categories, or null
            String merchant,            // shop or person to look for, or null
            LocalDate start,            // null = all time
            LocalDate end,
            LocalDate compareStart,     // only for COMPARE_SPENT
            LocalDate compareEnd,
            int limit                   // 1..10, for the "top N" questions
    ) {}
}