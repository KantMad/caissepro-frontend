// Chaque test part d'un stockage vide. Sous Node 22 (VPS, GitHub), le localStorage de jsdom
// garde d'un test a l'autre la file pendingSync -> un test lisait la vente hors-ligne du test
// precedent. Sous Node 25 (Mac) le localStorage natif de Node masquait ce defaut.
import { beforeEach, afterAll } from "vitest";

beforeEach(() => {
  try { globalThis.localStorage?.clear(); } catch { /* environnement sans stockage */ }
  try { globalThis.sessionStorage?.clear(); } catch { /* idem */ }
});

// Laisse partir les derniers messages console avant la fermeture du fichier de test : sur le VPS
// (plus lent), un message emis a la fin du dernier test faisait echouer toute la suite
// (« Closing rpc while onUserConsoleLog was pending »), bien que tous les tests passent.
afterAll(() => new Promise(r => setTimeout(r, 50)));
