// @vitest-environment jsdom
//
// Test d'INTÉGRATION du paiement (checkout) via le vrai provider.
// - Mode online : API.sales.checkout résout → on vérifie le payload envoyé + panier vidé.
// - Mode offline : API.sales.checkout rejette → fallback local, ticket recalculé
//   (c'est le chemin TTC-ancré corrigé pour l'arrondi).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => ({
  setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
  setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
  sales: { checkout: vi.fn(), list: () => Promise.resolve([]) },
  products: { list: () => Promise.resolve([]) },
}));

import * as API from "./api.js";
import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const mount = () => render(<AppProvider><Harness /></AppProvider>);
const prod = (over = {}) => ({ id: "p1", name: "Jean", sku: "SKU1", price: 209, costPrice: 80, taxRate: 0.20, category: "Jeans", ...over });
const variant = (id = "v1") => ({ id, color: "Bleu", size: "M", ean: "" });

beforeEach(() => { cleanup(); ctx = undefined; vi.clearAllMocks(); });

describe("Paiement — mode online (API OK)", () => {
  it("envoie le bon payload et vide le panier", async () => {
    API.sales.checkout.mockResolvedValue({
      seq: 1, hash: "abc", grandTotal: "418", ticket_number: "TK-1",
      totalHT: 348.33, totalTVA: 69.67, totalTTC: 418, createdAt: "2026-06-26", items: [], payments: [],
    });
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.addToCart(prod(), variant()); }); // quantité 2

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 418 }], "Vendeur"); });

    expect(API.sales.checkout).toHaveBeenCalledTimes(1);
    const payload = API.sales.checkout.mock.calls[0][0];
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].quantity).toBe(2);
    expect(payload.items[0].tax_rate).toBe(0.20);
    expect(payload.globalDiscount).toBe(0);
    expect(ticket.totalTTC).toBe(418);
    expect(ctx.cart).toEqual([]); // panier vidé après succès
  });
});

describe("Paiement — mode offline (API échoue → fallback local)", () => {
  it("recalcule le ticket localement (TTC ancré) et le conserve", async () => {
    API.sales.checkout.mockRejectedValue(new Error("network down"));
    mount();
    act(() => { ctx.addToCart(prod(), variant()); });
    act(() => { ctx.addToCart(prod(), variant()); });

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 418 }], "Vendeur"); });

    // Ticket recalculé localement : TTC = 418.00, HT+TVA cohérents au centime
    expect(ticket.totalTTC).toBe(418);
    expect(Math.round((ticket.totalHT + ticket.totalTVA) * 100) / 100).toBe(418);
    expect(ticket.barcode).toMatch(/^\d{13}$/); // EAN-13 hors-ligne généré
    expect(ticket.fingerprint).toHaveLength(16); // empreinte NF525
    expect(ctx.cart).toEqual([]); // panier vidé
    expect(ctx.tickets[0].ticketNumber).toBe(ticket.ticketNumber); // ajouté à l'historique
    expect(ctx.pendingSync.length).toBeGreaterThan(0); // mis en file de synchro
  });

  it("multi-taux offline reste cohérent (HT+TVA=TTC)", async () => {
    API.sales.checkout.mockRejectedValue(new Error("offline"));
    mount();
    act(() => { ctx.addToCart(prod({ id: "p1", price: 209, taxRate: 0.20 }), variant("v1")); });
    act(() => { ctx.addToCart(prod({ id: "p2", price: 10, taxRate: 0.055 }), variant("v2")); });

    let ticket;
    await act(async () => { ticket = await ctx.checkout([{ method: "cash", amount: 219 }], "V"); });
    expect(ticket.totalTTC).toBe(219);
    expect(Math.round((ticket.totalHT + ticket.totalTVA) * 100) / 100).toBe(219);
  });
});
