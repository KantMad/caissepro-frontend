// @vitest-environment jsdom
//
// Alertes de stock : une variante jamais reçue (créée par un import de catalogue, aucun mouvement
// de stock : deja_stocke = false) n'est ni une rupture ni un réassort à faire. MCS affichait
// 50 188 alertes, presque toutes des articles du catalogue jamais rentrés en boutique.
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  const v = (id, stock, deja) => ({ id, color: "Noir", size: id, ean: "", stock, stock_alert: 3, ...(deja === undefined ? {} : { deja_stocke: deja }) });
  const PRODUIT = { id: "p1", name: "Pull", sku: "P1", price: "90.00", tax_rate: "0.2000", active: true,
    variants: [v("S", 0, false), v("M", 0, true), v("L", 2, true), v("XL", 0), v("XXL", 20, true)] };
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => "s1",
    products: ns({ list: () => Promise.resolve([PRODUIT]) }), sales: ns(), fiscal: ns(), audit: ns(), settings: ns(),
    customers: ns(), returns: ns(), giftcards: ns(), parked: ns(), stores: ns(), auth: ns(), favorites: ns(),
    health: () => Promise.resolve({ status: "ok" }),
  };
});

import AppProvider, { useApp } from "./context.jsx";

describe("Alertes de stock", () => {
  it("ignore les variantes jamais reçues ; garde les vraies ruptures, les stocks bas et l'ancienne API", async () => {
    sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Admin", role: "admin" }));
    sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
    let ctx; const Harness = () => { ctx = useApp(); return null; };
    render(<AppProvider><Harness /></AppProvider>);
    await waitFor(() => expect(ctx.products.length).toBe(1));
    const alertes = ctx.stockAlerts.map(a => `${a.variant.size}:${a.level}`).sort();
    // S : jamais reçue -> ignorée ; M : vendue jusqu'à 0 -> rupture ; L : stock bas ;
    // XL : champ absent (ancienne API) -> rupture comme avant ; XXL : stock correct
    expect(alertes).toEqual(["L:bas", "M:rupture", "XL:rupture"]);
    expect(ctx.reorderSuggestions.map(s => s.variant.size).sort()).toEqual(["L", "M", "XL"]);
  });
});
