// Chaque test part d'un stockage vide. Sous Node 22 (VPS, GitHub), le localStorage de jsdom
// garde d'un test a l'autre la file pendingSync -> un test lisait la vente hors-ligne du test
// precedent. Sous Node 25 (Mac) le localStorage natif de Node masquait ce defaut.
import { beforeEach } from "vitest";

beforeEach(() => {
  try { globalThis.localStorage?.clear(); } catch { /* environnement sans stockage */ }
  try { globalThis.sessionStorage?.clear(); } catch { /* idem */ }
});
