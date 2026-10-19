package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.CashSplitDtos.SplitItem;
import com.expensetracker.backend.dto.CashSplitDtos.SplitResponse;
import com.expensetracker.backend.model.CashSplit;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.CashSplitRepository;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CashSplitService {

    @Autowired
    private CashSplitRepository cashSplitRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    private User getUser(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private SplitResponse toResponse(CashSplit s) {
        return new SplitResponse(s.getId(), s.getTransactionId(), s.getCategory(), s.getAmount());
    }

    // Every split the logged-in user has saved, across all their withdrawals
    public List<SplitResponse> getSplits(String username) {
        User user = getUser(username);
        return cashSplitRepository.findByUserId(user.getId()).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // Replaces the splits of one withdrawal with the given list. An empty list clears them.
    // Whatever is not split stays counted as "Withdrawal", so totals never change.
    @Transactional
    public List<SplitResponse> saveSplits(String username, Long transactionId, List<SplitItem> items) {
        User user = getUser(username);

        Transaction withdrawal = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        if (!withdrawal.getUser().getId().equals(user.getId())) {
            throw new IllegalArgumentException("You are not allowed to split this transaction");
        }
        if (!"EXPENSE".equals(String.valueOf(withdrawal.getType()))
                || !"Withdrawal".equalsIgnoreCase(withdrawal.getCategory())) {
            throw new IllegalArgumentException("Only withdrawals can be split.");
        }

        List<SplitItem> safeItems = items == null ? List.of() : items;
        List<CashSplit> toSave = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (SplitItem item : safeItems) {
            String category = item.category() == null ? "" : item.category().trim();
            if (category.isEmpty()) {
                throw new IllegalArgumentException("Every part needs a category.");
            }
            if (category.length() > 60) {
                throw new IllegalArgumentException("Category names can be at most 60 characters.");
            }
            if (category.equalsIgnoreCase("Withdrawal") || category.equalsIgnoreCase("Income")) {
                throw new IllegalArgumentException("Pick a spending category for each part.");
            }
            if (item.amount() == null || item.amount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Every part needs an amount greater than zero.");
            }

            BigDecimal amount = item.amount().setScale(2, RoundingMode.HALF_UP);
            total = total.add(amount);

            CashSplit split = new CashSplit();
            split.setUser(user);
            split.setTransactionId(transactionId);
            split.setCategory(category);
            split.setAmount(amount);
            toSave.add(split);
        }

        if (total.compareTo(withdrawal.getAmount()) > 0) {
            throw new IllegalArgumentException(
                    "The parts add up to " + total.toPlainString()
                            + ", which is more than the withdrawal of "
                            + withdrawal.getAmount().toPlainString() + ".");
        }

        cashSplitRepository.deleteByTransactionId(transactionId);
        cashSplitRepository.saveAll(toSave);

        return getSplits(username);
    }
}