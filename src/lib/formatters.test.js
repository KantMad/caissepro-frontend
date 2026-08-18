import { describe, it, expect } from "vitest";
import {
  formatAmount, getPaymentLabel, getAvoirRemaining, isAvoirPartiallyUsed,
  filterByToday, getTodayDate, aggregatePaymentsByMethod, normClosure, computeCommission,
} from "./formatters.js";

describe("computeCommission (sur le HT, plancher/plafond)", () => {
  it("commission = baseHT × taux quand dans les bornes", () => {
    const r = computeCommission(1000, 0.05, 0, 0);
    expect(r.raw).toBe(50);
    expect(r.commission).toBe(50);
    expect(r.capped).toBe(false);
    expect(r.floored).toBe(false);
  });
  it("plafond appliqué", () => {
    const r = computeCommission(10000, 0.05, 0, 300); // raw 500 > cap 300
    expect(r.raw).toBe(500);
    expect(r.commission).toBe(300);
    expect(r.capped).toBe(true);
  });
  it("plancher appliqué", () => {
    const r = computeCommission(100, 0.05, 50, 0); // raw 5 < floor 50
    expect(r.commission).toBe(50);
    expect(r.floored).toBe(true);
  });
  it("plancher prioritaire si plancher > plafond (mauvaise config)", () => {
    const r = computeCommission(1000, 0.05, 80, 60); // raw 50 -> cap 50 -> floor 80
    expect(r.commission).toBe(80);
  });
  it("valeurs invalides → 0", () => {
    expect(computeCommission(undefined, undefined).commission).toBe(0);
  });
});

describe("normClosure", () => {
  it("mappe la réponse backend snake_case → camelCase (bug ticket de fermeture à 0)", () => {
    const c = normClosure({
      closure_type: "daily", ticket_count: 3, total_ht: "100.5", total_tva: "20.1",
      total_ttc: "120.6", grand_total: "500", expected_cash: "60", actual_cash: "58",
      cashIn: 10, cashOut: 5, byPayment: { cash: 60, card: 60.6 },
      created_at: "2026-07-16T12:00:00Z", user_name: "Admin",
    });
    expect(c.type).toBe("daily");
    expect(c.ticketCount).toBe(3);
    expect(c.totalTTC).toBe(120.6);
    expect(c.totalHT).toBe(100.5);
    expect(c.expectedCash).toBe(60);
    expect(c.actualCash).toBe("58");
    expect(c.cashIn).toBe(10);
    expect(c.cashOut).toBe(5);
    expect(c.byPayment.cash).toBe(60);
    expect(c.userName).toBe("Admin");
  });
  it("conserve le camelCase déjà normalisé (chemin hors-ligne)", () => {
    const c = normClosure({ ticketCount: 2, totalTTC: 50, byPayment: { cash: 50 } });
    expect(c.ticketCount).toBe(2);
    expect(c.totalTTC).toBe(50);
    expect(c.byPayment.cash).toBe(50);
  });
  it("valeurs manquantes → 0 (pas undefined)", () => {
    const c = normClosure({});
    expect(c.ticketCount).toBe(0);
    expect(c.totalTTC).toBe(0);
    expect(c.byPayment).toEqual({});
  });
});

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
