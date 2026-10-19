package com.expensetracker.backend.dto;

public class PersonalTipDtos {

    // One tailored savings tip, already checked against the user's own numbers
    public record PersonalTip(
            String category,       // a real, non-fixed category from the user's profile
            String headline,       // short title
            String evidence,       // one sentence quoting the user's own numbers
            String action,         // the concrete step to take
            double monthlySaving,  // realistic rupees per month, capped by the category's spending
            String goalImpact      // links the saving to one of the user's goals (may be null)
    ) {}
}