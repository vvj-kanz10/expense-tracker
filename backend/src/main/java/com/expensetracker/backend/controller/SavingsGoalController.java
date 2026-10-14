package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.SavingsGoalDtos.ContributionRequest;
import com.expensetracker.backend.dto.SavingsGoalDtos.GoalRequest;
import com.expensetracker.backend.service.SavingsGoalService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/goals")
public class SavingsGoalController {

    @Autowired
    private SavingsGoalService savingsGoalService;

    @GetMapping
    public ResponseEntity<?> getGoals(Authentication authentication) {
        try {
            return ResponseEntity.ok(savingsGoalService.getOverview(authentication.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping
    public ResponseEntity<?> createGoal(@RequestBody GoalRequest request, Authentication authentication) {
        try {
            return ResponseEntity.ok(savingsGoalService.createGoal(authentication.getName(), request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/contribute")
    public ResponseEntity<?> contribute(@PathVariable Long id,
                                        @RequestBody ContributionRequest request,
                                        Authentication authentication) {
        try {
            return ResponseEntity.ok(savingsGoalService.contribute(authentication.getName(), id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{id}/withdraw")
    public ResponseEntity<?> withdraw(@PathVariable Long id,
                                      @RequestBody ContributionRequest request,
                                      Authentication authentication) {
        try {
            return ResponseEntity.ok(savingsGoalService.withdraw(authentication.getName(), id, request));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteGoal(@PathVariable Long id, Authentication authentication) {
        try {
            return ResponseEntity.ok(savingsGoalService.deleteGoal(authentication.getName(), id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}