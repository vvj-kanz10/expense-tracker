package com.expensetracker.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class ForecastDtos {

    private ForecastDtos() {}

    // How one budget limit is likely to end the month
    public record BudgetOutlook(
            String category,            // "Overall" for the monthly limit
            BigDecimal limitAmount,
            BigDecimal spentSoFar,
            BigDecimal projected,       // where spending is expected to end up
            BigDecimal dailyAllowance,  // what you can spend per remaining day and still stay within the limit
            String status,              // SAFE, CLOSE, AT_RISK or OVER
            String message
    ) {}

    public record Forecast(
            String month,                 // "2026-10"
            LocalDate asOf,               // the last date the statements cover
            int daysElapsed,
            int daysInMonth,
            String status,                // PROJECTED, COMPLETE, TOO_EARLY or NO_DATA
            String message,               // explains non-PROJECTED results, otherwise null
            BigDecimal spentSoFar,
            BigDecimal projectedTotal,    // expected spending for the whole month
            BigDecimal projectedVariable, // the part that is projected from the daily average
            BigDecimal expectedFixed,     // rent and bills, counted at their usual amount
            BigDecimal typicalMonthlySpend, // average of earlier months (0 if there are none)
            BigDecimal expectedIncome,
            BigDecimal projectedLeftover, // expected income minus projected spending
            List<BudgetOutlook> budgets   // only filled in when status is PROJECTED
    ) {}
}