import { LOYALTY_TIERS } from "../constants.jsx";

// Palier de fidélité atteint pour un nombre de points donné.
// Retourne le plus haut palier dont minPoints <= points.
export function getLoyaltyTier(points, tiers) {
  const list = (tiers && tiers.length) ? tiers : LOYALTY_TIERS;
  let tier = list[0];
  for (const t of list) {
    if ((Number(points) || 0) >= t.minPoints) tier = t;
  }
  return tier;
}
