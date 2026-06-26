import { describe, it, expect } from "vitest";
import { getLoyaltyTier } from "./loyalty.js";

describe("getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine)", () => {
  it("0 pt → Bronze", () => expect(getLoyaltyTier(0).name).toBe("Bronze"));
  it("99 pt → Bronze (sous le seuil Argent)", () => expect(getLoyaltyTier(99).name).toBe("Bronze"));
  it("100 pt → Argent (seuil exact)", () => expect(getLoyaltyTier(100).name).toBe("Argent"));
  it("250 pt → Or", () => expect(getLoyaltyTier(250).name).toBe("Or"));
  it("500 pt → Platine", () => expect(getLoyaltyTier(500).name).toBe("Platine"));
  it("9999 pt → Platine (palier max)", () => expect(getLoyaltyTier(9999).name).toBe("Platine"));
  it("points falsy/undefined → Bronze", () => {
    expect(getLoyaltyTier(undefined).name).toBe("Bronze");
    expect(getLoyaltyTier(null).name).toBe("Bronze");
  });
  it("respecte des paliers personnalisés", () => {
    const tiers = [{ minPoints: 0, name: "Base" }, { minPoints: 50, name: "VIP" }];
    expect(getLoyaltyTier(49, tiers).name).toBe("Base");
    expect(getLoyaltyTier(50, tiers).name).toBe("VIP");
  });
});
