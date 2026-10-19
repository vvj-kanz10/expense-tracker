package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.SpendingProfileDtos.*;
import com.expensetracker.backend.model.BudgetLimit;
import com.expensetracker.backend.model.SavingsGoal;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.BudgetLimitRepository;
import com.expensetracker.backend.repository.SavingsGoalRepository;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Builds a "spending profile" for one user and one month: plain facts computed from the
 * database (no AI). This is what Gemini will be given later instead of five loose numbers,
 * so its tips can point at real habits, real goals and real budget overruns.
 */
@Service
public class SpendingProfileService {

    private static final Set<String> FIXED_CATEGORIES = Set.of("Rent/Housing", "Bills & Utilities");

    // Shops and cash are never "bills", so they are left out of recurring-bill detection
    private static final Set<String> NOT_BILL_CATEGORIES =
            Set.of("Shopping", "Groceries", "Withdrawal", "Other/People", "Income");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private SavingsGoalRepository savingsGoalRepository;

    @Autowired
    private BudgetLimitRepository budgetLimitRepository;

    // monthText looks like "2026-09". Null or blank means the latest month that has data.
    public SpendingProfile build(String username, String monthText) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<Transaction> all = transactionRepository.findByUserId(user.getId()).stream()
                .filter(t -> t.getTransactionDate() != null && t.getAmount() != null)
                .collect(Collectors.toList());

        TreeSet<YearMonth> allMonths = all.stream()
                .map(t -> YearMonth.from(t.getTransactionDate()))
                .collect(Collectors.toCollection(TreeSet::new));

        if (allMonths.isEmpty()) {
            return new SpendingProfile(null, 0, 0, null, new WeekendSplit(0, 0, 0),
                    List.of(), List.of(), List.of(), List.of(), 0, List.of());
        }

        YearMonth selected = (monthText == null || monthText.isBlank())
                ? allMonths.last()
                : YearMonth.parse(monthText.trim());

        List<YearMonth> otherMonths = allMonths.stream()
                .filter(m -> !m.equals(selected))
                .collect(Collectors.toList());

        List<Transaction> expenses = all.stream().filter(this::isExpense).collect(Collectors.toList());
        List<Transaction> selectedExpenses = expenses.stream()
                .filter(t -> YearMonth.from(t.getTransactionDate()).equals(selected))
                .collect(Collectors.toList());

        double totalSpent = sum(selectedExpenses);
        double totalIncome = all.stream()
                .filter(t -> "INCOME".equalsIgnoreCase(t.getType()))
                .filter(t -> YearMonth.from(t.getTransactionDate()).equals(selected))
                .mapToDouble(t -> t.getAmount().doubleValue())
                .sum();

        Map<String, Double> spentByCategory = sumByCategory(selectedExpenses);

        List<CategoryStat> categories = buildCategories(
                spentByCategory, expenses, otherMonths, totalSpent);

        List<MerchantHabit> habits = buildHabits(selectedExpenses);
        WeekendSplit weekendSplit = buildWeekendSplit(selectedExpenses);
        List<RecurringBill> recurring = buildRecurring(expenses);
        Double typicalSavings = buildTypicalSavings(all, otherMonths, selected);

        List<GoalStatus> goals = buildGoals(user);
        double goalsNeeded = round2(goals.stream()
                .filter(g -> "ACTIVE".equals(g.status()) || "OVERDUE".equals(g.status()))
                .mapToDouble(GoalStatus::monthlyNeeded)
                .sum());

        List<BudgetStatus> budgets = buildBudgets(user, totalSpent, spentByCategory);

