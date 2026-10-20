import { describe, it, expect } from "vitest";
import { dayKey, isSameDay, rangeToInstants, previousRange } from "./dates.js";

describe("Journée commerciale en heure locale", () => {
  it("dayKey suit la date LOCALE, pas la date UTC", () => {
    // 00h30 heure de Paris = 22h30 UTC la veille : c'est bien le jour J pour la boutique
    const minuitTrente = new Date(2026, 6, 15, 0, 30, 0);
    expect(dayKey(minuitTrente)).toBe("2026-07-15");
    expect(minuitTrente.toISOString().split("T")[0]).toBe("2026-07-14"); // l'ancien calcul
  });

  it("isSameDay rattache une vente de fin de soirée au bon jour", () => {
    const vente = new Date(2026, 6, 15, 0, 30, 0).toISOString();
    expect(isSameDay(vente, "2026-07-15")).toBe(true);
    expect(isSameDay(vente, "2026-07-14")).toBe(false);
  });

  it("rangeToInstants borne la journée entière (minuit -> 23:59:59.999 locaux)", () => {
    const p = rangeToInstants("2026-07-15", "2026-07-15");
    expect(new Date(p.from).getTime()).toBe(new Date(2026, 6, 15, 0, 0, 0, 0).getTime());
    expect(new Date(p.to).getTime()).toBe(new Date(2026, 6, 15, 23, 59, 59, 999).getTime());
  });

  it("rangeToInstants ignore une borne vide", () => {
    expect(rangeToInstants("", "")).toEqual({});
    expect(Object.keys(rangeToInstants("2026-07-15", ""))).toEqual(["from"]);
  });

  it("previousRange : même durée, juste avant", () => {
    expect(previousRange("2026-07-08", "2026-07-14")).toEqual({ from: "2026-07-01", to: "2026-07-07" });
    expect(previousRange("2026-07-15", "2026-07-15")).toEqual({ from: "2026-07-14", to: "2026-07-14" });
  });

  it("previousRange : bornes manquantes -> vide", () => {
    expect(previousRange("", "2026-07-15")).toEqual({ from: "", to: "" });
  });
});
