package com.expensetracker.backend.service;

import com.expensetracker.backend.model.BudgetLimit;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.BudgetLimitRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class BudgetLimitService {

    @Autowired
    private BudgetLimitRepository budgetLimitRepository;

    // Set (or update) the overall limit, or a specific category's limit
    public BudgetLimit setLimit(User user, String category, BigDecimal amount) {
        BudgetLimit limit;

        if (category == null) {
            limit = budgetLimitRepository.findByUserAndCategoryIsNull(user)
                    .orElse(new BudgetLimit());
        } else {
            limit = budgetLimitRepository.findByUserAndCategory(user, category)
                    .orElse(new BudgetLimit());
        }

        limit.setUser(user);
        limit.setCategory(category);
        limit.setLimitAmount(amount);

        return budgetLimitRepository.save(limit);
    }

    // Get all limits (overall + per-category) for a user
    public List<BudgetLimit> getLimits(User user) {
        return budgetLimitRepository.findByUser(user);
    }
}