package com.expensetracker.backend.controller;

import com.expensetracker.backend.statement.SavingsInsightService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/insights")
public class SavingsInsightController {

    @Autowired
    private SavingsInsightService savingsInsightService;

    // Body: whatever stats map the frontend has already calculated
    // e.g. { "totalSpent": 22368, "topCategory": "Rent/Housing", "biggestTransaction": ..., "spikes": [...] }
    @PostMapping("/savings")
    public List<String> getSavingsSuggestions(@RequestBody Map<String, Object> stats) throws Exception {
        return savingsInsightService.getSavingsSuggestions(stats);
    }
}