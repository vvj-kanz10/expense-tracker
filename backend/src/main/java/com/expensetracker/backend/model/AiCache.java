package com.expensetracker.backend.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_cache",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "cache_key"}))
public class AiCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    // what this entry is for, e.g. "SPLIT:2026-09"
    @Column(name = "cache_key", nullable = false)
    private String cacheKey;

    // fingerprint of the exact data that was sent to the AI
    @Column(name = "input_hash", nullable = false)
    private String inputHash;

    @Column(name = "result_json", columnDefinition = "TEXT", nullable = false)
    private String resultJson;

    private LocalDateTime createdAt;

    public AiCache() {}

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getCacheKey() { return cacheKey; }
    public void setCacheKey(String cacheKey) { this.cacheKey = cacheKey; }
    public String getInputHash() { return inputHash; }
    public void setInputHash(String inputHash) { this.inputHash = inputHash; }
    public String getResultJson() { return resultJson; }
    public void setResultJson(String resultJson) { this.resultJson = resultJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}