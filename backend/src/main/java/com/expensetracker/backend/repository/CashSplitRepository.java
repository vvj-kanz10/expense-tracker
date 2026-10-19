package com.expensetracker.backend.repository;

import com.expensetracker.backend.model.CashSplit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface CashSplitRepository extends JpaRepository<CashSplit, Long> {

    List<CashSplit> findByUserId(Long userId);

    @Transactional
    void deleteByTransactionId(Long transactionId);
}