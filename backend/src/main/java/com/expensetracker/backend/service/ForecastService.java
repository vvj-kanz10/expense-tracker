package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.ForecastDtos.BudgetOutlook;
import com.expensetracker.backend.dto.ForecastDtos.Forecast;
import com.expensetracker.backend.model.BudgetLimit;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.BudgetLimitRepository;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

@Service
public class ForecastService {

    // Rent and bills are paid once, so they are not scaled up by the daily average
    private static final Set<String> FIXED = Set.of("Rent/Housing", "Bills & Utilities");
    private static final int MIN_DAYS = 5;
    private static final int MONTHS_TO_USE = 3;
    // Projected spending at or above this share of a limit counts as "close"
    private static final BigDecimal CLOSE_SHARE = new BigDecimal("0.90");

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private BudgetLimitRepository budgetLimitRepository;

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String rupees(BigDecimal amount) {
        return "\u20B9" + amount.setScale(0, RoundingMode.HALF_UP).toPlainString();
    }

    private String categoryOf(Transaction t) {
        return (t.getCategory() == null || t.getCategory().isBlank()) ? "Uncategorized" : t.getCategory();
    }

    // monthText like "2026-10" (blank = latest month in the data).
    // asOfParam is optional and mainly for testing: pretend the statement ends on that date.
    public Forecast getForecast(String username, String monthText, LocalDate asOfParam) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Transaction> all = new ArrayList<>();
        for (Transaction t : transactionRepository.findByUserId(user.getId())) {
            if (t.getTransactionDate() != null && t.getAmount() != null && t.getType() != null) {
                all.add(t);
            }
        }

        TreeSet<YearMonth> months = new TreeSet<>(Comparator.reverseOrder()); // latest first
        for (Transaction t : all) {
            months.add(YearMonth.from(t.getTransactionDate()));
        }

        if (months.isEmpty()) {
            return empty(null, null, 0, 0, "NO_DATA", "Upload a statement first to see a forecast.");
        }

        YearMonth month;
        if (monthText == null || monthText.isBlank()) {
            month = months.first();
        } else {
            try {
                month = YearMonth.parse(monthText.trim());
            } catch (DateTimeParseException e) {
                throw new RuntimeException("Month must look like 2026-10.");
            }
            if (!months.contains(month)) {
                throw new RuntimeException("No transactions found for " + month + ".");
            }
        }

        int daysInMonth = month.lengthOfMonth();
        LocalDate monthEnd = month.atEndOfMonth();

        // The last date this month's statements reach
        LocalDate lastDate = all.stream()
                .map(Transaction::getTransactionDate)
                .filter(d -> YearMonth.from(d).equals(month))
                .max(Comparator.naturalOrder())
                .orElse(month.atDay(1));

        LocalDate asOf = lastDate;
        if (asOfParam != null) {
            if (!YearMonth.from(asOfParam).equals(month)) {
                throw new RuntimeException("asOf must be a date inside " + month + ".");
            }
            asOf = asOfParam;
        }

        // What happened in this month up to asOf
        BigDecimal incomeSoFar = BigDecimal.ZERO;
        BigDecimal expenseSoFar = BigDecimal.ZERO;
        BigDecimal fixedSoFar = BigDecimal.ZERO;
        Map<String, BigDecimal> categorySoFar = new HashMap<>();

        for (Transaction t : all) {
            if (!YearMonth.from(t.getTransactionDate()).equals(month)) continue;
            if (t.getTransactionDate().isAfter(asOf)) continue;

            if ("INCOME".equals(t.getType())) {
                incomeSoFar = incomeSoFar.add(t.getAmount());
            } else if ("EXPENSE".equals(t.getType())) {
                expenseSoFar = expenseSoFar.add(t.getAmount());
                String category = categoryOf(t);
                categorySoFar.merge(category, t.getAmount(), BigDecimal::add);
                if (FIXED.contains(category)) {
                    fixedSoFar = fixedSoFar.add(t.getAmount());
                }
            }
        }

        // Baselines from the (up to 3) months before this one
        List<YearMonth> earlier = months.stream().filter(m -> m.isBefore(month)).limit(MONTHS_TO_USE).toList();
        BigDecimal avgExpense = BigDecimal.ZERO;
        BigDecimal avgIncome = BigDecimal.ZERO;
        BigDecimal avgFixed = BigDecimal.ZERO;
        Map<String, BigDecimal> categoryEarlierAvg = new HashMap<>();

