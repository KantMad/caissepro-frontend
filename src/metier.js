// Metier de l'instance, fourni par l'API (GET /api/settings -> settings.metier, variable METIER du
// .env serveur). « textile » par defaut : rien ne change pour MCS ni pour une instance sans reglage.
// « epicerie » : contenance (250 g, 1 L) au lieu de couleur/taille, pas de retouches, categories et
// TVA 5,5 % proposees par defaut. Aucune difference fiscale : memes ventes, memes tables NF525.
import { SANS_COULEUR } from "./lib/formatters.js";

export const estEpicerie = (settings) => settings?.metier === "epicerie";

// Rayons d'une maison de the / epicerie fine (calques sur le premier client, Happy Blue Tea).
// La couleur ou l'origine du the (vert, noir, Chine, Japon...) va dans le second champ
// (« Type / origine », colonne collection). Le gerant peut ajouter ses propres categories.
export const CATEGORIES_EPICERIE = ["Thés natures", "Thés parfumés", "Infusions", "Matcha", "Cafés",
  "Épicerie sucrée", "Chocolat", "Épicerie salée", "Huiles et vinaigres", "Coffrets",
  "Bougies et encens", "Accessoires"];

export const ICONES_EPICERIE = { "Thés natures": "🍵", "Thés parfumés": "🫖", "Infusions": "🌿",
  "Matcha": "🍃", "Cafés": "☕", "Épicerie sucrée": "🍯", "Chocolat": "🍫", "Épicerie salée": "🌶️",
  "Huiles et vinaigres": "🫒", "Coffrets": "🎁", "Bougies et encens": "🕯️", "Accessoires": "🥄" };

// Valeurs proposees a la creation d'un produit (le gerant peut toujours les changer).
export const produitParDefaut = (settings) => estEpicerie(settings)
  ? { taxRate: "0.055", category: "Thés natures", collection: "", poidsRefG: "" }
  : { taxRate: "0.20", category: "T-shirts", collection: "PE-2026" };

// Variante enregistree : en epicerie la couleur est remplacee par SANS_COULEUR (la base l'exige,
// elle n'est jamais affichee ni imprimee) et la contenance va dans « size ».
export const couleurVariante = (settings, saisie) => estEpicerie(settings) ? SANS_COULEUR : (saisie || "Défaut");
export const tailleVariante = (settings, saisie) => (saisie || "").trim() || (estEpicerie(settings) ? SANS_COULEUR : "TU");

export const libelleTaille = (settings) => estEpicerie(settings) ? "CONTENANCE" : "TAILLE";
export const libelleCollection = (settings) => estEpicerie(settings) ? "TYPE / ORIGINE" : "COLLECTION";

// ── Vente au poids (the en vrac) ── produit.poidsRefG = grammes de reference du prix (100 =
// « 8,00 € les 100 g »). La caisse vend UNE ligne en quantite 1 au prix calcule, le poids dans
// la contenance (« 85 g ») : pas de quantite decimale, tables fiscales inchangees (API migration 052).
export const venduAuPoids = (p) => Number(p?.poidsRefG) > 0;
export const prixPese = (p, grammes) =>
  Math.round((Number(p?.price) || 0) * (Number(grammes) || 0) / Number(p.poidsRefG) * 100) / 100;
export const libellePoids = (grammes) => `${grammes} g`;
export const libellePrixPoids = (p) => `${(Number(p?.price) || 0).toFixed(2)}€ / ${p.poidsRefG} g`;

// ── Stock du vrac (lot 2) : pour un produit au poids, variant.stock compte des GRAMMES ──
// Affichage : « 850 g », « 1,25 kg » ; a l'unite : le nombre tel quel.
export const affStock = (p, n) => {
  const v = Number(n) || 0;
  if (!venduAuPoids(p)) return String(v);
  return Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg` : `${v} g`;
};
// Ce qu'une ligne de panier retire du stock : ses grammes si elle est pesee, sinon sa quantite
export const sortieStock = (ligne) => Number(ligne?.variant?.poidsG) || Number(ligne?.quantity) || 0;
// Valorisation : le prix d'achat d'un produit au poids est celui de poidsRefG grammes
export const quantiteValorisee = (p, stock) => venduAuPoids(p) ? (Number(stock) || 0) / Number(p.poidsRefG) : (Number(stock) || 0);

// ── Lots et dates limites (DLC / DDM), migration API 053 ──
// DLC (« à consommer jusqu'au ») : interdit à la vente une fois passée.
// DDM (« à consommer de préférence avant ») : reste vendable après la date, à signaler.
export const SEUIL_ALERTE_J = { DLC: 7, DDM: 30 };
const jourLocal = (d = new Date()) => { const z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
export const joursRestants = (dateLimite, aujourdhui = jourLocal()) =>
  Math.round((Date.parse(dateLimite + "T00:00:00Z") - Date.parse(aujourdhui + "T00:00:00Z")) / 86400000);
// "depassee" (DLC passée : ne plus vendre), "ddm_passee" (vendable), "proche", "ok"
export function etatLot(lot, aujourdhui) {
  const j = joursRestants(lot.date_limite, aujourdhui);
  const type = lot.type_date === "DLC" ? "DLC" : "DDM";
  if (j < 0) return type === "DLC" ? "depassee" : "ddm_passee";
  return j <= SEUIL_ALERTE_J[type] ? "proche" : "ok";
}
export const libelleDate = (iso) => (iso ? iso.split("-").reverse().join("/") : "");
// Même règle que l'API (lib/lots.js) : les lots qui expirent le plus tôt partent les premiers,
// le stock présent reste sur les lots les plus tardifs. Recalculé avec le stock affiché en caisse.
const ordreFefo = (a, b) => String(a.date_limite).localeCompare(String(b.date_limite)) || String(a.created_at).localeCompare(String(b.created_at));
export function repartirLots(lots, stock) {
  let reste = Math.max(0, Number(stock) || 0);
  const restant = new Map();
  for (const l of [...lots].sort(ordreFefo).reverse()) {
    const r = Math.min(Math.max(0, (Number(l.quantite) || 0) - (Number(l.retire) || 0)), reste);
    reste -= r; restant.set(l.id, r);
  }
  return lots.map(l => ({ ...l, restant: restant.get(l.id) || 0 })).sort(ordreFefo);
}
// Lot à DLC dépassée encore en stock pour cette variante (celui qui part en premier), ou null
export function lotDlcDepassee(lots, variant, aujourdhui) {
  if (!variant?.id || !lots?.length) return null;
  const siens = lots.filter(l => l.variant_id === variant.id);
  if (!siens.length) return null;
  return repartirLots(siens, variant.stock).find(l => l.restant > 0 && etatLot(l, aujourdhui) === "depassee") || null;
}

// ── Coffrets composés, montés à l'avance (migration API 054) ──
// Combien de coffrets peut-on monter avec le stock actuel ? compo = [{variant_id, quantite}],
// stockDe(variantId) -> stock actuel (pièces ou grammes)
export function coffretsPossibles(compo, stockDe) {
  if (!compo?.length) return 0;
  return Math.max(0, Math.min(...compo.map(c => Math.floor((Number(stockDe(c.variant_id)) || 0) / Math.max(1, Number(c.quantite) || 1)))));
}
