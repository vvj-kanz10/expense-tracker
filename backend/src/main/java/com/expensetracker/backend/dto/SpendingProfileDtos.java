package com.expensetracker.backend.dto;

import java.util.List;

public class SpendingProfileDtos {

    // One category's spending in the chosen month, compared with the user's usual
    public record CategoryStat(
            String category,
            double spent,
            double percentOfSpend,
            Double usualMonthly,          // average over the user's other months (null if there are none)
            Double changeVsUsualPercent,  // null when there is no usual to compare with
            boolean fixed                 // rent and bills: hard to cut, so tips should not target them
    ) {}

    // How often the user pays one merchant in the month
    public record MerchantHabit(
            String merchant,
            String category,
            int count,
            double total,
            double averageTicket,
            int weekendCount
    ) {}

    public record WeekendSplit(
            double weekendSpent,
            double weekdaySpent,
            double weekendSharePercent
    ) {}

    // A bill that shows up in several months for about the same amount
    public record RecurringBill(
            String merchant,
            String category,
            double typicalAmount,
            int monthsSeen
    ) {}

    public record GoalStatus(
            String name,
            double targetAmount,
            double savedAmount,
            double remaining,
            String targetDate,
            long daysLeft,
            double monthlyNeeded,
            String status                 // ACHIEVED, OVERDUE or ACTIVE
    ) {}

    public record BudgetStatus(
            String category,              // "Overall" for the overall monthly limit
            double limit,
            double spent,
            double percentUsed,
            double overBy
    ) {}

    public record SpendingProfile(
            String month,                 // e.g. 2026-09
            double totalSpent,
            double totalIncome,
            Double typicalMonthlySavings, // median of income minus spending over up to 3 earlier months
            WeekendSplit weekendSplit,
            List<CategoryStat> categories,
            List<MerchantHabit> habits,
            List<RecurringBill> recurringBills,
            List<GoalStatus> goals,
            double goalsNeededPerMonth,   // what all active goals together need each month
            List<BudgetStatus> budgets
    ) {}
}