        if (!earlier.isEmpty()) {
            BigDecimal sumExpense = BigDecimal.ZERO;
            BigDecimal sumIncome = BigDecimal.ZERO;
            BigDecimal sumFixed = BigDecimal.ZERO;
            Map<String, BigDecimal> categoryEarlierSum = new HashMap<>();

            for (Transaction t : all) {
                if (!earlier.contains(YearMonth.from(t.getTransactionDate()))) continue;
                if ("INCOME".equals(t.getType())) {
                    sumIncome = sumIncome.add(t.getAmount());
                } else if ("EXPENSE".equals(t.getType())) {
                    sumExpense = sumExpense.add(t.getAmount());
                    String category = categoryOf(t);
                    categoryEarlierSum.merge(category, t.getAmount(), BigDecimal::add);
                    if (FIXED.contains(category)) {
                        sumFixed = sumFixed.add(t.getAmount());
                    }
                }
            }

            BigDecimal count = BigDecimal.valueOf(earlier.size());
            avgExpense = sumExpense.divide(count, 2, RoundingMode.HALF_UP);
            avgIncome = sumIncome.divide(count, 2, RoundingMode.HALF_UP);
            avgFixed = sumFixed.divide(count, 2, RoundingMode.HALF_UP);
            for (Map.Entry<String, BigDecimal> entry : categoryEarlierSum.entrySet()) {
                categoryEarlierAvg.put(entry.getKey(), entry.getValue().divide(count, 2, RoundingMode.HALF_UP));
            }
        }

        int daysElapsed = asOf.getDayOfMonth();

        // A finished month: nothing left to forecast, just report what happened
        boolean complete = !asOf.isBefore(monthEnd)
                || (asOfParam == null && month.isBefore(YearMonth.now()));
        if (complete) {
            return new Forecast(month.toString(), asOf, daysInMonth, daysInMonth, "COMPLETE",
                    "The statements cover all of " + month + ", so this is what actually happened. "
                            + "Upload a statement for a month that is still running to get a forecast.",
                    money(expenseSoFar), money(expenseSoFar), BigDecimal.ZERO, BigDecimal.ZERO,
                    money(avgExpense), money(incomeSoFar), money(incomeSoFar.subtract(expenseSoFar)),
                    List.of());
        }

        if (daysElapsed < MIN_DAYS) {
            return new Forecast(month.toString(), asOf, daysElapsed, daysInMonth, "TOO_EARLY",
                    "Only " + daysElapsed + " day(s) of " + month + " are covered. A forecast needs at least "
                            + MIN_DAYS + " days of data.",
                    money(expenseSoFar), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    money(avgExpense), BigDecimal.ZERO, BigDecimal.ZERO, List.of());
        }

        // Variable spending = what is already spent minus fixed bills + remaining days at a blended pace.
        BigDecimal variableSoFar = expenseSoFar.subtract(fixedSoFar).max(BigDecimal.ZERO);
        BigDecimal currentDaily = variableSoFar.divide(BigDecimal.valueOf(daysElapsed), 4, RoundingMode.HALF_UP);
        BigDecimal remainingDays = BigDecimal.valueOf(daysInMonth - daysElapsed);

        BigDecimal dailyPace = currentDaily;
        if (!earlier.isEmpty()) {
            BigDecimal usualDaily = avgExpense.subtract(avgFixed).max(BigDecimal.ZERO)
                    .divide(BigDecimal.valueOf(daysInMonth), 4, RoundingMode.HALF_UP);
            BigDecimal weight = BigDecimal.valueOf(daysElapsed)
                    .divide(BigDecimal.valueOf(daysInMonth), 4, RoundingMode.HALF_UP);
            dailyPace = currentDaily.multiply(weight)
                    .add(usualDaily.multiply(BigDecimal.ONE.subtract(weight)));
        }

        BigDecimal projectedVariable = variableSoFar
                .add(dailyPace.multiply(remainingDays))
                .setScale(0, RoundingMode.HALF_UP);

        // FIXED BILLS FIX:
        // Calculate remaining unposted fixed bills (difference between historical average and what's already paid).
        // If everything is already paid (fixedSoFar >= avgFixed), remaining fixed is 0.
        BigDecimal remainingFixed = avgFixed.subtract(fixedSoFar).max(BigDecimal.ZERO);
        BigDecimal expectedFixed = fixedSoFar.add(remainingFixed).setScale(0, RoundingMode.HALF_UP);

