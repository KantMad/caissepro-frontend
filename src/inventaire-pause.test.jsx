// @vitest-environment jsdom
//
// Inventaire en pause (MCS, 12/11/2026 : « mettre en pause les inventaires sur la caisse »).
// Avant, le comptage ne vivait que dans l'ecran : quitter l'onglet le perdait. Il est desormais
// enregistre sur le serveur au fil de la saisie, repris a l'ouverture de l'onglet, et la
// validation envoie quantite comptee + stock vu (le serveur deduit les ventes faites depuis).
import { describe, it, expect, vi } from "vitest";
import { render, waitFor, fireEvent, act } from "@testing-library/react";
import React from "react";
vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  const P = [{ id: "p1", name: "Robe soie", sku: "R1", price: "150.00", tax_rate: "0.2000", active: true,
    variants: [{ id: "v1", color: "Noir", size: "S", ean: "3000000000011", stock: 4, stock_alert: 1, deja_stocke: true },
               { id: "v2", color: "Noir", size: "M", ean: "3000000000012", stock: 6, stock_alert: 1, deja_stocke: true }] }];
  const J = globalThis.__inv = { envois: [], clotures: [], ajustements: [] };
  const session = () => ({ id: "s1", status: "open", created_at: "2026-11-10T09:00:00Z", updated_at: "2026-11-10T09:30:00Z", created_by_name: "Fred", updated_by_name: "Fred",
    counts: { p1_v1: { c: 3, s: 5 } } });   // compte avant la pause : 3 vus 5 ; 1 vendu depuis (stock 4)
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => "s1",
    products: ns({ list: () => Promise.resolve(P) }), sales: ns(), fiscal: ns(), audit: ns(), settings: ns(),
    customers: ns(), returns: ns(), giftcards: ns(), parked: ns(), stores: ns(), auth: ns(), favorites: ns(),
    stock: ns({
      inventorySession: () => Promise.resolve(session()),
      saveInventorySession: (counts) => { J.envois.push(counts); const s = session(); Object.assign(s.counts, counts); return Promise.resolve(s); },
      closeInventorySession: (st) => { J.clotures.push(st); return Promise.resolve({ ok: true, closed: true }); },
      adjustBatch: (d) => { J.ajustements.push(...d.items); return Promise.resolve({ ok: true, results: d.items.map(i => ({ variantId: i.variantId, ok: true })) }); },
    }),
    tenues: ns(), transfers: ns(), users: ns(), retouches: ns(), cashMovements: ns(), promos: ns(),
    health: () => Promise.resolve({ status: "ok" }),
  };
});
import AppProvider, { useApp } from "./context.jsx";
import { StockScreen } from "./screens/index.js";
if (typeof globalThis.ResizeObserver === "undefined") globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };

describe("Inventaire : pause et reprise", () => {
  it("reprend le comptage, l'enregistre au fil de la saisie, valide avec le stock vu", async () => {
    sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Admin", role: "admin" }));
    sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
    sessionStorage.setItem("caissepro_mode", "dashboard");
    let ctx; const H = () => { ctx = useApp(); return null; };
    const r = render(<AppProvider><H /><StockScreen /></AppProvider>);
    await waitFor(() => expect(ctx.products.length).toBe(1));
    const J = globalThis.__inv;
    const b = r.getAllByText("Inventaire"); await act(async () => { fireEvent.click(b[b.length - 1]); });
    // Reprise : bandeau + quantite comptee avant la pause, ecart calcule sur le stock VU (3 - 5)
    await waitFor(() => expect(r.getByTestId("inv-reprise").textContent).toMatch(/1 article\(s\) compté\(s\).*Fred/));
    const champs = () => [...r.container.querySelectorAll('input[type="number"][min="0"]')];
    expect(champs()[0].value).toBe("3");
    expect(r.container.textContent).toMatch(/-2/);
    // Nouvelle saisie : enregistree sur le serveur ~1 s apres (pas de localStorage)
    await act(async () => { fireEvent.change(champs()[1], { target: { value: "7" } }); });
    await waitFor(() => expect(J.envois).toContainEqual({ p1_v2: { c: 7, s: 6 } }), { timeout: 3000 });
    expect(r.getByTestId("inv-etat").textContent).toMatch(/enregistré/);
    // Validation : quantite comptee + stock vu, puis inventaire clos
    await act(async () => { fireEvent.click(r.getByText("Valider l'inventaire")); });
    await waitFor(() => expect(J.clotures).toEqual(["done"]));
    expect(J.ajustements).toEqual([{ variantId: "v1", counted: 3, seenStock: 5 }, { variantId: "v2", counted: 7, seenStock: 6 }]);
  }, 30000);
});
