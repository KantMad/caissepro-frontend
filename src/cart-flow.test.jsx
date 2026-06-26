// @vitest-environment jsdom
//
// Test d'INTÉGRATION : monte le vrai AppProvider (god-provider) et pilote le
// panier via le hook useApp, comme le ferait l'écran de caisse. Vérifie que
// addToCart + remises + état + computeTotals s'assemblent correctement.
// Sans login (pas de token), loadAllData() ne s'exécute pas → zéro appel réseau.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

// Évite les effets de bord d'import du matériel d'impression (Capacitor, WebSerial…)
vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: {
    init: () => "browser",
    currentProfile: { id: "browser", name: "Navigateur" },
    setHardware: vi.fn(),
    getActiveAdapter: () => null,
    detect: vi.fn(),
    on: () => () => {},
  },
}));

import AppProvider, { useApp } from "./context.jsx";

// Harnais : capture la valeur du contexte à chaque rendu
let ctx;
function Harness() {
  ctx = useApp();
  return null;
}
const mount = () => render(<AppProvider><Harness /></AppProvider>);

// Produits de test
const prod = (over = {}) => ({ id: "p1", name: "Jean", sku: "SKU1", price: 209, costPrice: 80, taxRate: 0.20, category: "Jeans", ...over });
const variant = (id = "v1") => ({ id, color: "Bleu", size: "M", ean: "" });

beforeEach(() => { cleanup(); ctx = undefined; });

describe("Flux panier (intégration provider)", () => {
  it("panier vide au départ → totaux à zéro", () => {
    mount();
    expect(ctx.cart).toEqual([]);
    expect(ctx.cartTotals.tTTC).toBe(0);
  });

  it("ajoute 2× un article à 209 → TTC = 418.00 (HT+TVA cohérents)", () => {
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.addToCart(prod(), variant()); }); // même ligne → quantité 2
    expect(ctx.cart).toHaveLength(1);
    expect(ctx.cart[0].quantity).toBe(2);
    expect(ctx.cartTotals.tTTC).toBe(418);
    expect(Math.round((ctx.cartTotals.tHT + ctx.cartTotals.tTVA) * 100) / 100).toBe(418);
  });

  it("deux produits distincts → deux lignes, total additionné", () => {
    mount();
    act(() => { ctx.addToCart(prod({ id: "p1" }), variant("v1")); });
    act(() => { ctx.addToCart(prod({ id: "p2", price: 9.99 }), variant("v2")); });
    expect(ctx.cart).toHaveLength(2);
    expect(ctx.cartTotals.tTTC).toBe(218.99);
  });

  it("remise de ligne -50% → total divisé par 2", () => {
    mount();
    act(() => { ctx.addToCart(prod({ price: 100 }), variant()); });
    act(() => { ctx.updateItemDisc("p1", "v1", 50, "percent"); });
    expect(ctx.cartTotals.tTTC).toBe(50);
  });

  it("remise globale 10% sur 2×209 → 376.20", () => {
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.setCartGD(10, "percentage"); });
    expect(ctx.cartTotals.tTTC).toBe(376.2);
    expect(Math.round((ctx.cartTotals.tHT + ctx.cartTotals.tTVA) * 100) / 100).toBe(376.2);
  });

  it("updateQty met à jour la quantité et le total", () => {
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.updateQty("p1", "v1", 3); });
    expect(ctx.cart[0].quantity).toBe(3);
    expect(ctx.cartTotals.tTTC).toBe(627);
  });

  it("article personnalisé (addCustomItem) apparaît dans le panier", () => {
    mount();
    act(() => { ctx.addCustomItem("Retouche", 15, 0.20); });
    expect(ctx.cart).toHaveLength(1);
    expect(ctx.cart[0].isCustom).toBe(true);
    expect(ctx.cartTotals.tTTC).toBe(15);
  });

  it("clearCart remet tout à zéro", () => {
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    expect(ctx.cartTotals.tTTC).toBe(209);
    act(() => { ctx.clearCart(); });
    expect(ctx.cart).toEqual([]);
    expect(ctx.cartTotals.tTTC).toBe(0);
  });
});
