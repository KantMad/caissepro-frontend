// Cache IndexedDB de l'appareil (cacheLocal.js) sur une vraie implementation d'IndexedDB
import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import { lireCache, ecrireCache } from "./cacheLocal.js";

it("écrit puis relit le catalogue ; clé absente -> null", async () => {
  const catalogue = { storeId: "m1", products: Array.from({ length: 2000 }, (_, i) => ({ id: `p${i}`, name: `Article ${i}`, variants: [{ id: `v${i}`, ean: "3700000000000", stock: 3 }] })), promos: [] };
  expect(await ecrireCache("donnees-magasin", catalogue)).toBe(true);
  expect(await lireCache("donnees-magasin")).toEqual(catalogue);
  expect(await lireCache("absente")).toBeNull();
  await ecrireCache("donnees-magasin", { storeId: "m2", products: [], promos: [] });
  expect((await lireCache("donnees-magasin")).storeId).toBe("m2");   // remplace, ne cumule pas
});
