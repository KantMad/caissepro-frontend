// @vitest-environment jsdom
// « Premiers pas » : liste de ce qui manque pour vendre en règle sur un magasin neuf.
import { describe, it, expect, vi } from "vitest";
vi.mock("./context.jsx", () => ({ useApp: () => ({}), SYNC_CRITIQUE: [] }));
vi.mock("./api.js", () => ({}));
vi.mock("./printer.js", () => ({ default: {} }));
vi.mock("./hardware.js", () => ({ default: {} }));
const { etapesPremiersPas } = await import("./nav.jsx");
const manquants = (x) => etapesPremiersPas(x).filter((e) => !e.ok).map((e) => e.id);

describe("etapesPremiersPas", () => {
  it("instance neuve : tout est à faire", () => {
    expect(manquants({ settings: {}, products: [], users: [{ role: "admin" }] }))
      .toEqual(["identite", "legal", "service", "catalogue", "equipe"]);
  });
  it("magasin complet : rien à faire", () => {
    expect(manquants({
      settings: { name: "Boutique", address: "1 rue A", postalCode: "75001", city: "Paris", siret: "123 456 789 00012",
        tvaIntra: "FR00123456789", legalForm: "SAS", capital: "10000", serviceStartDate: "2026-11-01" },
      products: [{ id: "p" }], users: [{ role: "admin" }, { role: "cashier" }] })).toEqual([]);
  });
  it("SIRET invalide ou n° TVA absent : identité incomplète", () => {
    const base = { name: "B", address: "a", postalCode: "1", city: "v", legalForm: "SAS", capital: "1", serviceStartDate: "2026-11-01" };
    expect(manquants({ settings: { ...base, siret: "123", tvaIntra: "FR1" }, products: [1], users: [{ role: "manager" }] })).toEqual(["identite"]);
    expect(manquants({ settings: { ...base, siret: "12345678900012" }, products: [1], users: [{ role: "manager" }] })).toEqual(["identite"]);
  });
});
