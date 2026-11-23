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
afterAll(() => new Promise(r => setTimeout(r, 300)));

// 23/11/2026 : les 50 ms ne suffisaient plus sur le VPS (deploiement 7.0.36 refuse, 387/387 tests
// verts). La source : le controle « serveur joignable » de context.jsx tourne en tache de fond
// et ecrit « [Online] … » meme apres le dernier test. Ces messages de routine sont ecartes ici,
// dans le processus du test : ils ne partent plus vers vitest, donc plus rien d'« en attente ».
const logOrigine = console.log.bind(console);
console.log = (...a) => {
  if (typeof a[0] === "string" && a[0].startsWith("[Online]")) return;
  logOrigine(...a);
};
