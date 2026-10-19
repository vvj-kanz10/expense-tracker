package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.CashSplitDtos.SplitRequest;
import com.expensetracker.backend.service.CashSplitService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/splits")
public class CashSplitController {

    @Autowired
    private CashSplitService cashSplitService;

    @GetMapping
    public ResponseEntity<?> getSplits(Authentication authentication) {
        return ResponseEntity.ok(cashSplitService.getSplits(authentication.getName()));
    }

    @PutMapping("/{transactionId}")
    public ResponseEntity<?> saveSplits(@PathVariable Long transactionId,
                                        @RequestBody SplitRequest request,
                                        Authentication authentication) {
        try {
            return ResponseEntity.ok(
                    cashSplitService.saveSplits(authentication.getName(), transactionId, request.splits()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}