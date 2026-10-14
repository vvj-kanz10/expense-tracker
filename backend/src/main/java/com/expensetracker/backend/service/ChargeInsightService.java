package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.ChargeDtos.ChargeInsights;
import com.expensetracker.backend.dto.ChargeDtos.RecurringCharge;
import com.expensetracker.backend.dto.ChargeDtos.UnusualCharge;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ChargeInsightService {

    // A payment must show up at least this many times to count as recurring
    private static final int MIN_OCCURRENCES = 2;
    // Amounts must stay within 10% of the typical amount
    private static final BigDecimal AMOUNT_TOLERANCE = new BigDecimal("0.10");
    // Days between payments must look roughly monthly
    private static final long MIN_GAP_DAYS = 24;
    private static final long MAX_GAP_DAYS = 37;

    // A charge is unusual when it is this many times the typical size for its category
    private static final BigDecimal UNUSUAL_MULTIPLE = new BigDecimal("3");
    private static final BigDecimal UNUSUAL_MIN_AMOUNT = new BigDecimal("500");
    private static final int UNUSUAL_MIN_CATEGORY_SIZE = 5;
    private static final int MAX_UNUSUAL_SHOWN = 5;

    private static final Set<String> SKIP_RECURRING = Set.of("Withdrawal", "Income");
    private static final Set<String> SKIP_UNUSUAL = Set.of("Rent/Housing", "Bills & Utilities", "Other/People", "Withdrawal", "Income", "Uncategorized");

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    public ChargeInsights getInsights(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<Transaction> expenses = new ArrayList<>();
        for (Transaction t : transactionRepository.findByUserId(user.getId())) {
            if ("EXPENSE".equals(t.getType()) && t.getTransactionDate() != null && t.getAmount() != null) {
                expenses.add(t);
            }
        }

        List<RecurringCharge> recurring = findRecurring(expenses);
        BigDecimal monthlyTotal = recurring.stream()
                .map(RecurringCharge::typicalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ChargeInsights(recurring, monthlyTotal, findUnusual(expenses));
    }

    /* ---------- recurring payments ---------- */

    // Groups by merchant when we know it, otherwise by the cleaned-up description
    private String groupKey(Transaction t) {
        String merchant = t.getMerchant();
        if (merchant != null && !merchant.isBlank() && !"Unknown".equalsIgnoreCase(merchant.trim())) {
            return merchant.trim().toLowerCase();
        }
        return CategoryRuleService.normalize(t.getDescription());
    }

    private List<RecurringCharge> findRecurring(List<Transaction> expenses) {
        Map<String, List<Transaction>> groups = new HashMap<>();
        for (Transaction t : expenses) {
            if (t.getCategory() != null && SKIP_RECURRING.contains(t.getCategory())) continue;
            String key = groupKey(t);
            if (key.isEmpty()) continue;
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(t);
        }

        List<RecurringCharge> found = new ArrayList<>();

        for (List<Transaction> group : groups.values()) {
            if (group.size() < MIN_OCCURRENCES) continue;

            group.sort(Comparator.comparing(Transaction::getTransactionDate));

            // 1) every amount must be close to the typical amount
            BigDecimal typical = median(group.stream().map(Transaction::getAmount).toList());
            BigDecimal allowed = typical.multiply(AMOUNT_TOLERANCE);
            boolean amountsSimilar = group.stream()
                    .allMatch(t -> t.getAmount().subtract(typical).abs().compareTo(allowed) <= 0);
            if (!amountsSimilar) continue;

            // 2) every gap between payments must look roughly monthly
            boolean monthly = true;
            for (int i = 1; i < group.size(); i++) {
                long gap = ChronoUnit.DAYS.between(
                        group.get(i - 1).getTransactionDate(), group.get(i).getTransactionDate());
                if (gap < MIN_GAP_DAYS || gap > MAX_GAP_DAYS) {
                    monthly = false;
                    break;
                }
            }
            if (!monthly) continue;

            Transaction latest = group.get(group.size() - 1);
            String merchant = latest.getMerchant();
            String name = (merchant != null && !merchant.isBlank() && !"Unknown".equalsIgnoreCase(merchant.trim()))
                    ? merchant.trim()
                    : latest.getDescription();

            found.add(new RecurringCharge(
                    name,
                    latest.getCategory(),
                    typical.setScale(2, RoundingMode.HALF_UP),
                    group.size(),
                    latest.getTransactionDate(),
                    latest.getTransactionDate().plusMonths(1)
            ));
        }

        found.sort(Comparator.comparing(RecurringCharge::typicalAmount).reversed());
        return found;
    }

    /* ---------- unusual charges ---------- */

    private List<UnusualCharge> findUnusual(List<Transaction> expenses) {
        Map<String, List<Transaction>> byCategory = new LinkedHashMap<>();
        for (Transaction t : expenses) {
            String category = (t.getCategory() == null || t.getCategory().isBlank()) ? "Uncategorized" : t.getCategory();
            if (SKIP_UNUSUAL.contains(category)) continue;
            byCategory.computeIfAbsent(category, k -> new ArrayList<>()).add(t);
        }

        List<UnusualCharge> flagged = new ArrayList<>();

        for (Map.Entry<String, List<Transaction>> entry : byCategory.entrySet()) {
            List<Transaction> group = entry.getValue();
            if (group.size() < UNUSUAL_MIN_CATEGORY_SIZE) continue;

            BigDecimal typical = median(group.stream().map(Transaction::getAmount).toList());
            BigDecimal threshold = typical.multiply(UNUSUAL_MULTIPLE).max(UNUSUAL_MIN_AMOUNT);

            for (Transaction t : group) {
                if (t.getAmount().compareTo(threshold) >= 0) {
                    flagged.add(new UnusualCharge(
                            t.getId(),
                            t.getTransactionDate(),
                            t.getMerchant(),
                            t.getDescription(),
                            entry.getKey(),
                            t.getAmount(),
                            typical.setScale(2, RoundingMode.HALF_UP)
                    ));
                }
            }
        }

        // Most recent first, and only the top few so the list stays useful
        flagged.sort(Comparator.comparing(UnusualCharge::date).reversed());
        return flagged.size() > MAX_UNUSUAL_SHOWN ? flagged.subList(0, MAX_UNUSUAL_SHOWN) : flagged;
    }

    /* ---------- helper ---------- */

    private BigDecimal median(List<BigDecimal> values) {
        List<BigDecimal> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int n = sorted.size();
        if (n % 2 == 1) {
            return sorted.get(n / 2);
        }
        return sorted.get(n / 2 - 1).add(sorted.get(n / 2)).divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP);
    }
}