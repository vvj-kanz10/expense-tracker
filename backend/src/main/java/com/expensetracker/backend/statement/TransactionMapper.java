package com.expensetracker.backend.statement;

import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;

public class TransactionMapper {

    public static Transaction toEntity(ParsedTransaction parsed, User user, String source) {
        Transaction transaction = new Transaction();

        transaction.setUser(user);
        transaction.setTransactionDate(parsed.date());
        transaction.setDescription(parsed.description());
        transaction.setAmount(parsed.amount());
        transaction.setSource(source);

        transaction.setType(parsed.type().equalsIgnoreCase("DEBIT") ? "EXPENSE" : "INCOME");

        // category and merchant set separately after mapping
        return transaction;
    }
}