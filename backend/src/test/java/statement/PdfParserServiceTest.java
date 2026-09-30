package com.expensetracker.backend.statement;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertEquals;

class PdfParserServiceTest {

    @Test
    void extractText_shouldReturnRawTextFromDummyStatement() throws IOException {
        PdfParserService parserService = new PdfParserService();

        InputStream inputStream = getClass().getClassLoader()
                .getResourceAsStream("dummy_bank_statement.pdf");
        assertNotNull(inputStream, "dummy_bank_statement.pdf not found in test resources");

        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "dummy_bank_statement.pdf",
                "application/pdf",
                inputStream
        );

        String extractedText = parserService.extractText(mockFile);

        System.out.println("----- EXTRACTED TEXT START -----");
        System.out.println(extractedText);
        System.out.println("----- EXTRACTED TEXT END -----");

        assertNotNull(extractedText);
        assertTrue(extractedText.contains("SAMPLE NATIONAL BANK"));
    }

    @Test
    void parseTransactions_shouldReturnStructuredTransactions() throws IOException {
        PdfParserService parserService = new PdfParserService();

        InputStream inputStream = getClass().getClassLoader()
                .getResourceAsStream("dummy_bank_statement.pdf");
        assertNotNull(inputStream, "dummy_bank_statement.pdf not found in test resources");

        MockMultipartFile mockFile = new MockMultipartFile(
                "file",
                "dummy_bank_statement.pdf",
                "application/pdf",
                inputStream
        );

        String extractedText = parserService.extractText(mockFile);
        List<ParsedTransaction> transactions = parserService.parseTransactions(extractedText);

        System.out.println("----- PARSED TRANSACTIONS START -----");
        for (ParsedTransaction txn : transactions) {
            System.out.println(txn);
        }
        System.out.println("----- PARSED TRANSACTIONS END -----");
        System.out.println("Total transactions parsed: " + transactions.size());

        // We expect 16 real transactions (Opening/Closing Balance rows are excluded)
        assertEquals(16, transactions.size());
    }
}