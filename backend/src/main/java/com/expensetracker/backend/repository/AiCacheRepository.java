package com.expensetracker.backend.repository;

import com.expensetracker.backend.model.AiCache;
import com.expensetracker.backend.model.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AiCacheRepository extends JpaRepository<AiCache, Long> {
    Optional<AiCache> findByUserAndCacheKey(User user, String cacheKey);
}