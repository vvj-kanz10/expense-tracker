package com.expensetracker.backend.statement;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
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

    // Matches dates like 02-08-2026, 02/08/2026, 02-08-26 or 02/08/26 at the start of a line
    private static final Pattern DATE_PATTERN =
            Pattern.compile("^(\\d{2}[-/]\\d{2}[-/](?:\\d{4}|\\d{2}))\\s+(.*)");

    // Matches numbers like 1,299.00 or 450.00
    private static final Pattern AMOUNT_PATTERN = Pattern.compile("[\\d,]+\\.\\d{2}");

    // Leftover column markers at the end of a description, like " - 0" or " -"
    private static final Pattern TRAILING_MARKER = Pattern.compile("\\s+-(\\s+0)?\\s*$");

    private static final DateTimeFormatter DATE_FORMAT_LONG = DateTimeFormatter.ofPattern("dd-MM-yyyy");
    private static final DateTimeFormatter DATE_FORMAT_SHORT = DateTimeFormatter.ofPattern("dd-MM-yy");

    // Lines that tell us the balance before the first transaction
    private static final String[] OPENING_KEYWORDS = {
            "opening balance", "balance as on", "balance b/f", "brought forward", "b/f"
    };

    // Description words that suggest money came IN (only used when no opening balance exists)
    private static final String[] CREDIT_HINTS = {
            "by transfer", "credit", "salary", "stipend", "deposit", "refund",
            "cashback", "received", "interest"
    };

    public String extractText(MultipartFile file) throws IOException {
        return extractText(file, null);
    }

    // password can be null/blank for normal (unlocked) PDFs
    public String extractText(MultipartFile file, String password) throws IOException {
        boolean hasPassword = password != null && !password.isBlank();
        try (PDDocument document = Loader.loadPDF(file.getBytes(), hasPassword ? password : "")) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        } catch (InvalidPasswordException e) {
            // No password given -> "password needed". Password given -> "password wrong".
            throw new PdfPasswordException(hasPassword);
        }
    }

    public List<ParsedTransaction> parseTransactions(String rawText) {
        List<ParsedTransaction> transactions = new ArrayList<>();

        String[] lines = rawText.split("\\r?\\n");

        // Look for an opening balance (header first, then anywhere in the document)
        BigDecimal previousBalance = findOpeningBalance(lines);

        int i = 0;

        while (i < lines.length) {
            String line = lines[i].trim();
            Matcher dateMatcher = DATE_PATTERN.matcher(line);

            if (!dateMatcher.matches()) {
                i++;
                continue; // not a transaction row, skip it
            }

            LocalDate date = parseDate(dateMatcher.group(1));
            StringBuilder remainder = new StringBuilder(dateMatcher.group(2));
            i++;

            // Keep pulling in following lines until we hit one that actually has numbers
            // (handles transactions that wrap across multiple lines in the PDF)
            while (i < lines.length && !AMOUNT_PATTERN.matcher(remainder.toString()).find()) {
                String nextLine = lines[i].trim();
                if (DATE_PATTERN.matcher(nextLine).matches()) {
                    break; // next transaction started before we found numbers - bail out
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
            description = TRAILING_MARKER.matcher(description).replaceAll("").trim();
            BigDecimal balance = parseAmount(numbers.get(numbers.size() - 1));

            BigDecimal amount;
            String type;

            if (numbers.size() == 1) {
                // Opening/Closing balance row - no transaction amount
                previousBalance = balance;
                continue;
            } else {
                amount = parseAmount(numbers.get(0));
                if (previousBalance == null) {
                    // No opening balance anywhere - guess from the description
                    type = guessTypeFromDescription(description);
                } else {
                    type = balance.compareTo(previousBalance) > 0 ? "CREDIT" : "DEBIT";
                }
            }

            transactions.add(new ParsedTransaction(date, description, amount, type, balance));
            previousBalance = balance;
        }

        return transactions;
    }

    public List<ParsedTransaction> parseTransactions(MultipartFile file) throws IOException {
        return parseTransactions(file, null);
    }

    public List<ParsedTransaction> parseTransactions(MultipartFile file, String password) throws IOException {
        String rawText = extractText(file, password);
        return parseTransactions(rawText);
    }

    // First looks above the first dated row (normal statements).
    // If nothing is found, searches the whole text for an "opening balance" line
    // (some banks print it after the first page of rows).
    private BigDecimal findOpeningBalance(String[] lines) {
        for (String raw : lines) {
            String line = raw.trim();
            if (DATE_PATTERN.matcher(line).matches()) {
                break; // reached the first transaction
            }
            BigDecimal found = balanceFromLine(line, OPENING_KEYWORDS);
            if (found != null) {
                return found;
            }
        }

        String[] strictKeywords = {"opening balance"};
        for (String raw : lines) {
            BigDecimal found = balanceFromLine(raw.trim(), strictKeywords);
            if (found != null) {
                return found;
            }
        }
        return null;
    }

    // If the line contains one of the keywords, returns the last amount on that line
    private BigDecimal balanceFromLine(String line, String[] keywords) {
        String lower = line.toLowerCase();
        for (String keyword : keywords) {
            if (lower.contains(keyword)) {
                Matcher m = AMOUNT_PATTERN.matcher(line);
                BigDecimal found = null;
                while (m.find()) {
                    found = parseAmount(m.group());
                }
                if (found != null) {
                    return found;
                }
            }
        }
        return null;
    }

    private String guessTypeFromDescription(String description) {
        String lower = description.toLowerCase();
        for (String hint : CREDIT_HINTS) {
            if (lower.contains(hint)) {
                return "CREDIT";
            }
        }
        return "DEBIT"; // most transactions are spending, so this is the safer default
    }

    // Handles both dd-MM-yyyy and dd-MM-yy
    private LocalDate parseDate(String raw) {
        String normalized = raw.replace('/', '-');
        int lastDash = normalized.lastIndexOf('-');
        boolean shortYear = normalized.length() - lastDash - 1 == 2;
        return LocalDate.parse(normalized, shortYear ? DATE_FORMAT_SHORT : DATE_FORMAT_LONG);
    }

    private BigDecimal parseAmount(String rawAmount) {
        return new BigDecimal(rawAmount.replace(",", ""));
    }
}