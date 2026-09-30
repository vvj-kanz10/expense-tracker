package com.expensetracker.backend.statement;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ParsedTransaction(
        LocalDate date,
        String description,
        BigDecimal amount,
        String type,   // "DEBIT" or "CREDIT"
        BigDecimal balance
) {
}