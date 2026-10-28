// @vitest-environment jsdom
//
// Vente hors-ligne dont le 1er envoi échoue : elle doit être RENVOYÉE sans rechargement.
// Avant : la synchro ne se relançait que si le nombre d'éléments en file changeait — la vente
// restait bloquée et le Z était refusé (« vente(s) hors-ligne pas encore envoyée(s) », 27/10/2026).
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  // Tout espace d'API non décrit répond « rien » (les écritures d'audit/JET passent)
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "jeton-test", clearToken: () => {}, getStoreId: () => null,
    sales: ns({ checkout: vi.fn() }), products: ns(), fiscal: ns({ closure: vi.fn() }), audit: ns(), settings: ns(),
    customers: ns(), returns: ns(), giftcards: ns(), parked: ns(), stores: ns(), auth: ns(), favorites: ns(),
    health: () => Promise.resolve({ status: "ok" }),
  };
});

import * as API from "./api.js";
import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const avance = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); await act(async () => {}); };

afterEach(() => { cleanup(); vi.useRealTimers(); try { localStorage.removeItem("caissepro_pending_sync"); } catch (e) { /* jsdom */ } });

describe("Synchronisation hors-ligne — relance", () => {
  it("1er envoi refusé (serveur indisponible) puis relance automatique : la vente part, la file se vide", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    render(<AppProvider><Harness /></AppProvider>);
    // Vente faite sans réseau -> mise en file
    API.sales.checkout.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    act(() => { ctx.addToCart({ id: "p1", name: "Jean", sku: "S1", price: 50, costPrice: 10, taxRate: 0.2, category: "Jeans" }, { id: "v1", color: "Bleu", size: "M", ean: "" }); });
    await act(async () => { await ctx.checkout([{ method: "cash", amount: 50 }], "V"); });
    expect(ctx.pendingSync.filter(a => a.type === "offlineSale")).toHaveLength(1);

    // 1re tentative de synchro : le serveur répond une erreur (ex. redémarrage) -> reste en file
    API.sales.checkout.mockRejectedValueOnce(new Error("Service indisponible"));
    await avance(2500);
    const enFile = ctx.pendingSync.filter(a => a.type === "offlineSale");
    expect(enFile).toHaveLength(1);
    expect(enFile[0].lastError).toBe("Service indisponible");

    // Relance automatique (45 s) : le serveur accepte -> file vide, Z débloqué
    API.sales.checkout.mockResolvedValueOnce({ id: "s1", ticketNumber: "2026-000123" });
    await avance(46000);
    await avance(2500);
    expect(ctx.pendingSync.filter(a => a.type === "offlineSale")).toHaveLength(0);
  });

  it("« Réessayer l'envoi » relance immédiatement", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    render(<AppProvider><Harness /></AppProvider>);
    API.sales.checkout.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    act(() => { ctx.addToCart({ id: "p1", name: "Jean", sku: "S1", price: 50, costPrice: 10, taxRate: 0.2, category: "Jeans" }, { id: "v1", color: "Bleu", size: "M", ean: "" }); });
    await act(async () => { await ctx.checkout([{ method: "cash", amount: 50 }], "V"); });
    API.sales.checkout.mockRejectedValueOnce(new Error("Service indisponible"));
    await avance(2500);
    expect(ctx.pendingSync.filter(a => a.type === "offlineSale")).toHaveLength(1);
    API.sales.checkout.mockResolvedValueOnce({ id: "s1", ticketNumber: "2026-000124" });
    act(() => { ctx.retrySync(); });
    await avance(2500);
    expect(ctx.pendingSync.filter(a => a.type === "offlineSale")).toHaveLength(0);
  });
});
