// @vitest-environment jsdom
//
// Stockage de l'appareil PLEIN : la file hors-ligne (ventes pas encore sur le serveur) doit quand
// meme etre sauvegardee, en sacrifiant les caches de lecture. Avant, l'echec etait avale en
// silence et un rechargement de la page perdait les ventes hors-ligne.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  fiscal: { closure: vi.fn() },
}));

import AppProvider, { useApp } from "./context.jsx";

// localStorage a quota : refuse toute ecriture qui depasserait LIMITE caracteres
const LIMITE = 200_000;
let donnees, original;
const faux = {
  getItem: (k) => (donnees.has(k) ? donnees.get(k) : null),
  setItem: (k, v) => {
    const total = [...donnees].reduce((n, [kk, vv]) => n + (kk === k ? 0 : kk.length + vv.length), 0) + k.length + String(v).length;
    if (total > LIMITE) throw new DOMException("quota", "QuotaExceededError");
    donnees.set(k, String(v));
  },
  removeItem: (k) => { donnees.delete(k); },
  clear: () => donnees.clear(),
  key: (i) => [...donnees.keys()][i] ?? null,
  get length() { return donnees.size; },
};

let ctx;
function Harness() { ctx = useApp(); return null; }

beforeEach(() => {
  cleanup(); ctx = undefined; donnees = new Map();
  original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", { configurable: true, value: faux });
});
afterEach(() => { Object.defineProperty(window, "localStorage", original); });

describe("Stockage plein", () => {
  it("la file hors-ligne est sauvegardée en vidant les caches de lecture", async () => {
    // Cache de tickets qui remplit presque tout le stockage
    donnees.set("caissepro_pricehistory", "[" + '"x",'.repeat(20_000) + '"x"]');
    donnees.set("caissepro_tickets", "[" + '"y",'.repeat(25_000) + '"y"]');
    render(<AppProvider><Harness /></AppProvider>);
    const vente = { type: "offlineSale", data: { clientSaleId: "abc", note: "z".repeat(60_000) } };
    await act(async () => { ctx.addPendingSync(vente); });
    const file = JSON.parse(donnees.get("caissepro_pendingSync") || "[]");
    expect(file.some(a => a.data?.clientSaleId === "abc")).toBe(true);
    expect(donnees.has("caissepro_pricehistory")).toBe(false);   // cache sacrifie en premier
  });
});
