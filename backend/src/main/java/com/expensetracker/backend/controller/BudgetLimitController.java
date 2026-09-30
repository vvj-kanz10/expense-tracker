package com.expensetracker.backend.controller;

import com.expensetracker.backend.model.BudgetLimit;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.UserRepository;
import com.expensetracker.backend.service.BudgetLimitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/budget-limits")
public class BudgetLimitController {

    @Autowired
    private BudgetLimitService budgetLimitService;

    @Autowired
    private UserRepository userRepository;

    // GET all limits (overall + per-category) for the logged-in user
    @GetMapping
    public List<BudgetLimit> getLimits(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
        return budgetLimitService.getLimits(user);
    }

    // POST to set/update a limit
    // Body: { "category": "Food & Dining", "amount": 5000 }  -> per-category
    // Body: { "category": null, "amount": 20000 }            -> overall
    @PostMapping
    public BudgetLimit setLimit(@RequestBody Map<String, Object> body, Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));

        String category = (String) body.get("category");
        BigDecimal amount = new BigDecimal(body.get("amount").toString());

        return budgetLimitService.setLimit(user, category, amount);
    }
}