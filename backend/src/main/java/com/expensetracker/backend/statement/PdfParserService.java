package com.expensetracker.backend.statement;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PdfParserService {

    // Matches dates like 02-08-2026 or 02/08/2026 at the start of a line
    private static final Pattern DATE_PATTERN = Pattern.compile("^(\\d{2}[-/]\\d{2}[-/]\\d{4})\\s+(.*)");

    // Matches numbers like 1,299.00 or 450.00
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("[\\d,]+\\.\\d{2}");

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd-MM-yyyy");

    public String extractText(MultipartFile file) throws IOException {
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    public List<ParsedTransaction> parseTransactions(String rawText) {
        List<ParsedTransaction> transactions = new ArrayList<>();
        BigDecimal previousBalance = null;

        String[] lines = rawText.split("\\r?\\n");
        int i = 0;

        while (i < lines.length) {
            String line = lines[i].trim();
            Matcher dateMatcher = DATE_PATTERN.matcher(line);

            if (!dateMatcher.matches()) {
                i++;
                continue; // not a transaction row, skip it
            }

            LocalDate date = LocalDate.parse(normalizeDate(dateMatcher.group(1)), DATE_FORMAT);
            StringBuilder remainder = new StringBuilder(dateMatcher.group(2));
            i++;

            // Keep pulling in following lines until we hit one that actually has numbers
            // (handles transactions that wrap across multiple lines in the PDF)
            while (i < lines.length && !AMOUNT_PATTERN.matcher(remainder.toString()).find()) {
                String nextLine = lines[i].trim();
                if (DATE_PATTERN.matcher(nextLine).matches()) {
                    break; // next transaction started before we found numbers — bail out
                }
                remainder.append(" ").append(nextLine);
                i++;
            }

            String remainderStr = remainder.toString();
            Matcher amountMatcher = AMOUNT_PATTERN.matcher(remainderStr);
            List<String> numbers = new ArrayList<>();
            int firstNumberIndex = -1;

            while (amountMatcher.find()) {
                if (firstNumberIndex == -1) {
                    firstNumberIndex = amountMatcher.start();
                }
                numbers.add(amountMatcher.group());
            }

            if (numbers.isEmpty()) {
                continue; // malformed row, skip
            }

            String description = remainderStr.substring(0, firstNumberIndex).trim();
            BigDecimal balance = parseAmount(numbers.get(numbers.size() - 1));

            BigDecimal amount;
            String type;

            if (numbers.size() == 1) {
                // Opening/Closing balance row - no transaction amount
                previousBalance = balance;
                continue;
            } else {
                amount = parseAmount(numbers.get(0));
                type = (previousBalance == null || balance.compareTo(previousBalance) > 0)
                        ? "CREDIT"
                        : "DEBIT";
            }

            transactions.add(new ParsedTransaction(date, description, amount, type, balance));
            previousBalance = balance;
        }

        return transactions;
    }

    public List<ParsedTransaction> parseTransactions(MultipartFile file) throws IOException {
        String rawText = extractText(file);
        return parseTransactions(rawText);
    }

    private String normalizeDate(String raw) {
        return raw.replace('/', '-');
    }

    private BigDecimal parseAmount(String rawAmount) {
        return new BigDecimal(rawAmount.replace(",", ""));
    }
}