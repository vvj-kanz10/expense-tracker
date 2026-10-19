package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.TransactionRequest;
import com.expensetracker.backend.dto.TransactionResponse;
import com.expensetracker.backend.dto.UploadResult;
import com.expensetracker.backend.model.CategoryRule;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.CashSplitRepository;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import com.expensetracker.backend.statement.ParsedTransaction;
import com.expensetracker.backend.statement.TransactionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.expensetracker.backend.statement.GeminiCategorizationService;
import com.expensetracker.backend.statement.DefaultCategoryRules;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    // name@bank style UPI IDs (also matches ones we already masked, so masking twice is harmless)
    private static final Pattern UPI_ID = Pattern.compile("([A-Za-z0-9._*-]+)@([A-Za-z0-9.-]+)");
    // account / reference / phone numbers: 5 or more digits in a row
    private static final Pattern LONG_DIGITS = Pattern.compile("\\d{5,}");

    @Autowired
    private GeminiCategorizationService geminiCategorizationService;

    @Autowired
    private CategoryRuleService categoryRuleService;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private CashSplitRepository cashSplitRepository;

    // Helper: find the logged-in user by username (comes from JWT via SecurityContext)
    private User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    // Helper: convert a Transaction entity into a safe response DTO
    private TransactionResponse toResponse(Transaction t) {
        return new TransactionResponse(
                t.getId(),
                t.getDescription(),
                t.getMerchant(),
                t.getAmount(),
                t.getTransactionDate(),
                t.getCategory(),
                t.getType(),
                t.getSource(),
                t.getBalance()
        );
    }

    public TransactionResponse createTransaction(String username, TransactionRequest request) {
        User user = getUserByUsername(username);

        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setDescription(maskForStorage(request.getDescription()));
        transaction.setMerchant(request.getMerchant());
        transaction.setAmount(request.getAmount());
        transaction.setTransactionDate(request.getTransactionDate());
        transaction.setCategory(request.getCategory());
        transaction.setType(request.getType());
        transaction.setSource("MANUAL"); // created directly via API, not CSV/PDF import

        Transaction saved = transactionRepository.save(transaction);
        return toResponse(saved);
    }

    public List<TransactionResponse> getAllTransactions(String username) {
        User user = getUserByUsername(username);

        return transactionRepository.findByUserId(user.getId())
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public TransactionResponse updateTransaction(String username, Long transactionId, TransactionRequest request) {
        User user = getUserByUsername(username);

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        // Security check: make sure this transaction actually belongs to the logged-in user
        if (!transaction.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("You are not allowed to edit this transaction");
        }

        // Remember what it was before, so we can tell if the user corrected category/merchant
        String oldCategory = transaction.getCategory();
        String oldMerchant = transaction.getMerchant();

        transaction.setDescription(maskForStorage(request.getDescription()));
        transaction.setMerchant(request.getMerchant());
        transaction.setAmount(request.getAmount());
        transaction.setTransactionDate(request.getTransactionDate());
        transaction.setCategory(request.getCategory());
        transaction.setType(request.getType());

        Transaction updated = transactionRepository.save(transaction);

        // Learn from the correction: only when category or merchant really changed
        boolean corrected = !Objects.equals(oldCategory, updated.getCategory())
                || !Objects.equals(oldMerchant, updated.getMerchant());
        if (corrected) {
            categoryRuleService.saveRule(user, updated.getDescription(),
                    updated.getCategory(), updated.getMerchant());
        }

        return toResponse(updated);
    }

    public void deleteTransaction(String username, Long transactionId) {
        User user = getUserByUsername(username);

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException("Transaction not found"));

        if (!transaction.getUser().getId().equals(user.getId())) {
            throw new RuntimeException("You are not allowed to delete this transaction");
        }

        cashSplitRepository.deleteByTransactionId(transactionId);
        transactionRepository.delete(transaction);
    }

    // Takes the raw parsed rows from PDF/CSV parsing, skips any that are already in the
    // database, then categorizes the new ones in three layers:
    //   1) the user's own saved rules  2) built-in merchant rules  3) Gemini for the rest
    // Categorizing uses the FULL description (UPI IDs often contain the merchant name).
    // Only right before saving do we mask the description, so the database never holds
    // full UPI IDs or long account/reference numbers.
    public UploadResult saveParsedTransactions(String username, List<ParsedTransaction> parsedList, String source) {
        User user = getUserByUsername(username);

        if (parsedList.isEmpty()) {
            throw new RuntimeException("No transactions could be read from this file. Check that it is a supported statement format.");
        }

        // Drop rows we already have BEFORE categorizing (saves API calls and avoids double counting)
        List<ParsedTransaction> fresh = removeDuplicates(user, parsedList);
        int skipped = parsedList.size() - fresh.size();

        if (fresh.isEmpty()) {
            return new UploadResult(List.of(), skipped, List.of());
        }

        List<Transaction> transactions = fresh.stream()
                .map(parsed -> TransactionMapper.toEntity(parsed, user, source))
                .collect(Collectors.toList());

        Map<String, CategoryRule> userRules = categoryRuleService.loadRules(user);
        List<Transaction> needsGemini = new ArrayList<>();
        int byUserRule = 0;
        int byBuiltInRule = 0;

        for (Transaction t : transactions) {
            // Layer 1: the user's own corrections always win.
            // Rules are saved from stored (masked) descriptions, so try the masked text first,
            // then the full text so rules saved before masking existed still match.
            CategoryRule rule = categoryRuleService.findMatch(userRules, maskForStorage(t.getDescription()));
            if (rule == null) {
                rule = categoryRuleService.findMatch(userRules, t.getDescription());
            }
            if (rule != null) {
                t.setCategory(rule.getCategory());
                String merchant = rule.getMerchant();
                t.setMerchant(merchant != null && !merchant.isBlank() ? merchant : "Unknown");
                byUserRule++;
                continue;
            }

            // Layer 2: built-in rules for common merchants (uses the full description)
            DefaultCategoryRules.Match match = DefaultCategoryRules.find(t.getDescription());
            if (match != null) {
                t.setCategory(match.category());
                t.setMerchant(match.merchant());
                byBuiltInRule++;
                continue;
            }

            // Layer 3: leave it for Gemini
            needsGemini.add(t);
        }

        System.out.println("Categorization: " + byUserRule + " by user rules, "
                + byBuiltInRule + " by built-in rules, " + needsGemini.size() + " sent to Gemini");

        if (!needsGemini.isEmpty()) {
            needsGemini.forEach(t -> System.out.println("  -> to Gemini: " + maskForStorage(t.getDescription())));
            List<String> descriptions = needsGemini.stream()
                    .map(t -> maskForAi(t.getDescription()))
                    .collect(Collectors.toList());

            try {
                List<GeminiCategorizationService.CategorizationResult> results =
                        geminiCategorizationService.categorize(descriptions);
                for (int i = 0; i < needsGemini.size(); i++) {
                    needsGemini.get(i).setCategory(results.get(i).category());
                    needsGemini.get(i).setMerchant(results.get(i).merchant());
                }
            } catch (Exception e) {
                // Gemini failed even after retries (e.g. sustained high demand) — don't block
                // the upload. Fall back to explicit placeholder values so it's an obvious,
                // editable state in the UI rather than blank/null fields.
                System.err.println("Gemini categorization failed after retries, using fallback values: " + e.getMessage());
                for (Transaction t : needsGemini) {
                    t.setCategory("Uncategorized");
                    t.setMerchant("Unknown");
                }
            }
        }

        // Categorizing is finished, so now hide the sensitive parts before anything is stored
        for (Transaction t : transactions) {
            t.setDescription(maskForStorage(t.getDescription()));
        }

        List<Transaction> saved = transactionRepository.saveAll(transactions);

        List<TransactionResponse> responses = saved.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        List<UploadResult.PossibleMatch> possibleMatches = findPossibleManualMatches(user, saved);

        return new UploadResult(responses, skipped, possibleMatches);
    }

    // Removes UPI IDs (name@bank) and long digit strings (account/reference numbers)
    // before text is sent to Gemini. Gemini never sees any part of them.
    private String maskForAi(String description) {
        if (description == null) return "";
        return description
                .replaceAll("[A-Za-z0-9._-]+@[A-Za-z0-9.-]+", "")
                .replaceAll("\\d{5,}", "")
                .replaceAll("/{2,}", "/")
                .replaceAll("[/\\s]+$", "")
                .trim();
    }

    // Partly hides sensitive details for the database:
    //   rahul123@oksbi  ->  ra****@oksbi   (first 2 letters + bank handle kept)
    //   123456789012    ->  ****9012       (last 4 digits kept)
    // The result is the same no matter how many times it is applied, so old and new
    // text can be compared safely (duplicate detection and learned rules rely on that).
    private String maskForStorage(String description) {
        if (description == null) return null;

        Matcher upi = UPI_ID.matcher(description);
        StringBuilder afterUpi = new StringBuilder();
        while (upi.find()) {
            String local = upi.group(1);
            String keep = local.substring(0, Math.min(2, local.length()));
            upi.appendReplacement(afterUpi, Matcher.quoteReplacement(keep + "****@" + upi.group(2)));
        }
        upi.appendTail(afterUpi);

        Matcher digits = LONG_DIGITS.matcher(afterUpi.toString());
        StringBuilder result = new StringBuilder();
        while (digits.find()) {
            String run = digits.group();
            digits.appendReplacement(result,
                    Matcher.quoteReplacement("****" + run.substring(run.length() - 4)));
        }
        digits.appendTail(result);

        return result.toString();
    }

    // How many days apart a manual entry and a statement row may be and still look like
    // the same payment (the bank often posts a day or two after the real payment date)
    private static final int MATCH_WINDOW_DAYS = 2;

    // Looks for manual entries that could be the same payment as a freshly uploaded row:
    // same type, same amount, and a date within MATCH_WINDOW_DAYS. Each manual entry is
    // matched with at most one statement row (the closest date wins). Nothing is changed
    // here; the user decides in the UI.
    private List<UploadResult.PossibleMatch> findPossibleManualMatches(User user, List<Transaction> newlySaved) {
        List<Transaction> manualRows = transactionRepository.findByUserId(user.getId()).stream()
                .filter(t -> "MANUAL".equals(t.getSource()))
                .collect(Collectors.toList());
        List<UploadResult.PossibleMatch> matches = new ArrayList<>();
        if (manualRows.isEmpty()) {
            return matches;
        }
        Set<Long> usedManualIds = new HashSet<>();
        for (Transaction statementRow : newlySaved) {
            Transaction best = null;
            long bestGap = Long.MAX_VALUE;
            for (Transaction manual : manualRows) {
                if (usedManualIds.contains(manual.getId())) continue;
                if (!Objects.equals(manual.getType(), statementRow.getType())) continue;
                if (manual.getAmount().compareTo(statementRow.getAmount()) != 0) continue;
                long gap = Math.abs(ChronoUnit.DAYS.between(
                        manual.getTransactionDate(), statementRow.getTransactionDate()));
                if (gap <= MATCH_WINDOW_DAYS && gap < bestGap) {
                    best = manual;
                    bestGap = gap;
                }
            }
            if (best != null) {
                usedManualIds.add(best.getId());
                matches.add(new UploadResult.PossibleMatch(toResponse(best), toResponse(statementRow)));
            }
        }
        return matches;
    }

    /* ---------- duplicate detection ---------- */

    // A parsed row counts as a duplicate if the database already holds a row with the same
    // date + amount + description + running balance. Rows saved before the balance column
    // existed (balance = null) are matched on date + amount + description only.
    // Matching is by count, so two genuine identical rows in one statement are both kept
    // unless the database already holds both.
    private List<ParsedTransaction> removeDuplicates(User user, List<ParsedTransaction> parsedList) {
        Map<String, Integer> fullCounts = new HashMap<>();  // existing rows that have a balance
        Map<String, Integer> baseCounts = new HashMap<>();  // existing rows without a balance

        for (Transaction existing : transactionRepository.findByUserId(user.getId())) {
            String base = baseKey(existing.getTransactionDate(), existing.getAmount(), existing.getDescription());
            if (existing.getBalance() != null) {
                fullCounts.merge(base + "|" + normalizeAmount(existing.getBalance()), 1, Integer::sum);
            } else {
                baseCounts.merge(base, 1, Integer::sum);
            }
        }

        List<ParsedTransaction> fresh = new ArrayList<>();

        for (ParsedTransaction parsed : parsedList) {
            String base = baseKey(parsed.date(), parsed.amount(), parsed.description());
            boolean duplicate;

            if (parsed.balance() != null) {
                String full = base + "|" + normalizeAmount(parsed.balance());
                duplicate = consume(fullCounts, full) || consume(baseCounts, base);
            } else {
                duplicate = consume(baseCounts, base);
            }

            if (!duplicate) {
                fresh.add(parsed);
            }
        }

        return fresh;
    }

    // Uses up one remembered match, if there is one left
    private boolean consume(Map<String, Integer> counts, String key) {
        int remaining = counts.getOrDefault(key, 0);
        if (remaining <= 0) {
            return false;
        }
        counts.put(key, remaining - 1);
        return true;
    }

    // The description is masked first, so a new statement row (full text) and a stored row
    // (masked text) produce the same key.
    private String baseKey(LocalDate date, BigDecimal amount, String description) {
        return date + "|" + normalizeAmount(amount) + "|" + normalizeText(maskForStorage(description));
    }

    // 480.00 and 480.0 should count as the same number
    private String normalizeAmount(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private String normalizeText(String text) {
        return text == null ? "" : text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}