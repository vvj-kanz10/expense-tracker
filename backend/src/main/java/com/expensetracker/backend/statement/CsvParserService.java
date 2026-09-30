package com.expensetracker.backend.statement;

import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

@Service
public class CsvParserService {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("dd/MM/yyyy")
    );

    public List<ParsedTransaction> parseTransactions(MultipartFile file) throws IOException {
        List<ParsedTransaction> transactions = new ArrayList<>();

        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
             CSVParser csvParser = CSVFormat.DEFAULT.builder()
                     .setHeader()
                     .setSkipHeaderRecord(true)
                     .setIgnoreHeaderCase(true)
                     .setTrim(true)
                     .build()
                     .parse(reader)) {

            // Detect which format this CSV uses based on available headers
            boolean hasDebitCredit = csvParser.getHeaderNames().contains("Debit")
                    && csvParser.getHeaderNames().contains("Credit");
            boolean hasAmount = csvParser.getHeaderNames().contains("Amount");

            if (!hasDebitCredit && !hasAmount) {
                throw new IllegalArgumentException(
                        "CSV must contain either Debit/Credit columns or a single Amount column");
            }

            for (CSVRecord record : csvParser) {
                LocalDate date = parseDate(record.get("Date").trim());
                String description = record.get("Description").trim();

                BigDecimal amount;
                String type;

                if (hasDebitCredit) {
                    String debitStr = record.get("Debit").trim();
                    String creditStr = record.get("Credit").trim();

                    if (!debitStr.isEmpty()) {
                        amount = parseAmount(debitStr);
                        type = "DEBIT";
                    } else if (!creditStr.isEmpty()) {
                        amount = parseAmount(creditStr);
                        type = "CREDIT";
                    } else {
                        continue; // row has neither, skip (e.g. malformed row)
                    }
                } else {
                    BigDecimal signedAmount = parseAmount(record.get("Amount").trim());
                    if (signedAmount.compareTo(BigDecimal.ZERO) < 0) {
                        amount = signedAmount.abs();
                        type = "DEBIT";
                    } else {
                        amount = signedAmount;
                        type = "CREDIT";
                    }
                }

                BigDecimal balance = null;
                if (csvParser.getHeaderNames().contains("Balance")) {
                    String balanceStr = record.get("Balance").trim();
                    if (!balanceStr.isEmpty()) {
                        balance = parseAmount(balanceStr);
                    }
                }

                transactions.add(new ParsedTransaction(date, description, amount, type, balance));
            }
        }

        return transactions;
    }

    private LocalDate parseDate(String dateString) {
        for (DateTimeFormatter formatter : DATE_FORMATS) {
            try {
                return LocalDate.parse(dateString, formatter);
            } catch (DateTimeParseException e) {
                // try next format
            }
        }
        throw new IllegalArgumentException("Unrecognized date format: " + dateString);
    }

    private BigDecimal parseAmount(String rawAmount) {
        return new BigDecimal(rawAmount.replace(",", "").replace("+", ""));
    }
}