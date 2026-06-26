import { describe, it, expect } from "vitest";
import { calcPromoDiscount } from "./promos.js";

const item = (over = {}) => ({
  product: { price: 100, taxRate: 0.20, category: "Jeans", sku: "SKU1", collection: "S26", stock: 50, name: "Jean" },
  variant: { color: "Bleu", stock: 50 },
  quantity: 1, discount: 0, discountType: "percent", ...over,
});
const TTC = { pricingMode: "TTC" };
const HT_DUN = 100 / 1.2; // HT d'un article 100 TTC @20%

describe("calcPromoDiscount", () => {
  it("aucune promo → 0", () => {
    expect(calcPromoDiscount([item()], [], TTC)).toEqual({ promoDisc: 0, applied: [] });
  });
  it("panier vide → 0", () => {
    expect(calcPromoDiscount([], [{ name: "X", targetType: "category", targetValue: "Jeans", value: 10 }], TTC).promoDisc).toBe(0);
  });

  it("remise catégorie en % (10% du HT)", () => {
    const promos = [{ name: "Promo Jeans", targetType: "category", targetValue: "Jeans", value: 10, discountType: "percent" }];
    const r = calcPromoDiscount([item()], promos, TTC);
    expect(r.promoDisc).toBeCloseTo(HT_DUN * 0.10, 3);
    expect(r.applied).toHaveLength(1);
  });

  it("remise catégorie en montant €", () => {
    const promos = [{ name: "X", targetType: "category", targetValue: "Jeans", value: 5, discountType: "amount" }];
    expect(calcPromoDiscount([item()], promos, TTC).promoDisc).toBe(5);
  });

  it("remise SKU ciblée", () => {
    const promos = [{ name: "X", targetType: "sku", targetValue: "SKU1", value: 50, discountType: "percent" }];
    expect(calcPromoDiscount([item()], promos, TTC).promoDisc).toBeGreaterThan(0);
    expect(calcPromoDiscount([item({ product: { ...item().product, sku: "OTHER" } })], promos, TTC).promoDisc).toBe(0);
  });

  it("remise couleur", () => {
    const promos = [{ name: "X", targetType: "color", targetValue: "bleu", value: 10, discountType: "percent" }];
    expect(calcPromoDiscount([item()], promos, TTC).promoDisc).toBeGreaterThan(0);
    expect(calcPromoDiscount([item({ variant: { color: "Rouge", stock: 5 } })], promos, TTC).promoDisc).toBe(0);
  });

  it("remise collection", () => {
    const promos = [{ name: "X", targetType: "collection", targetValue: "s26", value: 10, discountType: "percent" }];
    expect(calcPromoDiscount([item()], promos, TTC).promoDisc).toBeGreaterThan(0);
    expect(calcPromoDiscount([item({ product: { ...item().product, collection: "PE26" } })], promos, TTC).promoDisc).toBe(0);
  });

  it("destockage stock faible : stock <= seuil et > 0 (rupture exclue)", () => {
    const promos = [{ name: "Destockage", targetType: "low_stock", targetValue: "5", value: 20, discountType: "percent" }];
    expect(calcPromoDiscount([item({ variant: { color: "Bleu", stock: 3 } })], promos, TTC).promoDisc).toBeGreaterThan(0);
    expect(calcPromoDiscount([item({ variant: { color: "Bleu", stock: 10 } })], promos, TTC).promoDisc).toBe(0);
    expect(calcPromoDiscount([item({ variant: { color: "Bleu", stock: 0 } })], promos, TTC).promoDisc).toBe(0);
  });

  it("min_qty : remise seulement si la quantité matching atteint le seuil", () => {
    const promos = [{ name: "X", targetType: "category", targetValue: "Jeans", value: 10, discountType: "percent", minQty: 3 }];
    expect(calcPromoDiscount([item({ quantity: 2 })], promos, TTC).promoDisc).toBe(0);
    expect(calcPromoDiscount([item({ quantity: 3 })], promos, TTC).promoDisc).toBeGreaterThan(0);
  });

  it("qty_discount : remise sur tout le panier au-dessus du seuil", () => {
    const promos = [{ name: "Volume", type: "qty_discount", value: 10, discountType: "percent", minQty: 3 }];
    expect(calcPromoDiscount([item({ quantity: 2 })], promos, TTC).promoDisc).toBe(0);
    expect(calcPromoDiscount([item({ quantity: 3 })], promos, TTC).promoDisc).toBeGreaterThan(0);
  });

  it("code promo : seulement si le code saisi correspond (insensible à la casse)", () => {
    const promos = [{ name: "Code", type: "code", code: "NOEL", value: 10, discountType: "percent" }];
    expect(calcPromoDiscount([item()], promos, { ...TTC, promoCode: "" }).promoDisc).toBe(0);
    expect(calcPromoDiscount([item()], promos, { ...TTC, promoCode: "noel" }).promoDisc).toBeGreaterThan(0);
    expect(calcPromoDiscount([item()], promos, { ...TTC, promoCode: "FAUX" }).promoDisc).toBe(0);
  });

  it("la remise totale est plafonnée au total HT", () => {
    const promos = [{ name: "Mega", targetType: "category", targetValue: "Jeans", value: 500, discountType: "percent" }];
    expect(calcPromoDiscount([item()], promos, TTC).promoDisc).toBeCloseTo(HT_DUN, 3);
  });

  it("mode HT : remise calculée sur le prix HT direct", () => {
    const promos = [{ name: "X", targetType: "category", targetValue: "jeans", value: 10, discountType: "percent" }];
    expect(calcPromoDiscount([item()], promos, { pricingMode: "HT" }).promoDisc).toBeCloseTo(10, 3);
  });

  it("supporte les clés snake_case (promo_type/target_type/min_qty)", () => {
    const promos = [{ name: "X", promo_type: "category_discount", target_type: "category", target_value: "Jeans", value: 10, discount_type: "percent", min_qty: 1 }];
    expect(calcPromoDiscount([item()], promos, TTC).promoDisc).toBeGreaterThan(0);
  });
});
