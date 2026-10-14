package com.expensetracker.backend.controller;

import com.expensetracker.backend.model.CategoryRule;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.CategoryRuleRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rules")
public class CategoryRuleController {

    private final CategoryRuleRepository ruleRepository;
    private final UserRepository userRepository;

    public CategoryRuleController(CategoryRuleRepository ruleRepository, UserRepository userRepository) {
        this.ruleRepository = ruleRepository;
        this.userRepository = userRepository;
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // List this user's learned rules
    @GetMapping
    public List<Map<String, Object>> list(Authentication authentication) {
        User user = currentUser(authentication);
        return ruleRepository.findByUser(user).stream()
                .map(r -> Map.<String, Object>of(
                        "id", r.getId(),
                        "matchText", r.getMatchText(),
                        "category", r.getCategory(),
                        "merchant", r.getMerchant() == null ? "Unknown" : r.getMerchant()))
                .toList();
    }

    // Delete one rule (only if it belongs to this user)
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication authentication) {
        User user = currentUser(authentication);
        CategoryRule rule = ruleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Rule not found"));

        if (!rule.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("You are not allowed to delete this rule");
        }

        ruleRepository.delete(rule);
        return ResponseEntity.noContent().build();
    }
}