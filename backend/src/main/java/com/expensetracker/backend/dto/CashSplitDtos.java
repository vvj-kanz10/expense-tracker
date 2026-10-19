package com.expensetracker.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public class CashSplitDtos {

    // One part of a withdrawal: where that part of the cash went
    public record SplitItem(String category, BigDecimal amount) {}

    // What the frontend sends: the full list of parts for one withdrawal (empty list = clear)
    public record SplitRequest(List<SplitItem> splits) {}

    // What the frontend gets back
    public record SplitResponse(Long id, Long transactionId, String category, BigDecimal amount) {}
}