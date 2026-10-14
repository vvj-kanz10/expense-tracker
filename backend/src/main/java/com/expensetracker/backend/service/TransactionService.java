package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.TransactionRequest;
import com.expensetracker.backend.dto.TransactionResponse;
import com.expensetracker.backend.dto.UploadResult;
import com.expensetracker.backend.model.CategoryRule;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    @Autowired
    private GeminiCategorizationService geminiCategorizationService;

    @Autowired
    private CategoryRuleService categoryRuleService;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

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
                t.getSource()
        );
    }

    public TransactionResponse createTransaction(String username, TransactionRequest request) {
        User user = getUserByUsername(username);

        Transaction transaction = new Transaction();
        transaction.setUser(user);
        transaction.setDescription(request.getDescription());
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

        transaction.setDescription(request.getDescription());
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

        transactionRepository.delete(transaction);
    }

    // Takes the raw parsed rows from PDF/CSV parsing, skips any that are already in the
    // database, applies the user's saved rules, categorizes the remaining rows with Gemini,
    // saves everything, and reports how many duplicates were skipped.
    // Takes the raw parsed rows from PDF/CSV parsing, skips any that are already in the
    // database, then categorizes the new ones in three layers:
    //   1) the user's own saved rules  2) built-in merchant rules  3) Gemini for the rest
    public UploadResult saveParsedTransactions(String username, List<ParsedTransaction> parsedList, String source) {
        User user = getUserByUsername(username);

        if (parsedList.isEmpty()) {
            throw new RuntimeException("No transactions could be read from this file. Check that it is a supported statement format.");
        }

        // Drop rows we already have BEFORE categorizing (saves API calls and avoids double counting)
        List<ParsedTransaction> fresh = removeDuplicates(user, parsedList);
        int skipped = parsedList.size() - fresh.size();

        if (fresh.isEmpty()) {
            return new UploadResult(List.of(), skipped);
        }

        List<Transaction> transactions = fresh.stream()
                .map(parsed -> TransactionMapper.toEntity(parsed, user, source))
                .collect(Collectors.toList());

        Map<String, CategoryRule> userRules = categoryRuleService.loadRules(user);
        List<Transaction> needsGemini = new ArrayList<>();
        int byUserRule = 0;
        int byBuiltInRule = 0;

        for (Transaction t : transactions) {
            // Layer 1: the user's own corrections always win
            CategoryRule rule = categoryRuleService.findMatch(userRules, t.getDescription());
            if (rule != null) {
                t.setCategory(rule.getCategory());
                String merchant = rule.getMerchant();
                t.setMerchant(merchant != null && !merchant.isBlank() ? merchant : "Unknown");
                byUserRule++;
                continue;
            }

            // Layer 2: built-in rules for common merchants
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
            needsGemini.forEach(t -> System.out.println("  -> to Gemini: " + t.getDescription()));
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

        List<Transaction> saved = transactionRepository.saveAll(transactions);

        List<TransactionResponse> responses = saved.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());

        return new UploadResult(responses, skipped);
    }

    // Removes UPI IDs (name@bank) and long digit strings (account/reference numbers)
    // before text is sent to Gemini. The saved transaction keeps its full description.
    private String maskForAi(String description) {
        if (description == null) return "";
        return description
                .replaceAll("[A-Za-z0-9._-]+@[A-Za-z0-9.-]+", "")
                .replaceAll("\\d{5,}", "")
                .replaceAll("/{2,}", "/")
                .replaceAll("[/\\s]+$", "")
                .trim();
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

    private String baseKey(LocalDate date, BigDecimal amount, String description) {
        return date + "|" + normalizeAmount(amount) + "|" + normalizeText(description);
    }

    // 480.00 and 480.0 should count as the same number
    private String normalizeAmount(BigDecimal value) {
        return value == null ? "" : value.stripTrailingZeros().toPlainString();
    }

    private String normalizeText(String text) {
        return text == null ? "" : text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}