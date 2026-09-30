package com.expensetracker.backend.repository;

import com.expensetracker.backend.model.BudgetLimit;
import com.expensetracker.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BudgetLimitRepository extends JpaRepository<BudgetLimit, Long> {

    // Find all budget limits (overall + per-category) for a user
    List<BudgetLimit> findByUser(User user);

    // Find the overall limit (category is null) for a user
    Optional<BudgetLimit> findByUserAndCategoryIsNull(User user);

    // Find a specific category's limit for a user
    Optional<BudgetLimit> findByUserAndCategory(User user, String category);
}