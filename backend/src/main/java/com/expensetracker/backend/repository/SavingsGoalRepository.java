package com.expensetracker.backend.repository;

import com.expensetracker.backend.model.SavingsGoal;
import com.expensetracker.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavingsGoalRepository extends JpaRepository<SavingsGoal, Long> {

    List<SavingsGoal> findByUserOrderByTargetDateAsc(User user);
}