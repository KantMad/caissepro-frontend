// @vitest-environment jsdom
//
// Panier gardé au rechargement (MCS 13/11/2026 : « le panier disparaît si je change de page »).
// Une mise à jour du serveur pendant que la caisse est ouverte fait recharger l'application à
// l'ouverture d'un écran de gestion : le panier, gardé en mémoire seulement, était perdu.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn(), refund: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  return new Proxy({
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
    sales: ns({ checkout: vi.fn(() => Promise.resolve({ seq: 1, hash: "h", grandTotal: "120", ticket_number: "TK-1", totalHT: 100, totalTVA: 20, totalTTC: 120, items: [], payments: [] })) }),
  }, { get: (t, k) => (k in t ? t[k] : (k === "then" || k === "__esModule" ? undefined : ns())) });
});
import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const ouvrir = (user = "u1") => {
  sessionStorage.setItem("caissepro_user", JSON.stringify({ id: user, name: "Fred", role: "manager" }));
  sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
  return render(<AppProvider><Harness /></AppProvider>);
};
const prod = { id: "p1", name: "Robe", sku: "R1", price: 120, costPrice: 50, taxRate: 0.20, category: "Robes" };
const variant = { id: "v1", color: "Noir", size: "M", ean: "" };

beforeEach(() => { cleanup(); sessionStorage.clear(); });

describe("Panier gardé au rechargement de l'application", () => {
  it("retrouvé après rechargement (même utilisateur, même magasin), avec remise et note", () => {
    ouvrir();
    act(() => { ctx.addToCart(prod, variant); ctx.addToCart(prod, variant); });
    act(() => { ctx.setCartGD(10, 0); });
    cleanup();                                   // l'application se recharge
    ouvrir();
    expect(ctx.cart).toHaveLength(1);
    expect(ctx.cart[0].quantity).toBe(2);
    expect(ctx.gDiscPct).toBe(10);
  });

  it("pas repris pour un autre utilisateur", () => {
    ouvrir("u1");
    act(() => { ctx.addToCart(prod, variant); });
    cleanup();
    ouvrir("u2");
    expect(ctx.cart).toEqual([]);
  });

  it("vidé après la vente : rien à reprendre", async () => {
    ouvrir();
    act(() => { ctx.addToCart(prod, variant); });
    await act(async () => { await ctx.checkout([{ method: "cash", amount: 120 }], "Fred"); });
    expect(sessionStorage.getItem("caissepro_panier")).toBeNull();
    cleanup();
    ouvrir();
    expect(ctx.cart).toEqual([]);
  });
});
