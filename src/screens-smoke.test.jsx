// @vitest-environment jsdom
//
// Test de FUMÉE des écrans : on les monte pour de vrai dans le provider.
// Objectif : attraper les plantages au rendu (variable non définie, import manquant)
// que `vite build` ne voit pas — ils n'apparaissaient qu'à l'écran, en production.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
// Simulacre d'API : chaque espace de noms renvoie une liste vide pour toute méthode.
// Un ecran ajoute au test n'oblige donc pas a enrichir le mock appel par appel.
vi.mock("./api.js", () => {
  const empty = () => Promise.resolve([]);
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : empty)) });
  const NAMESPACES = ["auth", "products", "sales", "returns", "customers", "stock", "fiscal", "audit",
    "settings", "stores", "giftcards", "parked", "pricehistory", "favorites", "footfall", "retouches",
    "tenues", "cashMovements", "exports", "barcodes", "customerDisplay", "backup", "productPhotos",
    "integrations", "health"];
  const mod = {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => "s1",
  };
  for (const n of NAMESPACES) mod[n] = ns();
  mod.exports = ns({ url: () => "http://x", salesDetailUrl: () => "http://x" });
  mod.cashMovements = ns({ exportUrl: () => "http://x" });
  mod.products = ns({ exportCSV: () => "http://x" });
  return mod;
});

import AppProvider from "./context.jsx";
import ExportsScreen from "./screens/ExportsScreen.jsx";
import FiscalScreen from "./screens/FiscalScreen.jsx";
import StockScreen from "./screens/StockScreen.jsx";
import StatsScreen from "./screens/StatsScreen.jsx";

// Un admin en session : sans cela les ecrans affichent « Acces reserve aux administrateurs »
const asAdmin = () => {
  sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Admin", role: "admin" }));
  sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
  sessionStorage.setItem("caissepro_mode", "dashboard");
};

// recharts (graphiques des stats) exige ResizeObserver, absent de jsdom
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}

const errors = [];
beforeEach(() => {
  asAdmin(); errors.length = 0; vi.spyOn(console, "error").mockImplementation((...a) => errors.push(a.join(" "))); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Écrans — rendu sans plantage", () => {
  it("Exports se monte (tous les onglets)", () => {
    const { container } = render(<AppProvider><ExportsScreen /></AppProvider>);
    expect(container.textContent).toContain("Exports");
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read/);
  });

  it("Stock se monte, TOUS ses onglets compris", () => {
    // Le plantage « trPreview is not defined » n'apparaissait que sur l'onglet Tenues :
    // un rendu de l'onglet par defaut ne suffit pas, on clique chaque onglet.
    const { container, getAllByText } = render(<AppProvider><StockScreen /></AppProvider>);
    for (const t of ["Matrice", "Réception", "Alertes", "Mouvements", "Inventaire",
                     "Ajustement", "Défectueux", "Tenues", "Transferts", "Vieillissement"]) {
      // plusieurs boutons peuvent porter le meme libelle : le dernier est l'onglet
      const boutons = getAllByText(t);
      fireEvent.click(boutons[boutons.length - 1]);
      expect(errors.join("\n"), `onglet ${t}`).not.toMatch(/is not defined|Cannot read/);
    }
    expect(container.textContent.length).toBeGreaterThan(0);
  });

  it("Stats se monte", () => {
    const { container } = render(<AppProvider><StatsScreen /></AppProvider>);
    expect(container.textContent.length).toBeGreaterThan(0);
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read/);
  });

  it("Fiscal se monte (FEC + archive)", () => {
    const { container } = render(<AppProvider><FiscalScreen /></AppProvider>);
    expect(container.textContent.length).toBeGreaterThan(0);
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read/);
  });
});
