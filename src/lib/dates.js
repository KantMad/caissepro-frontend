// ════════════════════════════════════════════════════════════
//  Journée commerciale — en heure LOCALE, jamais en UTC.
//
//  Piège corrigé le 20/10/2026 : partout où l'on écrivait
//  `new Date().toISOString().split("T")[0]`, la journée était découpée en UTC.
//  En heure d'été française (UTC+2), une vente de 00h30 tombait donc la veille :
//  le « CA du jour » du dashboard, les presets de Statistiques et l'aperçu de
//  clôture ne voyaient pas les ventes de fin de soirée que le Z, lui, comptait.
// ════════════════════════════════════════════════════════════

/** Clé de journée locale « AAAA-MM-JJ » (et non la date UTC). */
export const dayKey = (d = new Date()) => {
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
};

/** Vrai si l'horodatage appartient à la journée locale `key`. */
export const isSameDay = (ts, key = dayKey()) => !!ts && dayKey(new Date(ts)) === key;

/**
 * Bornes d'une période à envoyer au serveur, en INSTANTS précis (ISO avec fuseau).
 * `from` = minuit local du premier jour, `to` = 23:59:59.999 local du dernier.
 * Ainsi la journée est la même des deux côtés, quel que soit le fuseau du serveur.
 */
export const rangeToInstants = (from, to) => {
  const borne = (key, finDeJournee) => {
    if (!key) return null;
    const [y, m, d] = String(key).slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return null;
    return finDeJournee ? new Date(y, m - 1, d, 23, 59, 59, 999).toISOString()
                        : new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  };
  const params = {};
  const f = borne(from, false); if (f) params.from = f;
  const t = borne(to, true); if (t) params.to = t;
  return params;
};

/** Période précédente de même durée (pour les comparaisons). */
export const previousRange = (from, to) => {
  if (!from || !to) return { from: "", to: "" };
  const d1 = new Date(`${from}T12:00:00`), d2 = new Date(`${to}T12:00:00`);
  if (isNaN(d1) || isNaN(d2)) return { from: "", to: "" };
  const jours = Math.round((d2 - d1) / 86400000) + 1;
  const pTo = new Date(d1); pTo.setDate(pTo.getDate() - 1);
  const pFrom = new Date(pTo); pFrom.setDate(pFrom.getDate() - (jours - 1));
  return { from: dayKey(pFrom), to: dayKey(pTo) };
};
