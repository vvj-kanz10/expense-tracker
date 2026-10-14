package com.expensetracker.backend.dto;

import java.math.BigDecimal;

public record BudgetSuggestion(
        String category,            // null = the overall monthly budget
        BigDecimal monthlyAverage,
        BigDecimal suggestedLimit,
        BigDecimal currentLimit     // null if the user has no limit set yet
) {
}