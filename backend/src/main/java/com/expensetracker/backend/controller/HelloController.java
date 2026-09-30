package com.expensetracker.backend.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    @GetMapping("/api/hello")
    public String hello() {
        return "Hello from Expense Tracker Backend!";
    }

    @GetMapping("/api/protected-test")
    public String protectedTest() {
        return "You are authenticated! JWT works.";
    }
}
