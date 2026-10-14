package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.BudgetSuggestion;
import com.expensetracker.backend.dto.BudgetSuggestionResponse;
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
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

@Service
public class BudgetSuggestionService {

    private static final int MONTHS_TO_USE = 3;
    private static final BigDecimal BUFFER = new BigDecimal("1.10");   // 10% breathing room
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private BudgetLimitRepository budgetLimitRepository;

    @Autowired
    private UserRepository userRepository;

    public BudgetSuggestionResponse suggest(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        // month -> (category -> total spent that month)
        Map<YearMonth, Map<String, BigDecimal>> spendByMonth = new TreeMap<>();

        for (Transaction t : transactionRepository.findByUserId(user.getId())) {
            if (!"EXPENSE".equals(t.getType()) || t.getTransactionDate() == null || t.getAmount() == null) {
                continue;
            }
            String category = t.getCategory();
            if (category == null || category.isBlank() || category.equals("Uncategorized")) {
                continue; // can't budget for transactions with no real category
            }
            YearMonth month = YearMonth.from(t.getTransactionDate());
            spendByMonth.computeIfAbsent(month, k -> new HashMap<>())
                    .merge(category, t.getAmount(), BigDecimal::add);
        }

        List<YearMonth> months = new ArrayList<>(spendByMonth.keySet()); // oldest first

        // A month that is still in progress would pull the averages down, so skip it
        // (as long as there is at least one finished month to use instead)
        if (months.size() > 1 && months.get(months.size() - 1).equals(YearMonth.now())) {
            months.remove(months.size() - 1);
        }

        // Keep only the most recent few months
        if (months.size() > MONTHS_TO_USE) {
            months = new ArrayList<>(months.subList(months.size() - MONTHS_TO_USE, months.size()));
        }

        if (months.isEmpty()) {
            return new BudgetSuggestionResponse(List.of(), List.of());
        }

        // Per category: total spend, and in how many of the chosen months it had any spending
        Map<String, BigDecimal> totalByCategory = new HashMap<>();
        Map<String, Integer> monthsWithSpend = new HashMap<>();
        BigDecimal grandTotal = BigDecimal.ZERO;

        for (YearMonth month : months) {
            for (Map.Entry<String, BigDecimal> entry : spendByMonth.get(month).entrySet()) {
                totalByCategory.merge(entry.getKey(), entry.getValue(), BigDecimal::add);
                monthsWithSpend.merge(entry.getKey(), 1, Integer::sum);
                grandTotal = grandTotal.add(entry.getValue());
            }
        }
        BigDecimal monthCount = BigDecimal.valueOf(months.size());

        // What the user has set today
        Map<String, BigDecimal> currentLimits = new HashMap<>();
        BigDecimal currentOverall = null;
        for (BudgetLimit limit : budgetLimitRepository.findByUser(user)) {
            if (limit.getCategory() == null) {
                currentOverall = limit.getLimitAmount();
            } else {
                currentLimits.put(limit.getCategory(), limit.getLimitAmount());
            }
        }

        List<BudgetSuggestion> suggestions = new ArrayList<>();

        // Overall monthly budget first (averaged over every month, it is a true monthly total)
        BigDecimal overallAverage = average(grandTotal, monthCount);
        suggestions.add(new BudgetSuggestion(null, overallAverage, roundedLimit(overallAverage), currentOverall));

        // Then each category, biggest spend first.
        // A category is averaged over the months it actually had spending in, so a
        // once-in-a-while cost like rent is not watered down by the empty months.
        List<Map.Entry<String, BigDecimal>> categories = new ArrayList<>(totalByCategory.entrySet());
        categories.sort(Map.Entry.<String, BigDecimal>comparingByValue(Comparator.reverseOrder()));

        for (Map.Entry<String, BigDecimal> entry : categories) {
            BigDecimal activeMonths = BigDecimal.valueOf(monthsWithSpend.get(entry.getKey()));
            BigDecimal categoryAverage = average(entry.getValue(), activeMonths);
            suggestions.add(new BudgetSuggestion(
                    entry.getKey(),
                    categoryAverage,
                    roundedLimit(categoryAverage),
                    currentLimits.get(entry.getKey())
            ));
        }

        List<String> monthLabels = months.stream().map(YearMonth::toString).toList();
        return new BudgetSuggestionResponse(monthLabels, suggestions);
    }

    private BigDecimal average(BigDecimal total, BigDecimal monthCount) {
        return total.divide(monthCount, 2, RoundingMode.HALF_UP);
    }

    // Average + 10%, rounded up to the next 100 (e.g. average 2,450 -> limit 2,800)
    private BigDecimal roundedLimit(BigDecimal average) {
        return average.multiply(BUFFER)
                .divide(HUNDRED, 0, RoundingMode.CEILING)
                .multiply(HUNDRED);
    }
}