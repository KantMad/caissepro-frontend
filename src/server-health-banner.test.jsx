// @vitest-environment jsdom
// Bandeau admin « serveur dégradé » : les migrations 034-042 sont restées bloquées des
// semaines en production sans que rien ne le montre. Le bandeau doit s'afficher pour un
// administrateur quand /api/health répond « degraded », et jamais sinon.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";

const etat = { user: { role: "admin" }, health: { status: "ok", migrations: "a jour" } };
vi.mock("./context.jsx", () => ({ useApp: () => ({ currentUser: etat.user }), SYNC_CRITIQUE: [] }));
vi.mock("./api.js", () => ({ health: () => Promise.resolve(etat.health) }));
vi.mock("./printer.js", () => ({ default: {} }));
vi.mock("./hardware.js", () => ({ default: {} }));

const { ServerHealthBanner } = await import("./nav.jsx");
afterEach(cleanup);

describe("ServerHealthBanner", () => {
  it("visible pour un admin quand le serveur est dégradé, avec le message", async () => {
    etat.user = { role: "admin" }; etat.health = { status: "degraded", migrations: "ECHEC : could not create unique index" };
    const r = render(<ServerHealthBanner />);
    await waitFor(() => expect(r.getByTestId("server-health-banner").textContent).toMatch(/could not create unique index/));
  });
  it("absent quand le serveur va bien", async () => {
    etat.user = { role: "admin" }; etat.health = { status: "ok", migrations: "a jour" };
    const r = render(<ServerHealthBanner />);
    await new Promise((res) => setTimeout(res, 20));
    expect(r.queryByTestId("server-health-banner")).toBeNull();
  });
  it("jamais montré à un caissier", async () => {
    etat.user = { role: "cashier" }; etat.health = { status: "degraded", migrations: "ECHEC" };
    const r = render(<ServerHealthBanner />);
    await new Promise((res) => setTimeout(res, 20));
    expect(r.queryByTestId("server-health-banner")).toBeNull();
  });
});
