package com.expensetracker.backend.controller;

import com.expensetracker.backend.service.SpendingProfileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/spending-profile")
public class SpendingProfileController {

    @Autowired
    private SpendingProfileService spendingProfileService;

    // GET /api/spending-profile?month=2026-09   (month is optional: defaults to the latest month)
    @GetMapping
    public ResponseEntity<?> getProfile(Authentication authentication,
                                        @RequestParam(required = false) String month) {
        try {
            return ResponseEntity.ok(spendingProfileService.build(authentication.getName(), month));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "month must look like 2026-09"));
        }
    }
}