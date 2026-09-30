package com.expensetracker.backend.statement;

import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class TransactionMapperTest {

    @Test
    void mapsParsedTransactionToEntityCorrectly() {
        // Arrange: a fake parsed transaction and a fake user
        ParsedTransaction parsed = new ParsedTransaction(
                LocalDate.of(2026, 7, 1),
                "UPI-SWIGGY-ORDER",
                new BigDecimal("450.00"),
                "DEBIT",
                new BigDecimal("10500.00")
        );

        User user = new User();
        user.setId(1L);
        user.setUsername("vishnu");

        // Act
        Transaction transaction = TransactionMapper.toEntity(parsed, user, "PDF");

        // Assert
        assertEquals(user, transaction.getUser());
        assertEquals(LocalDate.of(2026, 7, 1), transaction.getTransactionDate());
        assertEquals("UPI-SWIGGY-ORDER", transaction.getDescription());
        assertEquals(new BigDecimal("450.00"), transaction.getAmount());
        assertEquals("PDF", transaction.getSource());
        assertEquals("EXPENSE", transaction.getType()); // DEBIT should become EXPENSE
        assertNull(transaction.getCategory());
        assertNull(transaction.getMerchant());
    }
}