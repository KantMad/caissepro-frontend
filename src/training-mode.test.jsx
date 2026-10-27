// @vitest-environment jsdom
//
// MODE FORMATION — retire de la caisse de production (27/10/2026) : formation sur la demo.
// Un appareil reste en formation doit revenir en production, de facon tracee.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stockage en memoire (l'environnement de test n'en fournit pas de fonctionnel)
const memoire = () => { let m = {}; return {
  getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); },
  removeItem: (k) => { delete m[k]; }, clear: () => { m = {}; }, key: (i) => Object.keys(m)[i] ?? null,
  get length() { return Object.keys(m).length; } }; };
Object.defineProperty(globalThis, "localStorage", { value: memoire(), configurable: true, writable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: memoire(), configurable: true, writable: true });
import { render, act, cleanup, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const empty = () => Promise.resolve([]);
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : empty)) });
  // Jeton REEL : clearToken l'efface vraiment (c'est ce qui masquait le bug du LOGOUT)
  let jeton = "t";
  const mod = { setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: (v) => { jeton = v; }, getToken: () => jeton, clearToken: () => { jeton = null; },
    getStoreId: () => "s1", __remettreJeton: () => { jeton = "t"; } };
  for (const n of ["auth","products","sales","returns","customers","stock","fiscal","settings","stores",
    "giftcards","parked","pricehistory","favorites","footfall","retouches","tenues","cashMovements",
    "exports","barcodes","customerDisplay","backup","productPhotos","integrations","health"]) mod[n] = ns();
  mod.audit = ns({ createJet: vi.fn(() => Promise.resolve({})), create: vi.fn(() => Promise.resolve({})) });
  return mod;
});

import * as API from "./api.js";
import AppProvider, { useApp } from "./context.jsx";
import { TrainingBanner } from "./nav.jsx";

let ctx;
function Harness() { ctx = useApp(); return <TrainingBanner />; }
const mount = () => render(<AppProvider><Harness /></AppProvider>);
const KEY = "caissepro_training";
const jetTexts = () => API.audit.createJet.mock.calls.map(c => c[1]).join("\n");

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem("caissepro_user", JSON.stringify({ id: "u1", name: "Sophie", role: "admin" }));
  API.audit.createJet.mockClear();
  API.__remettreJeton();
});
afterEach(cleanup);

describe("Mode formation retiré de la caisse", () => {
  it("un appareil resté en formation repasse en PRODUCTION au chargement, tracé au JET", async () => {
    localStorage.setItem(KEY, JSON.stringify({ active: true, since: Date.now() - 3600e3, expiresAt: Date.now() + 3600e3 }));
    const { queryByTestId } = mount();
    expect(ctx.trainingMode).toBe(false);
    expect(queryByTestId("training-banner")).toBeNull();
    await waitFor(() => expect(jetTexts()).toMatch(/retiré de la caisse/));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ne peut plus être activé", () => {
    const { queryByTestId } = mount();
    act(() => ctx.setTrainingMode(true));
    expect(ctx.trainingMode).toBe(false);
    expect(queryByTestId("training-banner")).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("la déconnexion trace LOGOUT et l'événement ATTEINT le serveur", async () => {
    mount();
    await act(async () => { await ctx.logout(); });
    // Avant le correctif, le jeton était effacé avant l'envoi : aucun appel serveur.
    expect(API.audit.createJet.mock.calls.some(c => c[0] === "LOGOUT")).toBe(true);
  });

  it("par défaut (rien en mémoire) : production", () => {
    const { queryByTestId } = mount();
    expect(ctx.trainingMode).toBe(false);
    expect(queryByTestId("training-banner")).toBeNull();
  });
});
