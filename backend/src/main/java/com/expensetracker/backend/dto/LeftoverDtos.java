package com.expensetracker.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public final class LeftoverDtos {

    private LeftoverDtos() {}

    // One suggested chunk of the leftover going to one goal
    public record Allocation(
            Long goalId,
            String goalName,
            BigDecimal amount,
            String reason
    ) {}

    public record LeftoverSplit(
            String month,                    // "2026-09"
            List<String> availableMonths,    // latest first, for the month picker
            BigDecimal income,
            BigDecimal expenses,
            BigDecimal leftover,             // income - expenses (can be negative)
            List<Allocation> allocations,
            BigDecimal freeToSpend,          // leftover not given to any goal
            String source,                   // "RULES" now, "AI" later
            String message                   // explains empty results, otherwise null
    ) {}
}