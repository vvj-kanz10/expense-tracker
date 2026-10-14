package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.SavingsGoalDtos.CategoryAverage;
import com.expensetracker.backend.dto.SavingsGoalDtos.ContributionRequest;
import com.expensetracker.backend.dto.SavingsGoalDtos.GoalProgress;
import com.expensetracker.backend.dto.SavingsGoalDtos.GoalRequest;
import com.expensetracker.backend.dto.SavingsGoalDtos.MonthlyNet;
import com.expensetracker.backend.dto.SavingsGoalDtos.Overview;
import com.expensetracker.backend.model.SavingsGoal;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.SavingsGoalRepository;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
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

@Service
public class SavingsGoalService {

    private static final int MONTHS_TO_USE = 3;
    private static final BigDecimal HUNDRED = new BigDecimal("100");
    private static final BigDecimal TWO = new BigDecimal("2");

    // Spending that can't realistically be trimmed, so we never suggest cutting it
    private static final Set<String> NOT_TRIMMABLE =
            Set.of("Rent/Housing", "Bills & Utilities", "Uncategorized", "Income");

    @Autowired
    private SavingsGoalRepository goalRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private SavingsGoal findOwnedGoal(User user, Long goalId) {
        SavingsGoal goal = goalRepository.findById(goalId)
                .orElseThrow(() -> new RuntimeException("Goal not found"));
        if (!goal.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("You are not allowed to change this goal");
        }
        return goal;
    }

    private String rupees(BigDecimal amount) {
        return "\u20B9" + amount.stripTrailingZeros().toPlainString();
    }

    /* ---------- public operations (each returns the fresh overview) ---------- */

    public Overview getOverview(String username) {
        return buildOverview(getUser(username));
    }

    public Overview createGoal(String username, GoalRequest request) {
        User user = getUser(username);

        String name = request.name() == null ? "" : request.name().trim();
        if (name.isEmpty()) {
            throw new RuntimeException("Give your goal a name.");
        }
        if (name.length() > 60) {
            throw new RuntimeException("Goal name is too long (60 characters max).");
        }
        if (request.targetAmount() == null || request.targetAmount().signum() <= 0) {
            throw new RuntimeException("Target amount must be more than zero.");
        }
        if (request.targetDate() == null || !request.targetDate().isAfter(LocalDate.now())) {
            throw new RuntimeException("Pick a target date in the future.");
        }
        BigDecimal saved = request.savedAmount() == null ? BigDecimal.ZERO : request.savedAmount();
        if (saved.signum() < 0) {
            throw new RuntimeException("Saved amount cannot be negative.");
        }
        if (saved.compareTo(request.targetAmount()) > 0) {
            throw new RuntimeException("Already saved cannot be more than the target amount.");
        }

        SavingsGoal goal = new SavingsGoal();
        goal.setUser(user);
        goal.setName(name);
        goal.setTargetAmount(request.targetAmount());
        goal.setSavedAmount(saved);
        goal.setTargetDate(request.targetDate());
        goalRepository.save(goal);

        return buildOverview(user);
    }

    public Overview contribute(String username, Long goalId, ContributionRequest request) {
        User user = getUser(username);
        SavingsGoal goal = findOwnedGoal(user, goalId);

        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new RuntimeException("Amount must be more than zero.");
        }

        BigDecimal stillNeeded = goal.getTargetAmount().subtract(goal.getSavedAmount()).max(BigDecimal.ZERO);
        if (request.amount().compareTo(stillNeeded) > 0) {
            throw new RuntimeException("Only " + rupees(stillNeeded) + " is left to reach this goal.");
        }

        goal.setSavedAmount(goal.getSavedAmount().add(request.amount()));
        goalRepository.save(goal);

