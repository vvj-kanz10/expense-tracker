package com.expensetracker.backend.dto;

import java.util.List;

public record BudgetSuggestionResponse(
        List<String> monthsUsed,
        List<BudgetSuggestion> suggestions
) {
}