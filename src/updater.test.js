// Le canal de mise à jour de l'APK de MCS ne doit jamais être proposé à une autre instance.
import { describe, it, expect } from "vitest";
import { canalMiseAJour } from "./updater.js";

describe("canalMiseAJour", () => {
  it("caisse MCS : canal MCS", () => {
    expect(canalMiseAJour("caisse.techincash.app", {})).toBe("KantMad/caissepro-frontend");
  });
  it("instance client, démo, local : aucun canal", () => {
    for (const h of ["caisse.lumiere.fr", "demo.techincash.app", "localhost", ""]) expect(canalMiseAJour(h, {})).toBeNull();
  });
  it("canal propre configuré au build", () => {
    expect(canalMiseAJour("caisse.lumiere.fr", { VITE_APK_UPDATE_REPO: "Org/caisse-lumiere" })).toBe("Org/caisse-lumiere");
  });
});
