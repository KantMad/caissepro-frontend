# Tests unitaires — état du front

> **Document généré automatiquement** par `npm run test:doc` (ne pas éditer à la main).
> Dernière exécution : 2026-06-26 08:59 UTC

## Résultat global

- ✅ **76/76 tests passés** — 7 fichier(s)

## Comment lancer

```bash
npm run test        # une passe
npm run test:watch  # mode surveillance
npm run test:doc    # régénère ce document depuis les résultats réels
```

## Périmètre

- **Tests unitaires** des fonctions **pures / logiques** : calculs fiscaux NF525
  (`lib/totals`), promotions (`lib/promos`), fidélité (`lib/loyalty`), EAN-13,
  normalizers, hash PIN, tri des tailles (`utils`, `_shared`).
- **Tests d'intégration** du `AppProvider` (jsdom) : flux **panier** (ajout, remises,
  quantités) et **paiement** (checkout online → payload, offline → ticket recalculé).

Restent hors périmètre : le rendu visuel des écrans et les wrappers réseau `api.js`
(testés indirectement via les mocks d'intégration).

## Détail par fichier

### `src/cart-flow.test.jsx` — 8/8 ✅

- ✅ Flux panier (intégration provider) › panier vide au départ → totaux à zéro
- ✅ Flux panier (intégration provider) › ajoute 2× un article à 209 → TTC = 418.00 (HT+TVA cohérents)
- ✅ Flux panier (intégration provider) › deux produits distincts → deux lignes, total additionné
- ✅ Flux panier (intégration provider) › remise de ligne -50% → total divisé par 2
- ✅ Flux panier (intégration provider) › remise globale 10% sur 2×209 → 376.20
- ✅ Flux panier (intégration provider) › updateQty met à jour la quantité et le total
- ✅ Flux panier (intégration provider) › article personnalisé (addCustomItem) apparaît dans le panier
- ✅ Flux panier (intégration provider) › clearCart remet tout à zéro

### `src/checkout-flow.test.jsx` — 3/3 ✅

- ✅ Paiement — mode online (API OK) › envoie le bon payload et vide le panier
- ✅ Paiement — mode offline (API échoue → fallback local) › recalcule le ticket localement (TTC ancré) et le conserve
- ✅ Paiement — mode offline (API échoue → fallback local) › multi-taux offline reste cohérent (HT+TVA=TTC)

### `src/lib/loyalty.test.js` — 8/8 ✅

- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › 0 pt → Bronze
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › 99 pt → Bronze (sous le seuil Argent)
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › 100 pt → Argent (seuil exact)
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › 250 pt → Or
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › 500 pt → Platine
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › 9999 pt → Platine (palier max)
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › points falsy/undefined → Bronze
- ✅ getLoyaltyTier (paliers par défaut Bronze/Argent/Or/Platine) › respecte des paliers personnalisés

### `src/lib/promos.test.js` — 14/14 ✅

- ✅ calcPromoDiscount › aucune promo → 0
- ✅ calcPromoDiscount › panier vide → 0
- ✅ calcPromoDiscount › remise catégorie en % (10% du HT)
- ✅ calcPromoDiscount › remise catégorie en montant €
- ✅ calcPromoDiscount › remise SKU ciblée
- ✅ calcPromoDiscount › remise couleur
- ✅ calcPromoDiscount › remise collection
- ✅ calcPromoDiscount › destockage stock faible : stock <= seuil et > 0 (rupture exclue)
- ✅ calcPromoDiscount › min_qty : remise seulement si la quantité matching atteint le seuil
- ✅ calcPromoDiscount › qty_discount : remise sur tout le panier au-dessus du seuil
- ✅ calcPromoDiscount › code promo : seulement si le code saisi correspond (insensible à la casse)
- ✅ calcPromoDiscount › la remise totale est plafonnée au total HT
- ✅ calcPromoDiscount › mode HT : remise calculée sur le prix HT direct
- ✅ calcPromoDiscount › supporte les clés snake_case (promo_type/target_type/min_qty)

### `src/lib/totals.test.js` — 16/16 ✅

- ✅ round2 › arrondit au centime
- ✅ round2 › gère 0 / undefined / null
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › panier vide → zéros
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › 2×209 TTC = 418.00 (le bug d'origine, plus de 417.99)
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › 1 article quantité 2 = 418.00 (même résultat que 2 lignes)
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › 3×9.99 TTC = 29.97
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › multi-taux (209@20% + 10@5.5%) = 219.00
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › remise globale 10% sur 2×209 = 376.20
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › remise globale montant fixe (50€) sur 2×209
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › mode HT : prix saisis HT → TVA ajoutée (100 HT @20% = 120 TTC)
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › remise ligne en % (-50% sur 100 TTC = 50)
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › remise ligne en montant (-2€/u sur 10 TTC ×3 = 24)
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › avoir déduit du TTC final (418 - 18 = 400)
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › avoir ne rend jamais le TTC négatif
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › invariant HT+TVA=TTC sur de nombreux prix/quantités
- ✅ computeTotals — invariant NF525 : HT + TVA = TTC (au centime) › invariant tenu aussi avec remise globale variable

### `src/screens/_shared.test.js` — 3/3 ✅

- ✅ sortSizes › ordonne XS < M < XL
- ✅ sortVariantsBySize › groupe par couleur (alpha) puis trie les tailles
- ✅ sortVariantsBySize › ne modifie pas le tableau d'origine (copie)

### `src/utils.test.js` — 24/24 ✅

- ✅ escapeHtml › échappe les caractères dangereux
- ✅ escapeHtml › renvoie '' pour falsy
- ✅ getPriceHT / getPriceTTC › mode TTC : HT = prix / (1+taux)
- ✅ getPriceHT / getPriceTTC › mode HT : prix inchangé en HT, TTC = prix × (1+taux)
- ✅ getPriceHT / getPriceTTC › taux par défaut 20%
- ✅ catIcon › renvoie l'icône par défaut connue
- ✅ catIcon › fallback 📦 si inconnue
- ✅ catIcon › surcharge par les réglages
- ✅ variantKey › clé normalisée couleur|taille en minuscule
- ✅ variantKey › valeurs par défaut si manquantes
- ✅ getSizeRank › ordonne les tailles standard
- ✅ generateEAN13 › produit un EAN-13 valide (clé de contrôle correcte)
- ✅ generateEAN13 › commence par le préfixe et fait 13 chiffres
- ✅ norm.customer › mappe snake_case → camelCase + parse nombres
- ✅ norm.avoir › mappe barcode + items (sku/ean/colorCode)
- ✅ norm.product › parse price/cost/tax et conserve les variantes
- ✅ ean13SvgHtml › renvoie '' pour un code invalide
- ✅ ean13SvgHtml › génère un SVG contenant des barres et le code pour un EAN-13 valide
- ✅ autoImportSizesFromProducts › attribue le rang numérique à une taille chiffrée
- ✅ autoImportSizesFromProducts › ne plante pas sur une liste vide / nulle
- ✅ sha256 › hash hex déterministe de 64 caractères
- ✅ loadVariantOrderFromSettings / getVariantOrderMap › charge l'ordre des variantes depuis les settings
- ✅ hashPin / verifyPin › hash déterministe et vérifiable
- ✅ hashPin / verifyPin › rejette un hash vide ou ****
