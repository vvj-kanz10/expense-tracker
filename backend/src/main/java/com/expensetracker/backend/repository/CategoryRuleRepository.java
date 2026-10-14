package com.expensetracker.backend.repository;

import com.expensetracker.backend.model.CategoryRule;
import com.expensetracker.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, Long> {
    List<CategoryRule> findByUser(User user);
    Optional<CategoryRule> findByUserAndMatchText(User user, String matchText);
}