        // Projected total spending combines already spent expenses, projected future variable,
        // and any remaining unposted fixed bills without double-counting.
        BigDecimal projectedTotal = expenseSoFar
                .add(dailyPace.multiply(remainingDays))
                .add(remainingFixed)
                .setScale(0, RoundingMode.HALF_UP);

        // Income that has already arrived this month; the usual amount only if none has yet
        BigDecimal expectedIncome = incomeSoFar.signum() > 0 ? incomeSoFar : avgIncome;

        List<BudgetOutlook> budgets = buildOutlooks(user, expenseSoFar, projectedTotal,
                categorySoFar, categoryEarlierAvg, daysElapsed, daysInMonth);

        return new Forecast(month.toString(), asOf, daysElapsed, daysInMonth, "PROJECTED", null,
                money(expenseSoFar), money(projectedTotal), money(projectedVariable), money(expectedFixed),
                money(avgExpense), money(expectedIncome), money(expectedIncome.subtract(projectedTotal)),
                budgets);
    }

    // For every saved budget limit: where is this month heading?
    private List<BudgetOutlook> buildOutlooks(User user, BigDecimal expenseSoFar, BigDecimal projectedTotal,
                                              Map<String, BigDecimal> categorySoFar,
                                              Map<String, BigDecimal> categoryEarlierAvg,
                                              int daysElapsed, int daysInMonth) {
        List<BudgetOutlook> outlooks = new ArrayList<>();
        int remainingDays = daysInMonth - daysElapsed;

        for (BudgetLimit limit : budgetLimitRepository.findByUser(user)) {
            if (limit.getLimitAmount() == null || limit.getLimitAmount().signum() <= 0) continue;

            String category = limit.getCategory();
            boolean overall = category == null || category.isBlank();

            BigDecimal spent;
            BigDecimal projected;
            if (overall) {
                spent = expenseSoFar;
                projected = projectedTotal;
            } else {
                spent = categorySoFar.getOrDefault(category, BigDecimal.ZERO);
                if (FIXED.contains(category)) {
                    // paid once: use what is paid, or the usual amount if it has not been paid yet
                    projected = spent.max(categoryEarlierAvg.getOrDefault(category, BigDecimal.ZERO));
                } else {
                    projected = spent
                            .divide(BigDecimal.valueOf(daysElapsed), 4, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(daysInMonth));
                }
            }

            BigDecimal limitAmount = limit.getLimitAmount().setScale(0, RoundingMode.HALF_UP);
            spent = spent.setScale(0, RoundingMode.HALF_UP);
            projected = projected.setScale(0, RoundingMode.HALF_UP);

            BigDecimal allowance = BigDecimal.ZERO;
            String status;
            String message;

            if (spent.compareTo(limitAmount) > 0) {
                status = "OVER";
                message = "Already " + rupees(spent.subtract(limitAmount)) + " over this limit.";
            } else {
                if (remainingDays > 0) {
                    allowance = limitAmount.subtract(spent)
                            .divide(BigDecimal.valueOf(remainingDays), 0, RoundingMode.DOWN);
                }
                if (projected.compareTo(limitAmount) > 0) {
                    status = "AT_RISK";
                    message = "On track to reach " + rupees(projected) + ", which is "
                            + rupees(projected.subtract(limitAmount)) + " over. About "
                            + rupees(allowance) + " a day keeps you within it.";
                } else if (projected.compareTo(limitAmount.multiply(CLOSE_SHARE)) >= 0) {
                    status = "CLOSE";
                    message = "On track to reach " + rupees(projected) + ", close to the limit.";
                } else {
                    status = "SAFE";
                    message = "On track to stay within this limit.";
                }
            }

            outlooks.add(new BudgetOutlook(overall ? "Overall" : category, limitAmount, spent, projected,
                    allowance, status, message));
        }

        // Most urgent first, and the overall limit ahead of category limits
        outlooks.sort(Comparator
                .comparingInt((BudgetOutlook o) -> rank(o.status()))
                .thenComparing(o -> !"Overall".equals(o.category())));
        return outlooks;
    }

    private int rank(String status) {
        return switch (status) {
            case "OVER" -> 0;
            case "AT_RISK" -> 1;
            case "CLOSE" -> 2;
            default -> 3;
        };
    }

    private Forecast empty(String month, LocalDate asOf, int daysElapsed, int daysInMonth,
                           String status, String message) {
        BigDecimal zero = money(BigDecimal.ZERO);
        return new Forecast(month, asOf, daysElapsed, daysInMonth, status, message,
                zero, zero, zero, zero, zero, zero, zero, List.of());
    }
}