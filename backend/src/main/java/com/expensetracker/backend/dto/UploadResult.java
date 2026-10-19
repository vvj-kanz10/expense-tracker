package com.expensetracker.backend.dto;

import java.util.List;

public record UploadResult(
        List<TransactionResponse> transactions,
        int skippedDuplicates,
        List<PossibleMatch> possibleMatches
) {
    // A manually added entry and a freshly uploaded statement row that look like the same payment
    public record PossibleMatch(TransactionResponse manual, TransactionResponse statement) {}
}