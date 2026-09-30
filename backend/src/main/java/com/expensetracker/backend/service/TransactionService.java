package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.TransactionRequest;
import com.expensetracker.backend.dto.TransactionResponse;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import com.expensetracker.backend.statement.ParsedTransaction;
import com.expensetracker.backend.statement.TransactionMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.expensetracker.backend.statement.GeminiCategorizationService;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TransactionService {

    @Autowired
    private GeminiCategorizationService geminiCategorizationService;

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

        transaction.setDescription(request.getDescription());
        transaction.setMerchant(request.getMerchant());
        transaction.setAmount(request.getAmount());
        transaction.setTransactionDate(request.getTransactionDate());
        transaction.setCategory(request.getCategory());
        transaction.setType(request.getType());

        Transaction updated = transactionRepository.save(transaction);
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

    // Takes the raw parsed rows from PDF/CSV parsing, maps them to real Transaction
    // entities, saves them all, and returns them in the same DTO shape the frontend expects
    // Takes the raw parsed rows from PDF/CSV parsing, maps them to real Transaction
    // entities, saves them all, and returns them in the same DTO shape the frontend expects
    public List<TransactionResponse> saveParsedTransactions(String username, List<ParsedTransaction> parsedList, String source) {
        User user = getUserByUsername(username);

        List<Transaction> transactions = parsedList.stream()
                .map(parsed -> TransactionMapper.toEntity(parsed, user, source))
                .collect(Collectors.toList());

        List<String> descriptions = transactions.stream()
                .map(Transaction::getDescription)
                .collect(Collectors.toList());

        try {
            List<GeminiCategorizationService.CategorizationResult> results =
                    geminiCategorizationService.categorize(descriptions);
            for (int i = 0; i < transactions.size(); i++) {
                transactions.get(i).setCategory(results.get(i).category());
                transactions.get(i).setMerchant(results.get(i).merchant());
            }
        } catch (Exception e) {
            // Gemini failed even after retries (e.g. sustained high demand) — don't block
            // the upload. Fall back to explicit placeholder values so it's an obvious,
            // editable state in the UI rather than blank/null fields.
            System.err.println("Gemini categorization failed after retries, using fallback values: " + e.getMessage());
            for (Transaction t : transactions) {
                t.setCategory("Uncategorized");
                t.setMerchant("Unknown");
            }
        }

        List<Transaction> saved = transactionRepository.saveAll(transactions);

        return saved.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }
}