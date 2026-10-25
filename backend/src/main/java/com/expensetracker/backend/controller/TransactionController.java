package com.expensetracker.backend.controller;

import com.expensetracker.backend.dto.TransactionRequest;
import com.expensetracker.backend.dto.TransactionResponse;
import com.expensetracker.backend.dto.UploadResult;
import com.expensetracker.backend.service.TransactionService;
import com.expensetracker.backend.statement.CsvParserService;
import com.expensetracker.backend.statement.ParsedTransaction;
import com.expensetracker.backend.statement.PdfParserService;
import com.expensetracker.backend.statement.PdfPasswordException;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    @Autowired
    private TransactionService transactionService;

    @Autowired
    private CsvParserService csvParserService;

    @Autowired
    private PdfParserService pdfParserService;

    @PostMapping
    public ResponseEntity<?> createTransaction(@Valid @RequestBody TransactionRequest request,
                                               Authentication authentication) {
        try {
            String username = authentication.getName();
            TransactionResponse response = transactionService.createTransaction(username, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<?> getAllTransactions(Authentication authentication) {
        try {
            String username = authentication.getName();
            List<TransactionResponse> transactions = transactionService.getAllTransactions(username);
            return ResponseEntity.ok(transactions);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateTransaction(@PathVariable Long id,
                                               @Valid @RequestBody TransactionRequest request,
                                               Authentication authentication) {
        try {
            String username = authentication.getName();
            TransactionResponse response = transactionService.updateTransaction(username, id, request);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteTransaction(@PathVariable Long id,
                                               Authentication authentication) {
        try {
            String username = authentication.getName();
            transactionService.deleteTransaction(username, id);
            return ResponseEntity.ok("Transaction deleted successfully");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // Which other transactions would the edited one's category/merchant apply to?
    @GetMapping("/{id}/similar")
    public ResponseEntity<?> getSimilarTransactions(@PathVariable Long id,
                                                    Authentication authentication) {
        try {
            String username = authentication.getName();
            List<TransactionResponse> similar = transactionService.findSimilarTransactions(username, id);
            return ResponseEntity.ok(similar);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // User said Yes in the popup: apply category + merchant to those similar rows
    @PostMapping("/{id}/apply-to-similar")
    public ResponseEntity<?> applyToSimilar(@PathVariable Long id,
                                            Authentication authentication) {
        try {
            String username = authentication.getName();
            int updated = transactionService.applyToSimilar(username, id);
            return ResponseEntity.ok(Map.of("updated", updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadStatement(@RequestParam("file") MultipartFile file,
                                             @RequestParam(value = "password", required = false) String password,
                                             Authentication authentication) {
        try {
            String username = authentication.getName();
            String filename = file.getOriginalFilename();

            List<ParsedTransaction> parsed;
            String source;

            if (filename != null && filename.toLowerCase().endsWith(".csv")) {
                parsed = csvParserService.parseTransactions(file);
                source = "CSV";
            } else if (filename != null && filename.toLowerCase().endsWith(".pdf")) {
                parsed = pdfParserService.parseTransactions(file, password);
                source = "PDF";
            } else {
                return ResponseEntity.badRequest()
                        .body("Unsupported file type. Please upload a CSV or PDF.");
            }

            UploadResult result =
                    transactionService.saveParsedTransactions(username, parsed, source);

            return ResponseEntity.ok(result);

        } catch (PdfPasswordException e) {
            // Locked PDF: tell the frontend whether the password is missing or wrong
            String code = e.isWrongPassword() ? "PDF_PASSWORD_WRONG" : "PDF_PASSWORD_REQUIRED";
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                    .body(Map.of("code", code, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body("Failed to process file: " + e.getMessage());
        }
    }
}