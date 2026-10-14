package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.ChargeDtos.ChargeInsights;
import com.expensetracker.backend.service.ChargeInsightService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/charges")
public class ChargeInsightController {

    private final ChargeInsightService chargeInsightService;

    public ChargeInsightController(ChargeInsightService chargeInsightService) {
        this.chargeInsightService = chargeInsightService;
    }

    @GetMapping
    public ChargeInsights get(Authentication authentication) {
        return chargeInsightService.getInsights(authentication.getName());
    }
}