        return new SpendingProfile(
                selected.toString(),
                round2(totalSpent),
                round2(totalIncome),
                typicalSavings,
                weekendSplit,
                categories,
                habits,
                recurring,
                goals,
                goalsNeeded,
                budgets
        );
    }

    /* ---------- categories ---------- */

    private List<CategoryStat> buildCategories(Map<String, Double> spentByCategory,
                                               List<Transaction> allExpenses,
                                               List<YearMonth> otherMonths,
                                               double totalSpent) {
        // Total spent in each category across the other months
        Map<String, Double> otherTotals = new HashMap<>();
        for (Transaction t : allExpenses) {
            if (!otherMonths.contains(YearMonth.from(t.getTransactionDate()))) continue;
            otherTotals.merge(categoryOf(t), t.getAmount().doubleValue(), Double::sum);
        }

        List<CategoryStat> result = new ArrayList<>();
        for (Map.Entry<String, Double> entry : spentByCategory.entrySet()) {
            String category = entry.getKey();
            double spent = entry.getValue();

            Double usual = null;
            Double change = null;
            if (!otherMonths.isEmpty()) {
                usual = round2(otherTotals.getOrDefault(category, 0.0) / otherMonths.size());
                if (usual > 0) {
                    change = round2((spent - usual) / usual * 100.0);
                }
            }

            double percentOfSpend = totalSpent > 0 ? round2(spent / totalSpent * 100.0) : 0;
            result.add(new CategoryStat(category, round2(spent), percentOfSpend, usual, change,
                    FIXED_CATEGORIES.contains(category)));
        }

        result.sort(Comparator.comparingDouble(CategoryStat::spent).reversed());
        return result;
    }

    /* ---------- habits ---------- */

    private List<MerchantHabit> buildHabits(List<Transaction> selectedExpenses) {
        Map<String, List<Transaction>> byMerchant = selectedExpenses.stream()
                .filter(this::hasRealMerchant)
                .filter(t -> !"Withdrawal".equals(t.getCategory()))
                .filter(t -> !"Other/People".equals(t.getCategory()))
                .collect(Collectors.groupingBy(t -> t.getMerchant().trim().toLowerCase()));

        List<MerchantHabit> habits = new ArrayList<>();
        for (List<Transaction> group : byMerchant.values()) {
            double total = sum(group);
            int weekend = (int) group.stream().filter(t -> isWeekend(t.getTransactionDate())).count();
            Transaction first = group.get(0);
            habits.add(new MerchantHabit(
                    first.getMerchant().trim(),
                    categoryOf(first),
                    group.size(),
                    round2(total),
                    round2(total / group.size()),
                    weekend
            ));
        }

        habits.sort(Comparator.comparingDouble(MerchantHabit::total).reversed());
        return habits.size() > 6 ? new ArrayList<>(habits.subList(0, 6)) : habits;
    }

    private WeekendSplit buildWeekendSplit(List<Transaction> selectedExpenses) {
        double weekend = 0;
        double weekday = 0;
        for (Transaction t : selectedExpenses) {
            double amount = t.getAmount().doubleValue();
            if (isWeekend(t.getTransactionDate())) weekend += amount;
            else weekday += amount;
        }
        double total = weekend + weekday;
        double share = total > 0 ? weekend / total * 100.0 : 0;
        return new WeekendSplit(round2(weekend), round2(weekday), round2(share));
    }

    /* ---------- recurring bills ---------- */

    // A merchant counts as a recurring bill when it appears in at least 2 months,
    // at most twice per month, with monthly totals within 20% of each other and over Rs 200.
    private List<RecurringBill> buildRecurring(List<Transaction> expenses) {
        // Group by merchant; when the merchant is "Unknown", group by the description instead
        // (this is how a bill like a monthly mess fee gets picked up)
        Map<String, List<Transaction>> byMerchant = expenses.stream()
                .filter(t -> !recurringKey(t).isEmpty())
                .collect(Collectors.groupingBy(this::recurringKey));

        List<RecurringBill> bills = new ArrayList<>();
        for (List<Transaction> group : byMerchant.values()) {
            // Judge the category of the whole group, so one wrongly categorised row
            // cannot split a real bill apart
            String category = dominantCategory(group);
            if (NOT_BILL_CATEGORIES.contains(category)) continue;

            Map<YearMonth, List<Transaction>> byMonth = group.stream()
                    .collect(Collectors.groupingBy(t -> YearMonth.from(t.getTransactionDate())));

            if (byMonth.size() < 2) continue;
            if (byMonth.values().stream().anyMatch(list -> list.size() > 2)) continue;

            List<Double> monthlyTotals = byMonth.values().stream()
                    .map(this::sum)
                    .collect(Collectors.toList());
            double min = Collections.min(monthlyTotals);
            double max = Collections.max(monthlyTotals);
            if (min <= 0 || max > min * 1.2) continue;

            double typical = monthlyTotals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            if (typical < 200) continue;

            Transaction first = group.get(0);
            bills.add(new RecurringBill(billName(first), category,
                    round2(typical), byMonth.size()));
        }

        bills.sort(Comparator.comparingDouble(RecurringBill::typicalAmount).reversed());
        return bills.size() > 8 ? new ArrayList<>(bills.subList(0, 8)) : bills;
    }

    /* ---------- savings baseline ---------- */

    // Median of (income - spending) over the selected month and up to 2 months before it.
    // Same idea as the baseline on the Goals card, so the two numbers agree for the latest month.
    private Double buildTypicalSavings(List<Transaction> all, List<YearMonth> otherMonths, YearMonth selected) {
        List<YearMonth> recent = new ArrayList<>(otherMonths);
        recent.add(selected);
        List<YearMonth> earlier = recent.stream()
                .filter(m -> !m.isAfter(selected))
                .sorted(Comparator.reverseOrder())
                .limit(3)
                .collect(Collectors.toList());
        if (earlier.isEmpty()) return null;

        List<Double> nets = new ArrayList<>();
        for (YearMonth month : earlier) {
            double net = 0;
            for (Transaction t : all) {
                if (!YearMonth.from(t.getTransactionDate()).equals(month)) continue;
                double amount = t.getAmount().doubleValue();
                if ("INCOME".equalsIgnoreCase(t.getType())) net += amount;
                else if (isExpense(t)) net -= amount;
            }
            nets.add(net);
        }
        return round2(median(nets));
    }

    /* ---------- goals ---------- */

    private List<GoalStatus> buildGoals(User user) {
        LocalDate today = LocalDate.now();
        List<GoalStatus> result = new ArrayList<>();

        for (SavingsGoal goal : savingsGoalRepository.findByUserOrderByTargetDateAsc(user)) {
            if (goal.getTargetAmount() == null) continue;

            double target = goal.getTargetAmount().doubleValue();
            double saved = goal.getSavedAmount() == null ? 0 : goal.getSavedAmount().doubleValue();
            double remaining = Math.max(0, target - saved);
            long daysLeft = goal.getTargetDate() == null ? 0 : ChronoUnit.DAYS.between(today, goal.getTargetDate());

            String status;
            double monthlyNeeded;
            if (remaining <= 0) {
                status = "ACHIEVED";
                monthlyNeeded = 0;
            } else if (daysLeft < 0) {
                status = "OVERDUE";
                monthlyNeeded = remaining;
            } else {
                status = "ACTIVE";
                // Within the last 30 days the whole remainder is needed now
                monthlyNeeded = daysLeft <= 30 ? remaining : remaining / (daysLeft / 30.0);
            }

            result.add(new GoalStatus(
                    goal.getName(),
                    round2(target),
                    round2(saved),
                    round2(remaining),
                    goal.getTargetDate() == null ? null : goal.getTargetDate().toString(),
                    daysLeft,
                    round2(monthlyNeeded),
                    status
            ));
        }
        return result;
    }

    /* ---------- budgets ---------- */

    private List<BudgetStatus> buildBudgets(User user, double totalSpent, Map<String, Double> spentByCategory) {
        List<BudgetStatus> result = new ArrayList<>();

        for (BudgetLimit limit : budgetLimitRepository.findByUser(user)) {
            if (limit.getLimitAmount() == null) continue;

            double limitAmount = limit.getLimitAmount().doubleValue();
            String label = limit.getCategory() == null ? "Overall" : limit.getCategory();
            double spent = limit.getCategory() == null
                    ? totalSpent
                    : spentByCategory.getOrDefault(limit.getCategory(), 0.0);

            double percentUsed = limitAmount > 0 ? spent / limitAmount * 100.0 : 0;
            result.add(new BudgetStatus(label, round2(limitAmount), round2(spent),
                    round2(percentUsed), round2(Math.max(0, spent - limitAmount))));
        }
        return result;
    }

    /* ---------- small helpers ---------- */

    private boolean isExpense(Transaction t) {
        return "EXPENSE".equalsIgnoreCase(t.getType());
    }

    private boolean hasRealMerchant(Transaction t) {
        String merchant = t.getMerchant();
        return merchant != null && !merchant.isBlank() && !"Unknown".equalsIgnoreCase(merchant.trim());
    }

    // Letters only, so changing reference numbers in a description do not split one bill into many
    private String recurringKey(Transaction t) {
        String base = hasRealMerchant(t) ? t.getMerchant() : t.getDescription();
        return base == null ? "" : base.toLowerCase().replaceAll("[^a-z]", "");
    }

    private String billName(Transaction t) {
        String base = hasRealMerchant(t) ? t.getMerchant() : t.getDescription();
        return base == null ? "" : base.trim();
    }

    // The category most of a group's rows have
    private String dominantCategory(List<Transaction> group) {
        return group.stream()
                .collect(Collectors.groupingBy(this::categoryOf, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("Uncategorized");
    }

    private String categoryOf(Transaction t) {
        String category = t.getCategory();
        return (category == null || category.isBlank()) ? "Uncategorized" : category;
    }

    private boolean isWeekend(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
    }

    private double sum(List<Transaction> list) {
        return list.stream().mapToDouble(t -> t.getAmount().doubleValue()).sum();
    }

    private Map<String, Double> sumByCategory(List<Transaction> list) {
        Map<String, Double> totals = new HashMap<>();
        for (Transaction t : list) {
            totals.merge(categoryOf(t), t.getAmount().doubleValue(), Double::sum);
        }
        return totals;
    }

    private double median(List<Double> values) {
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int n = sorted.size();
        if (n == 0) return 0;
        return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2.0;
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}