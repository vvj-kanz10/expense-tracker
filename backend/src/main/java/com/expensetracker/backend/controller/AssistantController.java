package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.AssistantDtos.AskRequest;
import com.expensetracker.backend.service.AssistantService;
import com.expensetracker.backend.service.GeminiUnavailableException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/assistant")
public class AssistantController {

    private static final int MAX_QUESTION_LENGTH = 300;

    @Autowired
    private AssistantService assistantService;

    @PostMapping("/ask")
    public ResponseEntity<?> ask(@RequestBody AskRequest request, Authentication authentication) {
        String question = request.question() == null ? "" : request.question().trim();

        if (question.isEmpty()) {
            return ResponseEntity.badRequest().body("Type a question first.");
        }
        if (question.length() > MAX_QUESTION_LENGTH) {
            return ResponseEntity.badRequest().body("Please keep your question under " + MAX_QUESTION_LENGTH + " characters.");
        }

        try {
            return ResponseEntity.ok(assistantService.ask(authentication.getName(), question));
        } catch (GeminiUnavailableException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(e.getMessage());
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}