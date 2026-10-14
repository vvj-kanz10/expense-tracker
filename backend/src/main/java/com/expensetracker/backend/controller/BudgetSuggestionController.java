package com.expensetracker.backend.controller;

import com.expensetracker.backend.service.BudgetSuggestionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/budget-suggestions")
public class BudgetSuggestionController {

    @Autowired
    private BudgetSuggestionService budgetSuggestionService;

    @GetMapping
    public ResponseEntity<?> getSuggestions(Authentication authentication) {
        try {
            return ResponseEntity.ok(budgetSuggestionService.suggest(authentication.getName()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}