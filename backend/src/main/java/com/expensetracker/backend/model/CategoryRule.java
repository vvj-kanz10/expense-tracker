package com.expensetracker.backend.model;

import jakarta.persistence.*;

@Entity
@Table(name = "category_rules",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "match_text"}))
public class CategoryRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    // the cleaned-up description this rule matches (digits and symbols removed)
    @Column(name = "match_text", nullable = false)
    private String matchText;

    @Column(nullable = false)
    private String category;

    private String merchant;

    public CategoryRule() {}

    public CategoryRule(User user, String matchText, String category, String merchant) {
        this.user = user;
        this.matchText = matchText;
        this.category = category;
        this.merchant = merchant;
    }

    public Long getId() { return id; }
    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }
    public String getMatchText() { return matchText; }
    public void setMatchText(String matchText) { this.matchText = matchText; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getMerchant() { return merchant; }
    public void setMerchant(String merchant) { this.merchant = merchant; }
}