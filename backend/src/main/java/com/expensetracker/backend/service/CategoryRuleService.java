package com.expensetracker.backend.service;

import com.expensetracker.backend.model.CategoryRule;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.CategoryRuleRepository;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class CategoryRuleService {

    private final CategoryRuleRepository ruleRepository;

    public CategoryRuleService(CategoryRuleRepository ruleRepository) {
        this.ruleRepository = ruleRepository;
    }

    // "UPI/4829/SWIGGY 22" -> "upi swiggy"
    // lowercase, keep only letters, collapse spaces
    public static String normalize(String description) {
        if (description == null) return "";
        return description.toLowerCase()
                .replaceAll("[^a-z]+", " ")
                .trim();
    }

    // Called when the user edits a transaction's category/merchant.
    // Creates the rule, or updates it if one already exists for this text.
    public void saveRule(User user, String description, String category, String merchant) {
        String matchText = normalize(description);
        if (matchText.isEmpty() || category == null || category.isBlank()) {
            return; // nothing useful to learn from
        }

        CategoryRule rule = ruleRepository.findByUserAndMatchText(user, matchText)
                .orElseGet(() -> new CategoryRule(user, matchText, category, merchant));

        rule.setCategory(category);
        rule.setMerchant(merchant);
        ruleRepository.save(rule);
    }

    // Called once per upload: loads all of this user's rules into a map
    // so each transaction can be checked instantly.
    public Map<String, CategoryRule> loadRules(User user) {
        Map<String, CategoryRule> map = new HashMap<>();
        for (CategoryRule rule : ruleRepository.findByUser(user)) {
            map.put(rule.getMatchText(), rule);
        }
        return map;
    }

    // Returns the matching rule for a description, or null if none.
    public CategoryRule findMatch(Map<String, CategoryRule> rules, String description) {
        return rules.get(normalize(description));
    }
}