package com.expensetracker.backend.dto;

import java.util.List;

public record UploadResult(
        List<TransactionResponse> transactions,
        int skippedDuplicates
) {
}