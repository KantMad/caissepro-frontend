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
