package com.expensetracker.backend.controller;

import com.expensetracker.backend.service.PersonalTipService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.format.DateTimeParseException;
import java.util.Map;

@RestController
@RequestMapping("/api/personal-tips")
public class PersonalTipController {

    @Autowired
    private PersonalTipService personalTipService;

    // Saved tips only, never calls Gemini. Returns [] when nothing is saved for the current numbers.
    @GetMapping("/cached")
    public ResponseEntity<?> getCached(Authentication authentication,
                                       @RequestParam(required = false) String month) {
        try {
            return ResponseEntity.ok(personalTipService.getCached(authentication.getName(), month));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "month must look like 2026-09"));
        }
    }

    // Saved tips if the numbers are unchanged, otherwise generates new ones with Gemini
    @PostMapping
    public ResponseEntity<?> generate(Authentication authentication,
                                      @RequestParam(required = false) String month) {
        try {
            return ResponseEntity.ok(personalTipService.getTips(authentication.getName(), month));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(Map.of("message", "month must look like 2026-09"));
        }
    }
}