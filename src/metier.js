// Metier de l'instance, fourni par l'API (GET /api/settings -> settings.metier, variable METIER du
// .env serveur). « textile » par defaut : rien ne change pour MCS ni pour une instance sans reglage.
// « epicerie » : contenance (250 g, 1 L) au lieu de couleur/taille, pas de retouches, categories et
// TVA 5,5 % proposees par defaut. Aucune difference fiscale : memes ventes, memes tables NF525.
import { SANS_COULEUR } from "./lib/formatters.js";

export const estEpicerie = (settings) => settings?.metier === "epicerie";

export const CATEGORIES_EPICERIE = ["Café", "Thé", "Infusions", "Huiles", "Vinaigres", "Épices",
  "Condiments", "Épicerie salée", "Épicerie sucrée", "Confiserie", "Chocolat", "Vins", "Spiritueux",
  "Coffrets", "Accessoires"];

export const ICONES_EPICERIE = { "Café": "☕", "Thé": "🍵", "Infusions": "🌿", "Huiles": "🫒",
  "Vinaigres": "🍶", "Épices": "🌶️", "Condiments": "🧂", "Épicerie salée": "🥫", "Épicerie sucrée": "🍯",
  "Confiserie": "🍬", "Chocolat": "🍫", "Vins": "🍷", "Spiritueux": "🥃", "Coffrets": "🎁",
  "Accessoires": "🫖" };

// Valeurs proposees a la creation d'un produit (le gerant peut toujours les changer).
export const produitParDefaut = (settings) => estEpicerie(settings)
  ? { taxRate: "0.055", category: "Café", collection: "" }
  : { taxRate: "0.20", category: "T-shirts", collection: "PE-2026" };

// Variante enregistree : en epicerie la couleur est remplacee par SANS_COULEUR (la base l'exige,
// elle n'est jamais affichee ni imprimee) et la contenance va dans « size ».
export const couleurVariante = (settings, saisie) => estEpicerie(settings) ? SANS_COULEUR : (saisie || "Défaut");
export const tailleVariante = (settings, saisie) => (saisie || "").trim() || (estEpicerie(settings) ? SANS_COULEUR : "TU");

export const libelleTaille = (settings) => estEpicerie(settings) ? "CONTENANCE" : "TAILLE";
