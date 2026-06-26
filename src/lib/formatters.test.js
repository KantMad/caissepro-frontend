import { describe, it, expect } from "vitest";
import {
  formatAmount, getPaymentLabel, getAvoirRemaining, isAvoirPartiallyUsed,
  filterByToday, getTodayDate, aggregatePaymentsByMethod,
} from "./formatters.js";

describe("formatAmount", () => {
  it("formate à 2 décimales", () => {
    expect(formatAmount(9.5)).toBe("9.50");
    expect(formatAmount("12.345")).toBe("12.35");
  });
  it("0.00 pour valeurs invalides", () => {
    expect(formatAmount(undefined)).toBe("0.00");
    expect(formatAmount(null)).toBe("0.00");
    expect(formatAmount("abc")).toBe("0.00");
  });
});

describe("getPaymentLabel", () => {
  it("libellés courts / longs / remboursement", () => {
    expect(getPaymentLabel("cash", "short")).toBe("ESP");
    expect(getPaymentLabel("card", "full")).toBe("CB");
    expect(getPaymentLabel("avoir", "refund")).toBe("Avoir client");
  });
  it("fallback = la clé brute si inconnue", () => {
    expect(getPaymentLabel("bitcoin")).toBe("bitcoin");
  });
});

describe("getAvoirRemaining", () => {
  it("remaining prioritaire", () => {
    expect(getAvoirRemaining({ remaining: 30, totalTTC: 129 })).toBe(30);
  });
  it("fallback total si pas de remaining", () => {
    expect(getAvoirRemaining({ totalTTC: 129 })).toBe(129);
    expect(getAvoirRemaining({ total_ttc: "50" })).toBe(50);
  });
  it("0 si null", () => expect(getAvoirRemaining(null)).toBe(0));
});

describe("isAvoirPartiallyUsed", () => {
  it("vrai si solde < total", () => {
    expect(isAvoirPartiallyUsed({ remaining: 30, totalTTC: 129 })).toBe(true);
  });
  it("faux si neuf (solde = total)", () => {
    expect(isAvoirPartiallyUsed({ remaining: 129, totalTTC: 129 })).toBe(false);
    expect(isAvoirPartiallyUsed({ totalTTC: 129 })).toBe(false);
  });
});

describe("filterByToday", () => {
  it("ne garde que les éléments du jour", () => {
    const today = getTodayDate();
    const items = [{ date: `${today}T10:00:00Z` }, { created_at: "2020-01-01T00:00:00Z" }, { date: `${today}T23:59:59Z` }];
    expect(filterByToday(items)).toHaveLength(2);
  });
  it("liste vide/nulle → []", () => {
    expect(filterByToday(null)).toEqual([]);
  });
});

describe("aggregatePaymentsByMethod", () => {
  it("somme par méthode sur plusieurs tickets", () => {
    const tickets = [
      { payments: [{ method: "cash", amount: 10 }, { method: "card", amount: 5 }] },
      { payments: [{ method: "cash", amount: 20 }] },
      { payments: [{ method: "avoir", amount: 7 }] },
    ];
    const r = aggregatePaymentsByMethod(tickets);
    expect(r.cash).toBe(30);
    expect(r.card).toBe(5);
    expect(r.avoir).toBe(7);
    expect(r.cheque).toBe(0);
  });
  it("ignore les montants invalides", () => {
    const r = aggregatePaymentsByMethod([{ payments: [{ method: "cash", amount: undefined }] }]);
    expect(r.cash).toBe(0);
  });
});
