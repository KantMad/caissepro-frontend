import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  if (typeof globalThis.localStorage === "undefined") {
    const s = {};
    globalThis.localStorage = { getItem: (k) => (k in s ? s[k] : null), setItem: (k, v) => { s[k] = String(v); }, removeItem: (k) => { delete s[k]; } };
  }
});

import { sortSizes, sortVariantsBySize } from "./_shared.js";

describe("sortSizes", () => {
  it("ordonne XS < M < XL", () => {
    const sizes = ["XL", "XS", "M", "S"];
    expect([...sizes].sort(sortSizes)).toEqual(["XS", "S", "M", "XL"]);
  });
});

describe("sortVariantsBySize", () => {
  it("groupe par couleur (alpha) puis trie les tailles", () => {
    const variants = [
      { color: "Noir", size: "XL" }, { color: "Bleu", size: "M" },
      { color: "Noir", size: "S" }, { color: "Bleu", size: "XS" },
    ];
    const sorted = sortVariantsBySize(variants);
    expect(sorted.map((v) => `${v.color}/${v.size}`)).toEqual([
      "Bleu/XS", "Bleu/M", "Noir/S", "Noir/XL",
    ]);
  });
  it("ne modifie pas le tableau d'origine (copie)", () => {
    const variants = [{ color: "A", size: "M" }, { color: "A", size: "S" }];
    const before = [...variants];
    sortVariantsBySize(variants);
    expect(variants).toEqual(before);
  });
});
