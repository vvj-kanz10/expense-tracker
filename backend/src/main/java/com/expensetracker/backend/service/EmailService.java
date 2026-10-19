package com.expensetracker.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    // Sends a short welcome email. If sending fails for any reason (no internet, wrong
    // password, Gmail limit), it only logs the problem so registration itself never fails.
    public void sendWelcomeEmail(String toEmail, String username) {
        if (toEmail == null || toEmail.isBlank()) {
            return;
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(toEmail);
            message.setSubject("Welcome to MoneyTrack AI");
            message.setText(
                    "Hi " + username + ",\n\n"
                            + "Your MoneyTrack account is ready.\n\n"
                            + "Upload a bank statement (CSV or PDF) and we will sort your spending, "
                            + "track your budgets and goals, and show you where your money goes.\n\n"
                            + "Your privacy: UPI IDs and account numbers are hidden before they are "
                            + "stored, and are never sent to the AI.\n\n"
                            + "Happy tracking!\n"
                            + "Team MoneyTrack AI");
            mailSender.send(message);
        } catch (Exception e) {
            System.err.println("Welcome email could not be sent: " + e.getMessage());
        }
    }
}