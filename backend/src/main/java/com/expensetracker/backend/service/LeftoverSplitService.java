package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.LeftoverDtos.Allocation;
import com.expensetracker.backend.dto.LeftoverDtos.LeftoverSplit;
import com.expensetracker.backend.dto.SavingsGoalDtos.GoalProgress;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import com.expensetracker.backend.service.GeminiSplitService.Suggestion;
import com.fasterxml.jackson.core.type.TypeReference;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

@Service
public class LeftoverSplitService {

    // Share of the leftover we always keep free to spend, so goals never take everything
    private static final BigDecimal FREE_SHARE = new BigDecimal("0.20");
    private static final int MAX_REASON_LENGTH = 160;
    private static final DateTimeFormatter DATE_FORMAT =
            DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SavingsGoalService savingsGoalService;

    @Autowired
    private GeminiSplitService geminiSplitService;

    @Autowired
    private AiCacheService aiCacheService;

    private String rupees(BigDecimal amount) {
        return "\u20B9" + amount.stripTrailingZeros().toPlainString();
    }

    private String plain(BigDecimal amount) {
        return amount.stripTrailingZeros().toPlainString();
    }

    // The most that goals may take: 80% of the leftover, in whole rupees
    private BigDecimal maxToAllocate(BigDecimal leftover) {
        return leftover.multiply(BigDecimal.ONE.subtract(FREE_SHARE)).setScale(0, RoundingMode.DOWN);
    }

    // monthText like "2026-09"; null or blank means the latest month in the data
    public LeftoverSplit getSplit(String username, String monthText) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Map<YearMonth, BigDecimal> incomeByMonth = new HashMap<>();
        Map<YearMonth, BigDecimal> expenseByMonth = new HashMap<>();

        for (Transaction t : transactionRepository.findByUserId(user.getId())) {
            if (t.getTransactionDate() == null || t.getAmount() == null) continue;
            YearMonth month = YearMonth.from(t.getTransactionDate());
            if ("INCOME".equals(t.getType())) {
                incomeByMonth.merge(month, t.getAmount(), BigDecimal::add);
            } else if ("EXPENSE".equals(t.getType())) {
                expenseByMonth.merge(month, t.getAmount(), BigDecimal::add);
            }
        }

        TreeSet<YearMonth> months = new TreeSet<>(Comparator.reverseOrder()); // latest first
        months.addAll(incomeByMonth.keySet());
        months.addAll(expenseByMonth.keySet());

        if (months.isEmpty()) {
            return new LeftoverSplit(null, List.of(), BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                    List.of(), BigDecimal.ZERO, "RULES", "Upload a statement first to get a split.");
        }

        YearMonth month;
        if (monthText == null || monthText.isBlank()) {
            month = months.first();
        } else {
            try {
                month = YearMonth.parse(monthText.trim());
            } catch (DateTimeParseException e) {
                throw new RuntimeException("Month must look like 2026-09.");
            }
            if (!months.contains(month)) {
                throw new RuntimeException("No transactions found for " + month + ".");
            }
        }

