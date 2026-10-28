// @vitest-environment jsdom
// Rappel des clôtures en retard : visible du gérant/admin quand des journées passées n'ont pas de
// Z ou que le Z mensuel du mois terminé manque ; jamais pour un caissier, rien si tout est à jour.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import React from "react";

const etat = { peut: true, pending: null };
vi.mock("./context.jsx", () => ({
  useApp: () => ({ perm: () => ({ canCloseZ: etat.peut }), currentStore: { id: "s1" }, closures: [] }), SYNC_CRITIQUE: [] }));
vi.mock("./api.js", () => ({ fiscal: { pendingClosures: () => Promise.resolve(etat.pending) } }));
vi.mock("./printer.js", () => ({ default: {} }));
vi.mock("./hardware.js", () => ({ default: {} }));

const { ClotureRappelBanner } = await import("./nav.jsx");
afterEach(cleanup);
const attendre = () => new Promise((r) => setTimeout(r, 20));

describe("ClotureRappelBanner", () => {
  it("liste les journées passées sans Z et le Z mensuel (pas la journée en cours)", async () => {
    etat.peut = true;
    etat.pending = { today: "2026-10-28", days: [{ day: "2026-10-05" }, { day: "2026-10-27" }, { day: "2026-10-28" }],
      monthly: { periode: "2026-09", ventes: 56, complement: false } };
    const r = render(<ClotureRappelBanner />);
    await waitFor(() => expect(r.getByTestId("cloture-rappel").textContent).toMatch(/2 journée\(s\) sans Z/));
    expect(r.getByTestId("cloture-rappel").textContent).toMatch(/05\/10, 27\/10/);
    expect(r.getByTestId("cloture-rappel").textContent).toMatch(/Z mensuel de septembre/);
  });
  it("Z mensuel complémentaire signalé comme tel", async () => {
    etat.peut = true; etat.pending = { today: "2026-11-01", days: [], monthly: { periode: "2026-10", ventes: 120, complement: true } };
    const r = render(<ClotureRappelBanner />);
    await waitFor(() => expect(r.getByTestId("cloture-rappel").textContent).toMatch(/Z mensuel complémentaire de octobre/));
  });
  it("rien quand tout est clôturé (la journée du jour ne compte pas)", async () => {
    etat.peut = true; etat.pending = { today: "2026-10-28", days: [{ day: "2026-10-28" }], monthly: null };
    const r = render(<ClotureRappelBanner />); await attendre();
    expect(r.queryByTestId("cloture-rappel")).toBeNull();
  });
  it("jamais pour un caissier", async () => {
    etat.peut = false; etat.pending = { today: "2026-10-28", days: [{ day: "2026-10-05" }], monthly: null };
    const r = render(<ClotureRappelBanner />); await attendre();
    expect(r.queryByTestId("cloture-rappel")).toBeNull();
  });
});
