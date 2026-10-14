package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.LeftoverDtos.LeftoverSplit;
import com.expensetracker.backend.service.LeftoverSplitService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leftover")
public class LeftoverController {

    private final LeftoverSplitService leftoverSplitService;

    public LeftoverController(LeftoverSplitService leftoverSplitService) {
        this.leftoverSplitService = leftoverSplitService;
    }

    // GET /api/leftover  or  GET /api/leftover?month=2026-09
    @GetMapping
    public LeftoverSplit get(@RequestParam(required = false) String month, Authentication authentication) {
        return leftoverSplitService.getSplit(authentication.getName(), month);
    }
}