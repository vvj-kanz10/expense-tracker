package com.expensetracker.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ChargeDtos {

    private ChargeDtos() {}

    public record RecurringCharge(
            String name,
            String category,
            BigDecimal typicalAmount,
            int timesSeen,
            LocalDate lastDate,
            LocalDate nextExpected
    ) {}

    public record UnusualCharge(
            Long transactionId,
            LocalDate date,
            String merchant,
            String description,
            String category,
            BigDecimal amount,
            BigDecimal typicalAmount    // the usual size of a transaction in this category
    ) {}

    public record ChargeInsights(
            List<RecurringCharge> recurring,
            BigDecimal recurringMonthlyTotal,
            List<UnusualCharge> unusual
    ) {}
}