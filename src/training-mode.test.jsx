// @vitest-environment jsdom
//
// MODE FORMATION (NF525) — l'etat ne doit plus retomber en production sans prevenir.
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

describe("Mode formation", () => {
  it("survit à un rechargement de page (et le trace au JET)", async () => {
    localStorage.setItem(KEY, JSON.stringify({ active: true, since: Date.now() - 3600e3, expiresAt: Date.now() + 3600e3 }));
    const { getByTestId } = mount();
    expect(ctx.trainingMode).toBe(true);
    expect(getByTestId("training-banner").textContent).toMatch(/MODE FORMATION/);
    await waitFor(() => expect(jetTexts()).toMatch(/toujours actif après rechargement/));
  });

  it("expire seul : retour en production, tracé et signalé", async () => {
    localStorage.setItem(KEY, JSON.stringify({ active: true, since: Date.now() - 9 * 3600e3, expiresAt: Date.now() - 3600e3 }));
    const { queryByTestId } = mount();
    expect(ctx.trainingMode).toBe(false);
    expect(queryByTestId("training-banner")).toBeNull();
    await waitFor(() => expect(jetTexts()).toMatch(/expiré automatiquement/));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("activation : bandeau visible + échéance enregistrée", () => {
    const { getByTestId } = mount();
    act(() => ctx.setTrainingMode(true));
    expect(getByTestId("training-banner").textContent).toMatch(/retour automatique en production/);
    const info = JSON.parse(localStorage.getItem(KEY));
    expect(info.active).toBe(true);
    expect(info.expiresAt - info.since).toBe(8 * 3600e3);
  });

  it("désactivation : plus de bandeau, plus rien en stockage", () => {
    const { queryByTestId } = mount();
    act(() => ctx.setTrainingMode(true));
    act(() => ctx.setTrainingMode(false));
    expect(queryByTestId("training-banner")).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("la déconnexion coupe le mode formation et le trace — l'événement ATTEINT le serveur", async () => {
    mount();
    act(() => ctx.setTrainingMode(true));
    await act(async () => { await ctx.logout(); });
    // Avant le correctif, le jeton était effacé avant l'envoi : aucun appel serveur.
    expect(jetTexts()).toMatch(/désactivé à la déconnexion/);
    expect(API.audit.createJet.mock.calls.some(c => c[0] === "LOGOUT")).toBe(true);
    expect(localStorage.getItem(KEY)).toBeNull();
    // le JET est calculé (empreinte) puis envoyé : asynchrone
    await waitFor(() => expect(jetTexts()).toMatch(/désactivé à la déconnexion/));
  });

  it("par défaut (rien en mémoire) : production", () => {
    const { queryByTestId } = mount();
    expect(ctx.trainingMode).toBe(false);
    expect(queryByTestId("training-banner")).toBeNull();
  });
});