        List<String> availableMonths = months.stream().map(YearMonth::toString).toList();
        BigDecimal income = incomeByMonth.getOrDefault(month, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal expenses = expenseByMonth.getOrDefault(month, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        BigDecimal leftover = income.subtract(expenses);

        if (leftover.signum() <= 0) {
            return new LeftoverSplit(month.toString(), availableMonths, income, expenses, leftover,
                    List.of(), BigDecimal.ZERO, "RULES",
                    "Nothing was left over in " + month + ": spending was at or above income.");
        }

        // Goals that still need money and are not overdue. Behind-schedule goals come first,
        // and inside each group the overview already lists the nearest deadline first.
        List<GoalProgress> activeGoals = new ArrayList<>(
                savingsGoalService.getOverview(username).goals().stream()
                        .filter(g -> "BEHIND".equals(g.status()) || "ON_TRACK".equals(g.status()))
                        .toList());
        activeGoals.sort(Comparator.comparing((GoalProgress g) -> !"BEHIND".equals(g.status())));

        if (activeGoals.isEmpty()) {
            return new LeftoverSplit(month.toString(), availableMonths, income, expenses, leftover,
                    List.of(), leftover, "RULES",
                    "You have no active savings goals, so there is nothing to split. Create a goal to get suggestions.");
        }

        BigDecimal room = maxToAllocate(leftover);
        List<Allocation> allocations;
        String source;

        // Fingerprint of everything the AI decision depends on. Same fingerprint = same answer,
        // so the saved result is reused. (Days left is left out on purpose, otherwise the
        // fingerprint would change every day.)
        String cacheKey = "SPLIT:" + month;
        String inputHash = fingerprint(month, income, expenses, room, activeGoals);

        Optional<List<Allocation>> cached = aiCacheService.get(
                user, cacheKey, inputHash, new TypeReference<List<Allocation>>() {});

        if (cached.isPresent()) {
            System.out.println("AI split for " + month + " served from cache (no Gemini call)");
            allocations = cached.get();
            source = "AI";
        } else {
            // Try Gemini. Its answer is only used if it passes every check below.
            try {
                List<Suggestion> suggestions = geminiSplitService.suggest(
                        month.toString(), income, expenses, leftover, room, activeGoals);
                allocations = validate(suggestions, activeGoals, room);
                source = "AI";
                // Only real AI answers are saved, so a fallback never sticks around
                aiCacheService.put(user, cacheKey, inputHash, allocations);
            } catch (Exception e) {
                System.err.println("AI split not used, falling back to rules: " + e.getMessage());
                allocations = splitByRules(activeGoals, room);
                source = "RULES";
            }
        }

        BigDecimal given = allocations.stream().map(Allocation::amount).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new LeftoverSplit(month.toString(), availableMonths, income, expenses, leftover,
                allocations, leftover.subtract(given), source, null);
    }

    private String fingerprint(YearMonth month, BigDecimal income, BigDecimal expenses,
                               BigDecimal room, List<GoalProgress> goals) {
        StringBuilder text = new StringBuilder();
        text.append(month).append('|').append(plain(income)).append('|')
                .append(plain(expenses)).append('|').append(plain(room));
        for (GoalProgress g : goals) {
            text.append('|').append(g.id()).append(':').append(g.name())
                    .append(':').append(plain(g.remaining()))
                    .append(':').append(plain(g.requiredPerMonth()))
                    .append(':').append(g.status());
        }
        return AiCacheService.hash(text.toString());
    }

    // Checks Gemini's answer. Anything wrong throws, which sends us to the rule-based split.
    private List<Allocation> validate(List<Suggestion> suggestions, List<GoalProgress> goals, BigDecimal room) {
        Map<Long, GoalProgress> goalById = new HashMap<>();
        for (GoalProgress g : goals) goalById.put(g.id(), g);

        Set<Long> seen = new HashSet<>();
        List<Allocation> allocations = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (Suggestion s : suggestions) {
            GoalProgress goal = goalById.get(s.goalId());
            if (goal == null) {
                throw new RuntimeException("AI used a goal that does not exist");
            }
            if (!seen.add(s.goalId())) {
                throw new RuntimeException("AI listed the same goal twice");
            }

            BigDecimal amount = s.amount().setScale(0, RoundingMode.DOWN);
            if (amount.signum() < 0) {
                throw new RuntimeException("AI gave a negative amount");
            }
            if (amount.compareTo(goal.remaining()) > 0) {
                throw new RuntimeException("AI gave a goal more than it needs");
            }
            if (amount.signum() == 0) continue;

            String reason = s.reason() == null ? "" : s.reason().trim();
            if (reason.isEmpty()) {
                throw new RuntimeException("AI gave no reason");
            }
            if (reason.length() > MAX_REASON_LENGTH) {
                reason = reason.substring(0, MAX_REASON_LENGTH - 3).trim() + "...";
            }

            total = total.add(amount);
            allocations.add(new Allocation(goal.id(), goal.name(), amount, reason));
        }

        if (allocations.isEmpty()) {
            throw new RuntimeException("AI gave nothing to any goal");
        }
        if (total.compareTo(room) > 0) {
            throw new RuntimeException("AI split adds up to more than allowed");
        }
        return allocations;
    }

    // Simple rule-based split (also the fallback). Each goal gets what it needs this month,
    // until the allowed amount runs out.
    private List<Allocation> splitByRules(List<GoalProgress> goals, BigDecimal room) {
        List<Allocation> allocations = new ArrayList<>();

        for (GoalProgress goal : goals) {
            if (room.signum() <= 0) break;

            BigDecimal wanted = goal.requiredPerMonth().min(goal.remaining());
            BigDecimal give = wanted.min(room).setScale(0, RoundingMode.DOWN);
            if (give.signum() <= 0) continue;

            String date = goal.targetDate().format(DATE_FORMAT);
            String reason = "BEHIND".equals(goal.status())
                    ? "Behind schedule: needs " + rupees(goal.requiredPerMonth()) + " a month to be ready by " + date + "."
                    : "On track: " + rupees(goal.requiredPerMonth()) + " a month reaches it by " + date + ".";

            allocations.add(new Allocation(goal.id(), goal.name(), give, reason));
            room = room.subtract(give);
        }

        return allocations;
    }
}