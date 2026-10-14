package com.expensetracker.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class SavingsGoalDtos {

    private SavingsGoalDtos() {}

    // Body of POST /api/goals
    public record GoalRequest(
            String name,
            BigDecimal targetAmount,
            LocalDate targetDate,
            BigDecimal savedAmount      // optional, defaults to 0
    ) {}

    // Body of POST /api/goals/{id}/contribute and /api/goals/{id}/withdraw
    public record ContributionRequest(BigDecimal amount) {}

    public record GoalProgress(
            Long id,
            String name,
            BigDecimal targetAmount,
            BigDecimal savedAmount,
            LocalDate targetDate,
            BigDecimal remaining,
            BigDecimal progressPercent,
            int daysLeft,
            int monthsLeft,
            BigDecimal requiredPerMonth,    // for goals due within 30 days this is the whole remaining amount
            BigDecimal shortfallPerMonth,   // how much more per month is needed (0 if on track)
            String status                   // ACHIEVED, ON_TRACK, BEHIND or OVERDUE
    ) {}

    public record CategoryAverage(String category, BigDecimal monthlyAverage) {}

    // One month of the statements: what came in, what went out, and the difference
    public record MonthlyNet(
            String month,           // "2026-07"
            BigDecimal income,
            BigDecimal expenses,
            BigDecimal net
    ) {}

    public record Overview(
            BigDecimal typicalMonthlySavings,
            List<String> monthsUsed,
            List<CategoryAverage> topSpendingCategories,
            List<GoalProgress> goals,
            BigDecimal totalRequiredPerMonth,        // all active goals together
            BigDecimal combinedShortfallPerMonth,    // how much more than typical savings they need (0 if covered)
            List<MonthlyNet> monthlyBreakdown        // the months behind the typical savings figure
    ) {}
}