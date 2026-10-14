package com.expensetracker.backend.statement;

import com.expensetracker.backend.service.CategoryRuleService;

import java.util.LinkedHashMap;
import java.util.Map;

public final class DefaultCategoryRules {

    public record Match(String category, String merchant) {}

    private record Rule(String category, String merchant) {}

    // Order matters: the first match wins, so specific keywords go before general ones
    private static final Map<String, Rule> RULES = new LinkedHashMap<>();

    private static void add(String category, String merchant, String... keywords) {
        for (String keyword : keywords) {
            RULES.put(keyword, new Rule(category, merchant));
        }
    }

    static {
        // ---- Groceries (before Swiggy/Amazon so the specific ones win) ----
        add("Groceries", "Swiggy Instamart", "instamart");
        add("Groceries", "Blinkit", "blinkit");
        add("Groceries", "Zepto", "zepto");
        add("Groceries", "BigBasket", "bigbasket", "big basket");
        add("Groceries", "DMart", "dmart", "d mart");
        add("Groceries", "JioMart", "jiomart");

        // ---- Entertainment (Amazon Prime before plain Amazon) ----
        add("Entertainment", "Amazon Prime", "amazon prime", "prime video");
        add("Entertainment", "Netflix", "netflix");
        add("Entertainment", "Hotstar", "hotstar");
        add("Entertainment", "Spotify", "spotify");
        add("Entertainment", "YouTube", "youtube");
        add("Entertainment", "BookMyShow", "bookmyshow");
        add("Entertainment", "Sony LIV", "sony liv", "sonyliv");
        add("Entertainment", "ZEE5", "zee");
        add("Entertainment", "PVR", "pvr");
        add("Entertainment", "INOX", "inox");

        // ---- Food & Dining ----
        add("Food & Dining", "Swiggy", "swiggy");
        add("Food & Dining", "Zomato", "zomato");
        add("Food & Dining", "Domino's", "dominos");
        add("Food & Dining", "McDonald's", "mcdonald", "mcdonalds");
        add("Food & Dining", "KFC", "kfc");
        add("Food & Dining", "Pizza Hut", "pizza hut", "pizzahut");
        add("Food & Dining", "Starbucks", "starbucks");
        add("Food & Dining", "Cafe Coffee Day", "cafe coffee day");
        add("Food & Dining", "Burger King", "burger king");
        add("Food & Dining", "Subway", "subway");
        add("Food & Dining", "Haldiram's", "haldiram");

        // ---- Transport ----
        add("Transport", "Uber", "uber");
        add("Transport", "Ola", "ola");
        add("Transport", "Rapido", "rapido");
        add("Transport", "IRCTC", "irctc");
        add("Transport", "redBus", "redbus");
        add("Transport", "KSRTC", "ksrtc");
        add("Transport", "FASTag", "fastag");
        add("Transport", "Indian Oil", "indian oil", "iocl");
        add("Transport", "BPCL", "bpcl");
        add("Transport", "HPCL", "hpcl");

        // ---- Shopping ----
        add("Shopping", "Amazon", "amazon");
        add("Shopping", "Flipkart", "flipkart");
        add("Shopping", "Myntra", "myntra");
        add("Shopping", "Ajio", "ajio");
        add("Shopping", "Meesho", "meesho");
        add("Shopping", "Nykaa", "nykaa");
        add("Shopping", "Croma", "croma");
        add("Shopping", "Reliance Digital", "reliance digital");

        // ---- Bills & Utilities ----
        add("Bills & Utilities", "Jio", "jio");
        add("Bills & Utilities", "Airtel", "airtel");
        add("Bills & Utilities", "Vodafone Idea", "vodafone");
        add("Bills & Utilities", "BSNL", "bsnl");
        add("Bills & Utilities", "KSEB", "kseb");
        add("Bills & Utilities", "Tata Play", "tata play", "tataplay");
        add("Bills & Utilities", "Unknown", "electricity", "broadband", "recharge", "insurance");

        // ---- Health & Fitness ----
        add("Health & Fitness", "PharmEasy", "pharmeasy");
        add("Health & Fitness", "Apollo Pharmacy", "apollo pharmacy");
        add("Health & Fitness", "Netmeds", "netmeds");
        add("Health & Fitness", "MedPlus", "medplus");
        add("Health & Fitness", "Cult.fit", "cult fit", "cultfit");
        add("Health & Fitness", "Unknown", "pharmacy", "hospital", "diagnostic");

        // ---- Rent/Housing ----
        add("Rent/Housing", "Unknown", "rent");

        // ---- Generic words (these show up when the merchant name isn't a big brand) ----
        add("Food & Dining", "Unknown", "tea shop", "tea stall", "tea", "chai", "food court",
                "canteen", "cafe", "restaurant", "bakery", "biryani", "juice", "snacks", "meals", "mess", "dhaba");
        add("Groceries", "Reliance Smart", "reliance smart", "reliance fresh");
        add("Groceries", "Unknown", "supermarket", "grocery", "vegetables", "vegetable", "mart", "kirana", "provision");
        add("Transport", "Unknown", "fuel", "petrol", "diesel", "parking", "auto fare", "taxi", "cab",
                "bus fare", "bus ticket", "toll", "metro");
        add("Health & Fitness", "Unknown", "medical", "medicals", "clinic", "dental", "lab");
        add("Entertainment", "Google Play", "google play");
        add("Shopping", "Unknown", "book store", "bookstore", "stationery");
        add("Bills & Utilities", "Unknown", "internet", "fibre", "fiber", "dth", "gas");
        add("Income", "Unknown", "salary");

        // ---- Withdrawal (cash taken out at ATMs) ----
        add("Withdrawal", "ATM", "atm", "wdl", "cash withdrawal", "cash wdl");
    }

    private DefaultCategoryRules() {}

    // Returns the first matching rule, or null if nothing matches (Gemini handles those).
    // Short keywords (4 letters or fewer) must match a whole word, so "ola" doesn't match "pola".
    // Longer keywords can match inside a word, so "swiggy" still catches "swiggyinstamart".
    public static Match find(String description) {
        String text = " " + CategoryRuleService.normalize(description) + " ";

        for (Map.Entry<String, Rule> entry : RULES.entrySet()) {
            String keyword = entry.getKey();
            boolean hit = keyword.length() <= 4
                    ? text.contains(" " + keyword + " ")
                    : text.contains(keyword);
            if (hit) {
                Rule rule = entry.getValue();
                return new Match(rule.category(), rule.merchant());
            }
        }
        return null;
    }
}