        return buildOverview(user);
    }

    // The user used some of the money they had set aside for this goal
    public Overview withdraw(String username, Long goalId, ContributionRequest request) {
        User user = getUser(username);
        SavingsGoal goal = findOwnedGoal(user, goalId);

        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new RuntimeException("Amount must be more than zero.");
        }
        if (request.amount().compareTo(goal.getSavedAmount()) > 0) {
            throw new RuntimeException("You only have " + rupees(goal.getSavedAmount()) + " saved in this goal.");
        }

        goal.setSavedAmount(goal.getSavedAmount().subtract(request.amount()));
        goalRepository.save(goal);

        return buildOverview(user);
    }

    public Overview deleteGoal(String username, Long goalId) {
        User user = getUser(username);
        SavingsGoal goal = findOwnedGoal(user, goalId);
        goalRepository.delete(goal);
        return buildOverview(user);
    }

    /* ---------- building the overview ---------- */

    private Overview buildOverview(User user) {
        Spending spending = analyseSpending(user);

        // Goals are handled nearest deadline first. Each active goal claims the monthly
        // amount it needs out of what the user typically saves, and whatever is left
        // goes to the next goal. A goal that cannot be covered uses up what remained.
        BigDecimal available = spending.typicalMonthlySavings();
        BigDecimal totalRequired = BigDecimal.ZERO;
        List<GoalProgress> goals = new ArrayList<>();

        for (SavingsGoal goal : goalRepository.findByUserOrderByTargetDateAsc(user)) {
            GoalProgress progress = toProgress(goal, available);
            goals.add(progress);

            if ("ON_TRACK".equals(progress.status())) {
                totalRequired = totalRequired.add(progress.requiredPerMonth());
                available = available.subtract(progress.requiredPerMonth());
            } else if ("BEHIND".equals(progress.status())) {
                totalRequired = totalRequired.add(progress.requiredPerMonth());
                available = BigDecimal.ZERO;
            }
        }

        BigDecimal combinedShortfall = totalRequired.subtract(spending.typicalMonthlySavings())
                .max(BigDecimal.ZERO)
                .setScale(0, RoundingMode.CEILING);

        return new Overview(
                spending.typicalMonthlySavings(),
                spending.monthsUsed(),
                spending.topCategories(),
                goals,
                totalRequired,
                combinedShortfall,
                spending.monthlyBreakdown()
        );
    }

    // availableSavings = what is left of the user's typical monthly savings after
    // the goals with earlier deadlines have taken their share
    private GoalProgress toProgress(SavingsGoal goal, BigDecimal availableSavings) {
        BigDecimal target = goal.getTargetAmount();
        BigDecimal saved = goal.getSavedAmount();
        BigDecimal remaining = target.subtract(saved).max(BigDecimal.ZERO);
        BigDecimal percent = saved.multiply(HUNDRED)
                .divide(target, 1, RoundingMode.HALF_UP)
                .min(HUNDRED);
        LocalDate today = LocalDate.now();

        if (remaining.signum() == 0) {
            return new GoalProgress(goal.getId(), goal.getName(), target, saved, goal.getTargetDate(),
                    remaining, percent, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO, "ACHIEVED");
        }

        if (goal.getTargetDate().isBefore(today)) {
            return new GoalProgress(goal.getId(), goal.getName(), target, saved, goal.getTargetDate(),
                    remaining, percent, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO, "OVERDUE");
        }

        long daysLeft = ChronoUnit.DAYS.between(today, goal.getTargetDate());
        int monthsLeft = (int) Math.max(1, Math.ceil(daysLeft / 30.0));
        // Within 30 days this is the whole remaining amount: there is only one "month" left
        BigDecimal required = remaining.divide(BigDecimal.valueOf(monthsLeft), 0, RoundingMode.CEILING);

        if (availableSavings.compareTo(required) >= 0) {
            return new GoalProgress(goal.getId(), goal.getName(), target, saved, goal.getTargetDate(),
                    remaining, percent, (int) daysLeft, monthsLeft, required, BigDecimal.ZERO, "ON_TRACK");
        }

        // They need to improve by (required - available). If available is negative (spending more
        // than they earn) the gap is bigger than the required amount, which is the honest answer.
        BigDecimal shortfall = required.subtract(availableSavings).setScale(0, RoundingMode.CEILING);
        return new GoalProgress(goal.getId(), goal.getName(), target, saved, goal.getTargetDate(),
                remaining, percent, (int) daysLeft, monthsLeft, required, shortfall, "BEHIND");
    }

    /* ---------- what the statements say about the user's real savings ---------- */

    private record Spending(
            BigDecimal typicalMonthlySavings,
            List<String> monthsUsed,
            List<CategoryAverage> topCategories,
            List<MonthlyNet> monthlyBreakdown
    ) {}

    private Spending analyseSpending(User user) {
        Map<YearMonth, BigDecimal> incomeByMonth = new HashMap<>();
        Map<YearMonth, BigDecimal> expenseByMonth = new HashMap<>();
        Map<YearMonth, Map<String, BigDecimal>> expenseByMonthAndCategory = new HashMap<>();

        for (Transaction t : transactionRepository.findByUserId(user.getId())) {
            if (t.getTransactionDate() == null || t.getAmount() == null) {
                continue;
            }
            YearMonth month = YearMonth.from(t.getTransactionDate());

            if ("INCOME".equals(t.getType())) {
                incomeByMonth.merge(month, t.getAmount(), BigDecimal::add);
            } else if ("EXPENSE".equals(t.getType())) {
                expenseByMonth.merge(month, t.getAmount(), BigDecimal::add);
                String category = (t.getCategory() == null || t.getCategory().isBlank())
                        ? "Uncategorized" : t.getCategory();
                expenseByMonthAndCategory
                        .computeIfAbsent(month, k -> new HashMap<>())
                        .merge(category, t.getAmount(), BigDecimal::add);
            }
        }

        TreeSet<YearMonth> allMonths = new TreeSet<>();
        allMonths.addAll(incomeByMonth.keySet());
        allMonths.addAll(expenseByMonth.keySet());
        List<YearMonth> months = new ArrayList<>(allMonths); // oldest first

        // A month still in progress would look unfairly good or bad, so skip it
        if (months.size() > 1 && months.get(months.size() - 1).equals(YearMonth.now())) {
            months.remove(months.size() - 1);
        }
        if (months.size() > MONTHS_TO_USE) {
            months = new ArrayList<>(months.subList(months.size() - MONTHS_TO_USE, months.size()));
        }
        if (months.isEmpty()) {
            return new Spending(BigDecimal.ZERO, List.of(), List.of(), List.of());
        }

        // Income, spending and net for each month (shown to the user), then the median net
        List<MonthlyNet> breakdown = new ArrayList<>();
        List<BigDecimal> nets = new ArrayList<>();
        for (YearMonth month : months) {
            BigDecimal income = incomeByMonth.getOrDefault(month, BigDecimal.ZERO);
            BigDecimal expenses = expenseByMonth.getOrDefault(month, BigDecimal.ZERO);
            BigDecimal net = income.subtract(expenses);
            nets.add(net);
            breakdown.add(new MonthlyNet(
                    month.toString(),
                    income.setScale(2, RoundingMode.HALF_UP),
                    expenses.setScale(2, RoundingMode.HALF_UP),
                    net.setScale(2, RoundingMode.HALF_UP)
            ));
        }

        Collections.sort(nets);
        int n = nets.size();
        BigDecimal median = (n % 2 == 1)
                ? nets.get(n / 2)
                : nets.get(n / 2 - 1).add(nets.get(n / 2)).divide(TWO, 2, RoundingMode.HALF_UP);

        // Where the money goes: average monthly spend per category, trimmable ones only
        Map<String, BigDecimal> totalByCategory = new HashMap<>();
        for (YearMonth month : months) {
            Map<String, BigDecimal> categories = expenseByMonthAndCategory.get(month);
            if (categories == null) continue;
            for (Map.Entry<String, BigDecimal> entry : categories.entrySet()) {
                if (!NOT_TRIMMABLE.contains(entry.getKey())) {
                    totalByCategory.merge(entry.getKey(), entry.getValue(), BigDecimal::add);
                }
            }
        }

        BigDecimal monthCount = BigDecimal.valueOf(months.size());
        List<CategoryAverage> top = totalByCategory.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue(Comparator.reverseOrder()))
                .limit(3)
                .map(e -> new CategoryAverage(e.getKey(), e.getValue().divide(monthCount, 2, RoundingMode.HALF_UP)))
                .toList();

        List<String> monthLabels = months.stream().map(YearMonth::toString).toList();
        return new Spending(median.setScale(2, RoundingMode.HALF_UP), monthLabels, top, breakdown);
    }
}