// @vitest-environment jsdom
//
// Test de FUMÉE des écrans : on les monte pour de vrai dans le provider.
// Objectif : attraper les plantages au rendu (variable non définie, import manquant)
// que `vite build` ne voit pas — ils n'apparaissaient qu'à l'écran, en production.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const empty = () => Promise.resolve([]);
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "t", clearToken: () => {}, getStoreId: () => "s1",
    sales: { list: empty }, products: { list: empty }, customers: { list: empty },
    returns: { list: empty, counter: () => Promise.resolve({}) },
    fiscal: { closures: empty, counter: () => Promise.resolve({}) },
    audit: { list: empty, jet: empty, clock: empty, priceHistory: empty,
      create: () => Promise.resolve({}), createJet: () => Promise.resolve({}) },
    settings: { get: () => Promise.resolve({}), promos: empty, activePromos: empty, favorites: empty },
    exports: { url: () => "http://x", salesDetailUrl: () => "http://x" },
    giftcards: { list: empty }, parked: { list: empty }, favorites: { list: empty },
    stock: { transfers: empty, alerts: empty }, tenues: { list: empty },
    cashMovements: { list: empty, exportUrl: () => "http://x" },
    retouches: { list: empty }, stores: { list: empty }, footfall: { list: empty },
  };
});

import AppProvider from "./context.jsx";
import ExportsScreen from "./screens/ExportsScreen.jsx";
import FiscalScreen from "./screens/FiscalScreen.jsx";

// Un admin en session : sans cela les ecrans affichent « Acces reserve aux administrateurs »
const asAdmin = () => {
  sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Admin", role: "admin" }));
  sessionStorage.setItem("caissepro_store", JSON.stringify({ id: "s1", name: "Boutique" }));
  sessionStorage.setItem("caissepro_mode", "dashboard");
};

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

  it("Fiscal se monte (FEC + archive)", () => {
    const { container } = render(<AppProvider><FiscalScreen /></AppProvider>);
    expect(container.textContent.length).toBeGreaterThan(0);
    expect(errors.join("\n")).not.toMatch(/is not defined|Cannot read/);
  });
});
