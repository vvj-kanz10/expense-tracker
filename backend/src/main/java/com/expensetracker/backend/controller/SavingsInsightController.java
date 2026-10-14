package com.expensetracker.backend.controller;

import com.expensetracker.backend.service.SavingsInsightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/insights")
public class SavingsInsightController {

    @Autowired
    private SavingsInsightService savingsInsightService;

    // Generates tips (or returns the saved ones if the numbers are unchanged)
    @PostMapping("/savings")
    public List<String> getSavingsSuggestions(@RequestBody Map<String, Object> stats,
                                              Authentication authentication) throws Exception {
        return savingsInsightService.getSavingsSuggestions(authentication.getName(), stats);
    }

    // Only checks for saved tips. Never calls Gemini.
    @PostMapping("/savings/cached")
    public List<String> getCachedSavingsSuggestions(@RequestBody Map<String, Object> stats,
                                                    Authentication authentication) {
        return savingsInsightService.getCachedSuggestions(authentication.getName(), stats);
    }
}