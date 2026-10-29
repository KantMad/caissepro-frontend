// @vitest-environment jsdom
//
// Plus aucune donnee de DEMONSTRATION dans la vraie caisse (29/10/2026) : avant, les promos
// initiales etaient celles de la demo (code WELCOME10 -10 % actif, gardees si le chargement
// serveur echouait) et la connexion hors-ligne remplacait le catalogue par 6 faux produits.
import { it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => ({
  setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
  setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
  auth: { login: () => Promise.reject(new TypeError("Failed to fetch")) },   // reseau coupe
  sales: { list: () => Promise.resolve([]) },
  products: { list: () => Promise.resolve([]) },
}));

// Stockage en memoire : sous Node 25, le localStorage natif de Node (sans fichier) n'a pas setItem
const donnees = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
  getItem: (k) => (donnees.has(k) ? donnees.get(k) : null), setItem: (k, v) => { donnees.set(k, String(v)); },
  removeItem: (k) => { donnees.delete(k); }, clear: () => donnees.clear(),
  key: (i) => [...donnees.keys()][i] ?? null, get length() { return donnees.size; } } });

import AppProvider, { useApp } from "./context.jsx";
import { hashPin } from "./utils.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }

it("aucune promo de démonstration au démarrage", () => {
  render(<AppProvider><Harness /></AppProvider>);
  expect(ctx.promos).toEqual([]);
});

it("connexion hors-ligne : pas de faux produits, clients ni promos", async () => {
  localStorage.setItem("caissepro_users", JSON.stringify([{ id: "u1", name: "Léa", role: "cashier", pin: await hashPin("4821") }]));
  render(<AppProvider><Harness /></AppProvider>);
  let r;
  await act(async () => { r = await ctx.login("Léa", "4821"); });
  expect(r.ok).toBe(true);
  expect(ctx.offlineMode).toBe(true);
  expect(ctx.products).toEqual([]);
  expect(ctx.customers.some(c => c.lastName === "Dupont")).toBe(false);
  expect(ctx.promos).toEqual([]);
});
