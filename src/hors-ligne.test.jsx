// @vitest-environment jsdom
//
// Mode hors-ligne (29/10/2026) : apres une connexion EN LIGNE reussie, le vendeur peut se
// reconnecter sans internet (empreinte PBKDF2 gardee sur l'appareil) et retrouve le catalogue garde
// sur l'appareil. Un refus du SERVEUR (code faux, compte desactive) ne bascule jamais hors-ligne.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
const cache = new Map();
vi.mock("./cacheLocal.js", () => ({
  lireCache: async (k) => cache.get(k) ?? null,
  ecrireCache: async (k, v) => { cache.set(k, v); return true; },
}));
vi.mock("./api.js", () => ({
  setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
  setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => "m1",
  auth: { login: vi.fn(), users: () => Promise.reject(new Error("x")) },
  sales: { list: () => Promise.resolve([]) },
  products: { list: () => Promise.resolve([]) },
}));

const donnees = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: {
  getItem: (k) => (donnees.has(k) ? donnees.get(k) : null), setItem: (k, v) => { donnees.set(k, String(v)); },
  removeItem: (k) => { donnees.delete(k); }, clear: () => donnees.clear(),
  key: (i) => [...donnees.keys()][i] ?? null, get length() { return donnees.size; } } });

import * as API from "./api.js";
import AppProvider, { useApp, fusionnerComptes } from "./context.jsx";
import { hashPinFort, verifyPin } from "./utils.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const RESEAU_COUPE = () => Promise.reject(new TypeError("Failed to fetch"));
const refus = (status, message) => () => Promise.reject(Object.assign(new Error(message), { status }));
const LEA = { id: "u1", name: "Léa", role: "cashier" };
const attendre = (cond) => vi.waitFor(() => { if (!cond()) throw new Error("pas encore"); }, { timeout: 3000 });
const messages = () => ctx.notifications.map(n => n.msg);

beforeEach(() => { cleanup(); ctx = undefined; donnees.clear(); cache.clear(); vi.clearAllMocks(); });

