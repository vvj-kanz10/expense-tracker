package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.ForecastDtos.Forecast;
import com.expensetracker.backend.service.ForecastService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/forecast")
public class ForecastController {

    private final ForecastService forecastService;

    public ForecastController(ForecastService forecastService) {
        this.forecastService = forecastService;
    }

    // GET /api/forecast
    // GET /api/forecast?month=2026-09&asOf=2026-09-15   (asOf is mainly for testing)
    @GetMapping
    public Forecast get(@RequestParam(required = false) String month,
                        @RequestParam(required = false)
                        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
                        Authentication authentication) {
        return forecastService.getForecast(authentication.getName(), month, asOf);
    }
}