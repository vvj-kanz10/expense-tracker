package com.expensetracker.backend.service;

import com.expensetracker.backend.dto.AssistantDtos.AskResponse;
import com.expensetracker.backend.dto.AssistantDtos.Intent;
import com.expensetracker.backend.dto.AssistantDtos.ParsedQuestion;
import com.expensetracker.backend.dto.AssistantDtos.Row;
import com.expensetracker.backend.model.Transaction;
import com.expensetracker.backend.model.User;
import com.expensetracker.backend.repository.TransactionRepository;
import com.expensetracker.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AssistantService {

    private static final String HELP =
            "I can answer questions about your own statements: how much you spent or earned, how much you saved, "
                    + "your average daily spending, a comparison between two periods, your biggest expenses, "
                    + "where most of your money goes (categories and shops), how many times you paid somewhere, "
                    + "or show you a list of transactions. "
                    + "Try \"How much did I spend on food in September?\"";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter MONTH_YEAR = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    @Autowired
    private QuestionIntentService intentService;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    public AskResponse ask(String username, String question) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        ParsedQuestion q;
        try {
            q = intentService.parse(question);
        } catch (IllegalArgumentException e) {
            // The question could not be turned into a safe query: explain, don't guess
            return new AskResponse(e.getMessage(), Intent.UNSUPPORTED.name(), List.of());
        }

        if (q.intent() == Intent.UNSUPPORTED) {
            return new AskResponse(HELP, Intent.UNSUPPORTED.name(), List.of());
        }

        // Only this user's own rows are ever read
        List<Transaction> all = transactionRepository.findByUserId(user.getId());

        return switch (q.intent()) {
            case TOTAL_SPENT -> totalSpent(q, all);
            case TOTAL_INCOME -> totalIncome(q, all);
            case COMPARE_SPENT -> compareSpent(q, all);
            case BIGGEST_EXPENSES -> biggestExpenses(q, all);
            case TOP_CATEGORIES -> topCategories(q, all);
            case TOP_MERCHANTS -> topMerchants(q, all);
            case COUNT_TRANSACTIONS -> countTransactions(q, all);
            case AVERAGE_SPEND -> averageSpend(q, all);
            case SAVINGS -> savings(q, all);
            case LIST_TRANSACTIONS -> listTransactions(q, all);
            default -> new AskResponse(HELP, Intent.UNSUPPORTED.name(), List.of());
        };
    }

    /* ---------- the kinds of answer ---------- */

    private AskResponse totalSpent(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, "EXPENSE", q.category(), q.merchant(), q.start(), q.end());
        String what = subject(q);
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no expenses" + what + " " + when + ".", q);
        }

        String count = matches.size() + (matches.size() == 1 ? " transaction" : " transactions");
        return reply("You spent " + inr(sum(matches)) + what + " " + when + " (" + count + ").", q);
    }

    private AskResponse totalIncome(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, "INCOME", null, q.merchant(), q.start(), q.end());
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no money coming in " + when + ".", q);
        }

        String count = matches.size() + (matches.size() == 1 ? " credit" : " credits");
        return reply("You received " + inr(sum(matches)) + " " + when + " (" + count + ").", q);
    }

    private AskResponse compareSpent(ParsedQuestion q, List<Transaction> all) {
        BigDecimal first = sum(select(all, "EXPENSE", q.category(), q.merchant(), q.start(), q.end()));
        BigDecimal second = sum(select(all, "EXPENSE", q.category(), q.merchant(), q.compareStart(), q.compareEnd()));
        String firstLabel = label(q.start(), q.end());
        String secondLabel = label(q.compareStart(), q.compareEnd());
        String what = subject(q);

        if (first.signum() == 0 && second.signum() == 0) {
            return reply("I found no expenses" + what + " in either " + firstLabel + " or " + secondLabel + ".", q);
        }

        BigDecimal diff = first.subtract(second);
        String verdict;
        if (diff.signum() == 0) {
            verdict = "That is exactly the same.";
        } else if (second.signum() == 0) {
            verdict = "That is " + inr(diff) + " more, since nothing was spent in " + secondLabel + ".";
        } else {
            String pct = percent(diff.abs(), second);
            verdict = diff.signum() > 0
                    ? "That is " + inr(diff) + " more (" + pct + "% higher) in " + firstLabel + "."
                    : "That is " + inr(diff.abs()) + " less (" + pct + "% lower) in " + firstLabel + ".";
        }

        String answer = "You spent " + inr(first) + what + " in " + firstLabel
                + " and " + inr(second) + " in " + secondLabel + ". " + verdict;

        List<Row> rows = List.of(new Row(firstLabel, inr(first)), new Row(secondLabel, inr(second)));
        return new AskResponse(answer, q.intent().name(), rows);
    }

    private AskResponse biggestExpenses(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, "EXPENSE", q.category(), q.merchant(), q.start(), q.end());
        String what = subject(q);
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no expenses" + what + " " + when + ".", q);
        }

        List<Transaction> top = matches.stream()
                .sorted(Comparator.comparing(Transaction::getAmount).reversed())
                .limit(q.limit())
                .toList();

        List<Row> rows = top.stream()
                .map(t -> new Row(t.getTransactionDate().format(DAY) + " · " + describe(t), inr(t.getAmount())))
                .toList();

        String headline = top.size() == 1 ? "Your biggest expense" : "Your " + top.size() + " biggest expenses";
        return new AskResponse(headline + what + " " + when + ":", q.intent().name(), rows);
    }

    private AskResponse topCategories(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, "EXPENSE", null, q.merchant(), q.start(), q.end());
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no expenses " + when + ".", q);
        }

        Map<String, BigDecimal> byCategory = new HashMap<>();
        for (Transaction t : matches) {
            String category = (t.getCategory() == null || t.getCategory().isBlank()) ? "Uncategorized" : t.getCategory();
            byCategory.merge(category, t.getAmount(), BigDecimal::add);
        }

        BigDecimal total = sum(matches);
        List<Map.Entry<String, BigDecimal>> top = byCategory.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue(Comparator.reverseOrder()))
                .limit(q.limit())
                .toList();

        List<Row> rows = top.stream()
                .map(e -> new Row(e.getKey(), inr(e.getValue()) + " (" + percent(e.getValue(), total) + "%)"))
                .toList();

        Map.Entry<String, BigDecimal> leader = top.get(0);
        String answer = "Most of your spending " + when + " went to " + leader.getKey() + " ("
                + inr(leader.getValue()) + ", " + percent(leader.getValue(), total) + "% of "
                + inr(total) + ").";
        return new AskResponse(answer, q.intent().name(), rows);
    }

    // Which shops or people received the most money
    private AskResponse topMerchants(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, "EXPENSE", q.category(), null, q.start(), q.end());
        String what = q.category() == null ? "" : " on " + q.category();
        String when = inPeriod(q.start(), q.end());

        Map<String, BigDecimal> totals = new HashMap<>();
        Map<String, Integer> counts = new HashMap<>();
        Map<String, String> names = new HashMap<>();

        for (Transaction t : matches) {
            String merchant = t.getMerchant();
            if (merchant == null || merchant.isBlank() || merchant.equalsIgnoreCase("Unknown")) {
                continue; // rows with no identified shop can't be ranked
            }
            String key = merchant.trim().toLowerCase();
            names.putIfAbsent(key, merchant.trim());
            totals.merge(key, t.getAmount(), BigDecimal::add);
            counts.merge(key, 1, Integer::sum);
        }

        if (totals.isEmpty()) {
            return reply("I could not find any named shops or people among your expenses" + what + " " + when + ".", q);
        }

        List<Map.Entry<String, BigDecimal>> top = totals.entrySet().stream()
                .sorted(Map.Entry.<String, BigDecimal>comparingByValue(Comparator.reverseOrder()))
                .limit(q.limit())
                .toList();

        List<Row> rows = top.stream()
                .map(e -> {
                    int n = counts.get(e.getKey());
                    return new Row(names.get(e.getKey()),
                            inr(e.getValue()) + " (" + n + (n == 1 ? " payment" : " payments") + ")");
                })
                .toList();

        Map.Entry<String, BigDecimal> leader = top.get(0);
        int leaderCount = counts.get(leader.getKey());
        String answer = "You spent the most at " + names.get(leader.getKey()) + " ("
                + inr(leader.getValue()) + " over " + leaderCount
                + (leaderCount == 1 ? " payment" : " payments") + ")" + what + " " + when + ".";
        return new AskResponse(answer, q.intent().name(), rows);
    }

    // How many transactions, optionally for one category, shop or period
    private AskResponse countTransactions(ParsedQuestion q, List<Transaction> all) {
        String type = q.type() == null ? "EXPENSE" : q.type();
        List<Transaction> matches = select(all, type, q.category(), q.merchant(), q.start(), q.end());
        String noun = type.equals("INCOME") ? "credit" : "expense transaction";
        String what = subject(q);
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no " + noun + "s" + what + " " + when + ".", q);
        }

        int n = matches.size();
        return reply("You had " + n + " " + noun + (n == 1 ? "" : "s") + what + " " + when
                + ", adding up to " + inr(sum(matches)) + ".", q);
    }

    // Average spend per day (and per transaction)
    private AskResponse averageSpend(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, "EXPENSE", q.category(), q.merchant(), q.start(), q.end());
        String what = subject(q);
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no expenses" + what + " " + when + ".", q);
        }

        LocalDate from = q.start();
        LocalDate to = q.end();
        if (from == null || to == null) {
            // No period given: use the stretch of days the matching expenses cover
            from = matches.stream().map(Transaction::getTransactionDate).min(Comparator.naturalOrder()).get();
            to = matches.stream().map(Transaction::getTransactionDate).max(Comparator.naturalOrder()).get();
        }

        long days = ChronoUnit.DAYS.between(from, to) + 1;
        BigDecimal total = sum(matches);
        BigDecimal perDay = total.divide(BigDecimal.valueOf(days), 2, RoundingMode.HALF_UP);
        BigDecimal perTransaction = total.divide(BigDecimal.valueOf(matches.size()), 2, RoundingMode.HALF_UP);

        String answer = "On average you spent " + inr(perDay) + " per day" + what + " " + when
                + ", and about " + inr(perTransaction) + " per transaction.";

        List<Row> rows = List.of(
                new Row("Per day", inr(perDay)),
                new Row("Per transaction", inr(perTransaction)),
                new Row("Total spent", inr(total)),
                new Row("Days counted", String.valueOf(days)));
        return new AskResponse(answer, q.intent().name(), rows);
    }

    // Income minus spending
    private AskResponse savings(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> incomeRows = select(all, "INCOME", null, null, q.start(), q.end());
        List<Transaction> expenseRows = select(all, "EXPENSE", null, null, q.start(), q.end());
        String when = inPeriod(q.start(), q.end());

        if (incomeRows.isEmpty() && expenseRows.isEmpty()) {
            return reply("I found no transactions " + when + ".", q);
        }

        BigDecimal income = sum(incomeRows);
        BigDecimal spent = sum(expenseRows);
        BigDecimal net = income.subtract(spent);

        String answer;
        if (income.signum() == 0) {
            answer = "No income was recorded " + when + ", and you spent " + inr(spent) + ".";
        } else if (net.signum() >= 0) {
            answer = "You saved " + inr(net) + " " + when + " (" + percent(net, income)
                    + "% of your " + inr(income) + " income).";
        } else {
            answer = "You spent " + inr(net.abs()) + " more than you earned " + when
                    + " (income " + inr(income) + ", spending " + inr(spent) + ").";
        }

        String netText = net.signum() < 0 ? "-" + inr(net.abs()) : inr(net);
        List<Row> rows = List.of(
                new Row("Income", inr(income)),
                new Row("Spent", inr(spent)),
                new Row(net.signum() < 0 ? "Shortfall" : "Saved", netText));
        return new AskResponse(answer, q.intent().name(), rows);
    }

    // Show the actual transactions, newest first
    private AskResponse listTransactions(ParsedQuestion q, List<Transaction> all) {
        List<Transaction> matches = select(all, q.type(), q.category(), q.merchant(), q.start(), q.end());
        String what = subject(q);
        String when = inPeriod(q.start(), q.end());

        if (matches.isEmpty()) {
            return reply("I found no transactions" + what + " " + when + ".", q);
        }

        List<Transaction> shown = matches.stream()
                .sorted(Comparator.comparing(Transaction::getTransactionDate).reversed())
                .limit(q.limit())
                .toList();

        List<Row> rows = shown.stream()
                .map(t -> new Row(t.getTransactionDate().format(DAY) + " · " + describe(t),
                        ("INCOME".equals(t.getType()) ? "+" : "-") + inr(t.getAmount())))
                .toList();

        String more = matches.size() > shown.size() ? " (of " + matches.size() + ")" : "";
        String headline = "Your latest " + shown.size()
                + (shown.size() == 1 ? " transaction" : " transactions") + more + what + " " + when + ":";
        return new AskResponse(headline, q.intent().name(), rows);
    }

    /* ---------- picking rows ---------- */

    // type == null means both expenses and income
    private List<Transaction> select(List<Transaction> all, String type, String category, String merchant,
                                     LocalDate start, LocalDate end) {
        String needle = merchant == null ? null : merchant.toLowerCase();

        return all.stream()
                .filter(t -> type == null || type.equals(t.getType()))
                .filter(t -> t.getAmount() != null && t.getTransactionDate() != null)
                .filter(t -> start == null
                        || (!t.getTransactionDate().isBefore(start) && !t.getTransactionDate().isAfter(end)))
                .filter(t -> category == null || category.equalsIgnoreCase(t.getCategory()))
                .filter(t -> needle == null || contains(t.getMerchant(), needle) || contains(t.getDescription(), needle))
                .toList();
    }

    private boolean contains(String text, String lowerNeedle) {
        return text != null && text.toLowerCase().contains(lowerNeedle);
    }

    private BigDecimal sum(List<Transaction> list) {
        return list.stream().map(Transaction::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /* ---------- wording ---------- */

    private AskResponse reply(String answer, ParsedQuestion q) {
        return new AskResponse(answer, q.intent().name(), List.of());
    }

    // " on Food & Dining", " at Zomato", " on Food & Dining at Zomato", or ""
    private String subject(ParsedQuestion q) {
        StringBuilder text = new StringBuilder();
        if (q.category() != null) {
            text.append(" on ").append(q.category());
        }
        if (q.merchant() != null) {
            text.append(" at ").append(q.merchant());
        }
        return text.toString();
    }

    private String describe(Transaction t) {
        String merchant = t.getMerchant();
        if (merchant != null && !merchant.isBlank() && !merchant.equalsIgnoreCase("Unknown")) {
            return merchant;
        }
        String description = t.getDescription() == null ? "No description" : t.getDescription().trim();
        return description.length() > 50 ? description.substring(0, 50) + "..." : description;
    }

    // "in September 2026", "from 1 Aug 2026 to 15 Aug 2026", or "across all your statements"
    private String inPeriod(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            return "across all your statements";
        }
        if (isWholeMonth(start, end)) {
            return "in " + start.format(MONTH_YEAR);
        }
        return "from " + start.format(DAY) + " to " + end.format(DAY);
    }

    // "September 2026" or "1 Aug 2026 to 15 Aug 2026"
    private String label(LocalDate start, LocalDate end) {
        if (isWholeMonth(start, end)) {
            return start.format(MONTH_YEAR);
        }
        return start.format(DAY) + " to " + end.format(DAY);
    }

    private boolean isWholeMonth(LocalDate start, LocalDate end) {
        return start.getDayOfMonth() == 1 && end.equals(YearMonth.from(start).atEndOfMonth());
    }

    private String inr(BigDecimal amount) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.forLanguageTag("en-IN"));
        format.setMinimumFractionDigits(0);
        format.setMaximumFractionDigits(2);
        return "\u20B9" + format.format(amount);
    }

    private String percent(BigDecimal part, BigDecimal whole) {
        return part.multiply(HUNDRED)
                .divide(whole, 1, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString();
    }
}