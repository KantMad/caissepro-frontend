// @vitest-environment jsdom
//
// Opération hors-ligne déjà enregistrée par le serveur mais dont la réponse s'est perdue (coupure
// pendant l'envoi) : le renvoi est refusé « déjà fait » (409). Avant : elle restait en file, en
// rouge, pour toujours. Elle doit être retirée — mais seulement si c'est bien la même.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import React from "react";

vi.mock("./printer.js", () => ({ default: { connect: vi.fn(), isConnected: () => false, disconnect: vi.fn(), on: () => () => {} } }));
vi.mock("./hardware.js", () => ({
  default: { init: () => "browser", currentProfile: { id: "browser" }, setHardware: vi.fn(), getActiveAdapter: () => null, detect: vi.fn(), on: () => () => {}, charge: vi.fn() },
}));
vi.mock("./api.js", () => {
  const ns = (fixes = {}) => new Proxy(fixes, { get: (t, k) => (k in t ? t[k] : (k === "then" ? undefined : () => Promise.resolve([]))) });
  return {
    setOnAuthExpired: () => {}, setStoreId: () => {}, clearStoreId: () => {},
    setToken: () => {}, getToken: () => "jeton-test", clearToken: () => {}, getStoreId: () => "m1",
    sales: ns(), products: ns(), fiscal: ns({ closure: vi.fn() }), audit: ns(), settings: ns(),
    customers: ns(), returns: ns(), giftcards: ns({ create: vi.fn(), get: vi.fn() }), parked: ns(), stores: ns(), auth: ns(), favorites: ns(),
    health: () => Promise.resolve({ status: "ok" }),
  };
});

import * as API from "./api.js";
import AppProvider, { useApp } from "./context.jsx";

let ctx;
function Harness() { ctx = useApp(); return null; }
const avance = async (ms) => { await act(async () => { vi.advanceTimersByTime(ms); }); await act(async () => {}); };
const deja = (message, data) => Object.assign(new Error(message), { status: 409, data });
const enFile = (type) => ctx.pendingSync.filter(a => a.type === type);

afterEach(() => { cleanup(); vi.useRealTimers(); vi.clearAllMocks(); });

describe("Renvoi d'une opération déjà enregistrée", () => {
  it("Z journalier : envoyé avec sa journée, retiré de la file si le serveur l'a déjà", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    render(<AppProvider><Harness /></AppProvider>);
    API.fiscal.closure.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => { await ctx.createClosure("daily", 100, 50, "2026-10-29"); });
    expect(enFile("offlineClosure")).toHaveLength(1);
    expect(enFile("offlineClosure")[0].data.date).toBe("2026-10-29");
    API.fiscal.closure.mockRejectedValueOnce(deja("La journée du 29/10/2026 est déjà clôturée"));
    await avance(2500);
    expect(enFile("offlineClosure")).toHaveLength(0);
  });

  it("Z mensuel dont la période a un Z fait trop tôt : reste en file (à traiter à la main)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    render(<AppProvider><Harness /></AppProvider>);
    API.fiscal.closure.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => { await ctx.createClosure("monthly", 0, 0); });
    API.fiscal.closure.mockRejectedValue(deja("Le mois 2026-10 est déjà clôturé, mais par un Z fait avant la fin de la période", { complementPossible: true }));
    await avance(2500);
    expect(enFile("offlineClosure")).toHaveLength(1);
  });

  it("carte cadeau : retirée si la carte existe avec le même montant, gardée sinon", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    render(<AppProvider><Harness /></AppProvider>);
    API.giftcards.create.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(async () => { await ctx.createGiftCard(50, "Inès", "cash"); });
    const code = enFile("createGiftCard")[0].data.code;
    // Même code mais autre montant : ce n'est pas notre carte -> on la garde
    API.giftcards.create.mockRejectedValueOnce(deja("Une carte cadeau avec ce code existe déjà"));
    API.giftcards.get.mockResolvedValueOnce({ code, initial_amount: "80.00", store_id: "m1" });
    await avance(2500);
    expect(enFile("createGiftCard")).toHaveLength(1);
    // La carte enregistrée est bien la nôtre -> retirée de la file
    API.giftcards.create.mockRejectedValueOnce(deja("Une carte cadeau avec ce code existe déjà"));
    API.giftcards.get.mockResolvedValueOnce({ code, initial_amount: "50.00", store_id: "m1" });
    act(() => { ctx.retrySync(); });
    await avance(2500);
    expect(enFile("createGiftCard")).toHaveLength(0);
  });
});
