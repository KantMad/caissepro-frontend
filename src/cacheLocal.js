// ═══════════════════════════════════════
// Cache de l'appareil pour le mode hors-ligne (IndexedDB)
// ═══════════════════════════════════════
// Catalogue et promos du dernier magasin charge, pour pouvoir vendre apres un rechargement ou un
// redemarrage de la tablette pendant une coupure internet. IndexedDB et non localStorage : le
// catalogue peut peser plusieurs Mo et le quota localStorage (~5 Mo) est deja sollicite (file
// hors-ligne, tickets). Le serveur reste la source de verite : ce cache n'est relu que si le
// chargement depuis l'API echoue. Toute erreur est silencieuse (navigateur sans IndexedDB, mode
// prive, quota) : sans cache, la caisse se comporte comme avant.

const BASE = "techincash-cache";
const TABLE = "kv";

function ouvrir() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("IndexedDB indisponible")); return; }
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(TABLE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operation(mode, fn) {
  const db = await ouvrir();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(TABLE, mode);
      const req = fn(tx.objectStore(TABLE));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export async function lireCache(cle) {
  try { return (await operation("readonly", (t) => t.get(cle))) ?? null; } catch (e) { return null; }
}

export async function ecrireCache(cle, valeur) {
  try { await operation("readwrite", (t) => t.put(valeur, cle)); return true; } catch (e) { return false; }
}
