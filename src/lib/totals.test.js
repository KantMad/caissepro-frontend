import { describe, it, expect } from "vitest";
import { computeTotals, round2 } from "./totals.js";

// helper : ligne panier
const L = (price, quantity = 1, taxRate = 0.20, discount = 0, discountType = "percent") =>
  ({ price, quantity, taxRate, discount, discountType });

describe("round2", () => {
  it("arrondit au centime", () => {
    expect(round2(348.3333)).toBe(348.33);
    expect(round2(69.6667)).toBe(69.67);
    expect(round2(1.006)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
  });
  it("gère 0 / undefined / null", () => {
    expect(round2(0)).toBe(0);
    expect(round2(undefined)).toBe(0);
    expect(round2(null)).toBe(0);
  });
});

describe("computeTotals — invariant NF525 : HT + TVA = TTC (au centime)", () => {
  it("panier vide → zéros", () => {
    expect(computeTotals([])).toEqual({ sHT: 0, gd: 0, gdTTC: 0, tHT: 0, tTVA: 0, tTTC: 0 });
  });

  it("2×209 TTC = 418.00 (le bug d'origine, plus de 417.99)", () => {
    const t = computeTotals([L(209), L(209)]);
    expect(t.tTTC).toBe(418);
    expect(t.tHT).toBe(348.33);
    expect(t.tTVA).toBe(69.67);
    expect(round2(t.tHT + t.tTVA)).toBe(t.tTTC);
  });

  it("1 article quantité 2 = 418.00 (même résultat que 2 lignes)", () => {
    const t = computeTotals([L(209, 2)]);
    expect(t.tTTC).toBe(418);
    expect(round2(t.tHT + t.tTVA)).toBe(418);
  });

  it("3×9.99 TTC = 29.97", () => {
    const t = computeTotals([L(9.99), L(9.99), L(9.99)]);
    expect(t.tTTC).toBe(29.97);
    expect(round2(t.tHT + t.tTVA)).toBe(29.97);
  });

  it("multi-taux (209@20% + 10@5.5%) = 219.00", () => {
    const t = computeTotals([L(209, 1, 0.20), L(10, 1, 0.055)]);
    expect(t.tTTC).toBe(219);
    expect(round2(t.tHT + t.tTVA)).toBe(219);
  });

  it("remise globale 10% sur 2×209 = 376.20", () => {
    const t = computeTotals([L(209), L(209)], { gDisc: 10, gDiscType: "percentage" });
    expect(t.tTTC).toBe(376.2);
    expect(round2(t.tHT + t.tTVA)).toBe(376.2);
  });

  it("remise globale montant fixe (50€) sur 2×209", () => {
    const t = computeTotals([L(209), L(209)], { gDisc: 50, gDiscType: "amount" });
    // 50€ de remise HT → TTC réduit proportionnellement, HT+TVA reste = TTC
    expect(round2(t.tHT + t.tTVA)).toBe(t.tTTC);
    expect(t.tTTC).toBeLessThan(418);
  });

  it("mode HT : prix saisis HT → TVA ajoutée (100 HT @20% = 120 TTC)", () => {
    const t = computeTotals([L(100)], { pricingMode: "HT" });
    expect(t.tTTC).toBe(120);
    expect(t.tHT).toBe(100);
    expect(t.tTVA).toBe(20);
  });

  it("remise ligne en % (-50% sur 100 TTC = 50)", () => {
    const t = computeTotals([L(100, 1, 0.20, 50, "percent")]);
    expect(t.tTTC).toBe(50);
  });

  it("remise ligne en montant (-2€/u sur 10 TTC ×3 = 24)", () => {
    const t = computeTotals([L(10, 3, 0.20, 2, "amount")]);
    expect(t.tTTC).toBe(24);
  });

  it("avoir déduit du TTC final (418 - 18 = 400)", () => {
    const t = computeTotals([L(209), L(209)], { avoirPayment: 18 });
    expect(t.tTTC).toBe(400);
  });

  it("avoir ne rend jamais le TTC négatif", () => {
    const t = computeTotals([L(10)], { avoirPayment: 999 });
    expect(t.tTTC).toBe(0);
  });

  it("invariant HT+TVA=TTC sur de nombreux prix/quantités", () => {
    const prices = [9.99, 19.9, 29.95, 5.5, 12.34, 99.99, 1.01, 7.77, 209, 0.99, 49.5, 3.33];
    for (const p of prices) {
      for (let q = 1; q <= 5; q++) {
        const t = computeTotals([L(p, q)]);
        expect(round2(t.tHT + t.tTVA)).toBe(t.tTTC);
      }
    }
  });

  it("invariant tenu aussi avec remise globale variable", () => {
    for (const d of [0, 5, 10, 15, 33, 50]) {
      const t = computeTotals([L(209), L(9.99), L(49.5)], { gDisc: d, gDiscType: "percentage" });
      expect(round2(t.tHT + t.tTVA)).toBe(t.tTTC);
    }
  });
});

// ── Remises cumulables (% puis €) — 24/09/2026 ──
describe("remises cumulables", () => {
  const item = (over = {}) => ({ price: 100, quantity: 1, taxRate: 0.20, ...over });

  it("ligne : le % s'applique d'abord, puis les euros sur le reste", () => {
    // 100 TTC -20% = 80, puis -5 € = 75
    const t = computeTotals([item({ discountPercent: 20, discountAmount: 5 })]);
    expect(t.tTTC).toBe(75);
    expect(round2(t.tHT + t.tTVA)).toBe(75);
  });

  it("ligne : la remise en euros porte sur la LIGNE, pas sur chaque article", () => {
    // 3 x 20 = 60 TTC, -5 € => 55 (et non 45)
    const t = computeTotals([item({ price: 20, quantity: 3, discountAmount: 5 })]);
    expect(t.tTTC).toBe(55);
  });

  it("ligne : une remise superieure au montant ne rend jamais la ligne negative", () => {
    expect(computeTotals([item({ price: 10, discountAmount: 50 })]).tTTC).toBe(0);
  });

  it("panier : % puis euros, la remise en euros est bien du TTC", () => {
    // 200 TTC -10% = 180, puis -20 € = 160 payes par le client
    const t = computeTotals([item({ price: 200 })], { gDiscPct: 10, gDiscAmt: 20 });
    expect(t.tTTC).toBe(160);
    expect(t.gdTTC).toBe(40);
    expect(round2(t.tHT + t.tTVA)).toBe(160);
    // la valeur enregistree en base reste du HT
    expect(t.gd).toBe(round2(t.sHT * (40 / 200)));
  });

  it("panier : remises de ligne ET remise globale se cumulent", () => {
    // 100 -20% = 80 ; panier -10% = 72 ; -2 € = 70
    const t = computeTotals([item({ discountPercent: 20 })], { gDiscPct: 10, gDiscAmt: 2 });
    expect(t.tTTC).toBe(70);
  });

  it("ancienne forme (discountType amount = euros par article) toujours comprise", () => {
    const t = computeTotals([{ price: 20, quantity: 3, taxRate: 0.20, discount: 5, discountType: "amount" }]);
    expect(t.tTTC).toBe(45);   // 60 - (5 x 3)
  });

  it("ancienne forme de remise globale (gDisc + gDiscType) toujours comprise", () => {
    const pct = computeTotals([item({ price: 200 })], { gDisc: 10, gDiscType: "percentage" });
    expect(pct.tTTC).toBe(180);
    const eur = computeTotals([item({ price: 200 })], { gDisc: 20, gDiscType: "amount" });
    expect(eur.tTTC).toBe(180);  // desormais 20 EUR TTC (et non 20 EUR HT = 24 TTC)
  });

  it("le total ne devient jamais negatif avec une remise globale enorme", () => {
    const t = computeTotals([item({ price: 50 })], { gDiscPct: 50, gDiscAmt: 999 });
    expect(t.tTTC).toBe(0);
    expect(t.gdTTC).toBe(50);
  });
});
