package com.expensetracker.backend.service;

import com.expensetracker.backend.model.AiCache;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.AiCacheRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.Optional;

// Remembers AI answers so the same question is not sent to Gemini twice.
// A saved answer is only reused when the input fingerprint is identical.
// Any problem here is swallowed: the cache can never break the real feature.
@Service
public class AiCacheService {

    @Autowired
    private AiCacheRepository cacheRepository;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Turns the input text into a short fixed-length fingerprint
    public static String hash(String text) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : bytes) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public <T> Optional<T> get(User user, String cacheKey, String inputHash, TypeReference<T> type) {
        try {
            return cacheRepository.findByUserAndCacheKey(user, cacheKey)
                    .filter(entry -> entry.getInputHash().equals(inputHash))
                    .map(entry -> {
                        try {
                            return objectMapper.readValue(entry.getResultJson(), type);
                        } catch (Exception e) {
                            return null; // unreadable entry counts as a miss
                        }
                    });
        } catch (Exception e) {
            System.err.println("AI cache read failed: " + e.getMessage());
            return Optional.empty();
        }
    }

    public void put(User user, String cacheKey, String inputHash, Object value) {
        try {
            AiCache entry = cacheRepository.findByUserAndCacheKey(user, cacheKey)
                    .orElseGet(AiCache::new);
            entry.setUser(user);
            entry.setCacheKey(cacheKey);
            entry.setInputHash(inputHash);
            entry.setResultJson(objectMapper.writeValueAsString(value));
            entry.setCreatedAt(LocalDateTime.now());
            cacheRepository.save(entry);
        } catch (Exception e) {
            System.err.println("AI cache write failed: " + e.getMessage());
        }
    }
}