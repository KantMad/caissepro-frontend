// @vitest-environment jsdom
//
// Connexion refusee par le serveur pour trop d'essais (429) : le motif du serveur doit s'afficher.
// Avant, toute erreur basculait vers la connexion hors-ligne -> « Connexion impossible en mode
// hors ligne », trompeur alors que le serveur repond.
import { it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
const MOTIF = "Trop de codes faux pour « Léa » depuis un appareil inconnu : réessayez dans 42 min, ou depuis la caisse du magasin.";
vi.mock("./api.js", () => ({
  setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
  setToken: () => {}, getToken: () => null, clearToken: () => {}, getStoreId: () => null,
  auth: { login: () => Promise.reject(Object.assign(new Error(MOTIF), { status: 429 })) },
  sales: { list: () => Promise.resolve([]) },
  products: { list: () => Promise.resolve([]) },
}));

import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }

it("connexion refusée (429) : motif du serveur affiché, pas de bascule hors-ligne", async () => {
  render(<AppProvider><Harness /></AppProvider>);
  let r;
  await act(async () => { r = await ctx.login("Léa", "1234"); });
  expect(r.ok).toBe(false);
  expect(ctx.notifications.map(n => n.msg)).toContain(MOTIF);
  expect(ctx.offlineMode).toBe(false);
});
