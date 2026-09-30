package com.expensetracker.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public class TransactionResponse {

    private Long id;
    private String description;
    private String merchant;
    private BigDecimal amount;
    private LocalDate transactionDate;
    private String category;
    private String type;
    private String source;

    public TransactionResponse(Long id, String description, String merchant, BigDecimal amount,
                               LocalDate transactionDate, String category, String type, String source) {
        this.id = id;
        this.description = description;
        this.merchant = merchant;
        this.amount = amount;
        this.transactionDate = transactionDate;
        this.category = category;
        this.type = type;
        this.source = source;
    }

    // Getters
    public Long getId() { return id; }
    public String getDescription() { return description; }
    public String getMerchant() { return merchant; }
    public BigDecimal getAmount() { return amount; }
    public LocalDate getTransactionDate() { return transactionDate; }
    public String getCategory() { return category; }
    public String getType() { return type; }
    public String getSource() { return source; }
}