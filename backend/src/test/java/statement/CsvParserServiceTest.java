package com.expensetracker.backend.statement;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class CsvParserServiceTest {

    @Test
    void parseTransactions_shouldHandleDebitCreditFormat() throws IOException {
        CsvParserService parserService = new CsvParserService();

        InputStream inputStream = getClass().getClassLoader()
                .getResourceAsStream("dummy_statement_debit_credit.csv");
        assertNotNull(inputStream, "dummy_statement_debit_credit.csv not found in test resources");

        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "dummy_statement_debit_credit.csv",
                "text/csv",
                inputStream
        );

        List<ParsedTransaction> transactions = parserService.parseTransactions(mockFile);

        System.out.println("----- DEBIT/CREDIT CSV RESULTS START -----");
        for (ParsedTransaction txn : transactions) {
            System.out.println(txn);
        }
        System.out.println("----- DEBIT/CREDIT CSV RESULTS END -----");

        assertEquals(4, transactions.size());
    }

    @Test
    void parseTransactions_shouldHandleSignedAmountFormat() throws IOException {
        CsvParserService parserService = new CsvParserService();

        InputStream inputStream = getClass().getClassLoader()
                .getResourceAsStream("dummy_statement_amount.csv");
        assertNotNull(inputStream, "dummy_statement_amount.csv not found in test resources");

        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "dummy_statement_amount.csv",
                "text/csv",
                inputStream
        );

        List<ParsedTransaction> transactions = parserService.parseTransactions(mockFile);

        System.out.println("----- SIGNED AMOUNT CSV RESULTS START -----");
        for (ParsedTransaction txn : transactions) {
            System.out.println(txn);
        }
        System.out.println("----- SIGNED AMOUNT CSV RESULTS END -----");

        assertEquals(4, transactions.size());
    }
}