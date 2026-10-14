package com.expensetracker.backend.statement;

public class PdfPasswordException extends RuntimeException {

    private final boolean wrongPassword;

    public PdfPasswordException(boolean wrongPassword) {
        super(wrongPassword ? "Incorrect PDF password" : "This PDF is password protected");
        this.wrongPassword = wrongPassword;
    }

    public boolean isWrongPassword() {
        return wrongPassword;
    }
}