describe("Empreinte du PIN", () => {
  it("PBKDF2 : bon code accepté, mauvais refusé, sel différent à chaque fois", async () => {
    const a = await hashPinFort("4821"), b = await hashPinFort("4821");
    expect(a).toMatch(/^pbkdf2\$100000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
    expect(await verifyPin("4821", a)).toBe(true);
    expect(await verifyPin("4822", a)).toBe(false);
  });
});

describe("fusionnerComptes", () => {
  it("garde l'empreinte d'un compte actif, la retire d'un compte désactivé ou disparu, garde les comptes locaux", () => {
    const prev = [{ ...LEA, pin: "pbkdf2$x", apiSynced: true }, { id: "u2", name: "Paul", pin: "pbkdf2$y", apiSynced: true },
      { id: "u3", name: "Tom", pin: "pbkdf2$z", apiSynced: true }, { id: "l1", name: "Local", pin: "h", apiSynced: false }];
    const r = fusionnerComptes(prev, [LEA, { id: "u2", name: "Paul", role: "cashier", active: false }]);
    expect(r.find(u => u.id === "u1").pin).toBe("pbkdf2$x");
    expect(r.find(u => u.id === "u2").pin).toBe("****");
    expect(r.find(u => u.id === "u3")).toBeUndefined();
    expect(r.find(u => u.id === "l1")).toBeDefined();
  });
});

describe("Connexion", () => {
  it("en ligne puis coupure : reconnexion hors-ligne avec le même code, catalogue de l'appareil", async () => {
    API.auth.login.mockResolvedValue({ token: "t", user: LEA, stores: [] });
    render(<AppProvider><Harness /></AppProvider>);
    await act(async () => { await ctx.login("Léa", "4821"); });
    await attendre(() => ctx.users.find(u => u.id === "u1")?.pin?.startsWith("pbkdf2$"));
    expect(JSON.stringify(ctx.users)).not.toContain("4821");   // jamais le code en clair

    // Coupure + redemarrage de la tablette : seul le stockage de l'appareil reste
    cache.set("donnees-magasin", { storeId: "m1", products: [{ id: "p1", name: "Chemise", variants: [] }], promos: [], at: "2026-10-29T10:00:00Z" });
    cleanup(); ctx = undefined;
    API.auth.login.mockImplementation(RESEAU_COUPE);
    render(<AppProvider><Harness /></AppProvider>);
    let r;
    await act(async () => { r = await ctx.login("Léa", "0000"); });
    expect(r.ok).toBe(false);
    expect(messages()).toContain("Hors ligne : code incorrect");
    await act(async () => { r = await ctx.login("Léa", "4821"); });
    expect(r.ok).toBe(true);
    expect(ctx.offlineMode).toBe(true);
    expect(ctx.products.map(p => p.name)).toEqual(["Chemise"]);
  });

  it("refus du serveur (401) : jamais de connexion hors-ligne, même avec l'empreinte", async () => {
    localStorage.setItem("caissepro_users", JSON.stringify([{ ...LEA, pin: await hashPinFort("4821"), apiSynced: true }]));
    API.auth.login.mockImplementation(refus(401, "Identifiants incorrects"));
    render(<AppProvider><Harness /></AppProvider>);
    let r;
    await act(async () => { r = await ctx.login("Léa", "4821"); });
    expect(r).toMatchObject({ ok: false, refuse: true });
    expect(ctx.offlineMode).toBe(false);
    expect(ctx.currentUser).toBeNull();
  });

  it("API arrêtée (502 de nginx) : traitée comme une coupure", async () => {
    localStorage.setItem("caissepro_users", JSON.stringify([{ ...LEA, pin: await hashPinFort("4821"), apiSynced: true }]));
    API.auth.login.mockImplementation(refus(502, "Bad Gateway"));
    render(<AppProvider><Harness /></AppProvider>);
    let r;
    await act(async () => { r = await ctx.login("Léa", "4821"); });
    expect(r.ok).toBe(true);
    expect(ctx.offlineMode).toBe(true);
  });

  it("compte jamais connecté sur l'appareil : message clair", async () => {
    localStorage.setItem("caissepro_users", JSON.stringify([{ ...LEA, pin: "****", apiSynced: true }]));
    API.auth.login.mockImplementation(RESEAU_COUPE);
    render(<AppProvider><Harness /></AppProvider>);
    await act(async () => { await ctx.login("Léa", "4821"); });
    expect(messages().some(m => /jamais connecté sur cet appareil/.test(m))).toBe(true);
  });

  it("retour du réseau : reconnexion automatique ; refus du serveur -> déconnexion", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem("caissepro_users", JSON.stringify([{ ...LEA, pin: await hashPinFort("4821"), apiSynced: true }]));
    API.auth.login.mockImplementation(RESEAU_COUPE);
    render(<AppProvider><Harness /></AppProvider>);
    await act(async () => { await ctx.login("Léa", "4821"); });
    expect(ctx.offlineMode).toBe(true);
    // Le code a ete change sur le serveur pendant la coupure : la reconnexion est refusee
    const jetHorsLigne = () => ctx.jet.filter(j => j.type === "LOGIN_OFFLINE").length;
    // Toujours coupe : les tentatives ne rejouent pas la connexion hors-ligne (pas de JET en double)
    await act(async () => { vi.advanceTimersByTime(61000); });
    expect(jetHorsLigne()).toBe(1);
    // Le code a ete change sur le serveur pendant la coupure : la reconnexion est refusee
    API.auth.login.mockImplementation(refus(401, "Identifiants incorrects"));
    await act(async () => { vi.advanceTimersByTime(61000); });
    await attendre(() => ctx.currentUser === null);
    expect(messages().some(m => /Reconnexion refusée/.test(m))).toBe(true);
    vi.useRealTimers();
  });

  it("retour du réseau : reconnexion automatique acceptée -> fin du mode hors-ligne", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    localStorage.setItem("caissepro_users", JSON.stringify([{ ...LEA, pin: await hashPinFort("4821"), apiSynced: true }]));
    API.auth.login.mockImplementation(RESEAU_COUPE);
    render(<AppProvider><Harness /></AppProvider>);
    await act(async () => { await ctx.login("Léa", "4821"); });
    expect(ctx.offlineMode).toBe(true);
    API.auth.login.mockResolvedValue({ token: "t", user: LEA, stores: [] });
    await act(async () => { vi.advanceTimersByTime(61000); });
    await attendre(() => ctx.offlineMode === false);
    expect(ctx.currentUser?.name).toBe("Léa");
    vi.useRealTimers();
  });
});

describe("Cache de l'appareil", () => {
  it("le catalogue chargé est gardé dans IndexedDB (sans les clients)", async () => {
    render(<AppProvider><Harness /></AppProvider>);
    act(() => { ctx.setProducts([{ id: "p1", name: "Chemise", variants: [] }]); });
    await vi.waitFor(() => { if (!cache.get("donnees-magasin")) throw new Error("pas encore"); }, { timeout: 4000 });
    const c = cache.get("donnees-magasin");
    expect(c.storeId).toBe("m1");
    expect(c.products.map(p => p.name)).toEqual(["Chemise"]);
    expect(c).not.toHaveProperty("customers");
  });
});
