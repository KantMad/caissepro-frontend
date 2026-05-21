import React, { useState } from "react";
import { Archive, HelpCircle, ChevronDown } from "lucide-react";
import { C } from "../constants.jsx";

function HelpCashierScreen(){
  const[openIdx,setOpenIdx]=useState(null);
  const sections=[
    {icon:"🛒",title:"Encaisser une vente",desc:"Ajouter des articles au panier et finaliser un paiement.",steps:[
      "Vous êtes sur l'écran « Vente » (1er bouton de la barre latérale gauche, icône caddie).",
      "L'écran est divisé en 2 colonnes : la grille des produits à droite, et le panier à gauche.",
      "Pour ajouter un article : tapez le nom, la référence SKU ou le code-barres dans la barre de recherche en haut de la grille produits.",
      "Cliquez sur la carte du produit dans la grille. Si le produit a des variantes (taille/couleur), une popup s'ouvre : cliquez sur la variante souhaitée. Le stock disponible est affiché pour chaque variante.",
      "L'article apparaît dans le panier (colonne de gauche). Pour modifier la quantité, cliquez sur les boutons « + » et « − » à côté de l'article.",
      "Pour supprimer un article du panier, cliquez sur l'icône corbeille rouge à droite de la ligne de l'article.",
      "En bas du panier se trouve le récapitulatif : sous-total HT, remises, TVA et total TTC.",
      "Pour payer, cliquez sur un des boutons de paiement :",
      "  • « Carte » (bleu) → Paiement carte bancaire. Le paiement est enregistré immédiatement.",
      "  • « Espèces » (vert) → Un pavé numérique s'ouvre. Saisissez le montant remis par le client. Le rendu de monnaie se calcule automatiquement. Des boutons rapides proposent le montant exact, 5€, 10€, 50€, 100€.",
      "  • « Cadeau » (doré) → Paiement par carte cadeau.",
      "  • « Chèque » (gris) → Paiement par chèque.",
      "  • « Fractionné » (violet) → Répartir entre plusieurs moyens de paiement (voir section dédiée).",
      "Après validation, le ticket s'affiche avec l'empreinte NF525. Cliquez « Imprimer » pour l'impression thermique, « Email » pour l'envoyer au client, ou « Terminé » pour revenir à l'écran de vente."
    ]},
    {icon:"🔍",title:"Filtrer les produits et favoris",desc:"Trouver rapidement un produit par catégorie ou favoris.",steps:[
      "Sur l'écran « Vente », sous la barre de recherche, vous voyez les onglets de catégories : « Tous », puis chaque catégorie de vos produits.",
      "Cliquez sur une catégorie pour afficher uniquement les produits de cette catégorie.",
      "Cliquez sur « Favoris » (icône étoile, tout à droite) pour afficher uniquement vos produits favoris.",
      "Pour ajouter un produit en favori : cliquez sur l'icône étoile (☆) en bas à droite de la carte du produit dans la grille. L'étoile se remplit (★).",
      "Pour retirer un favori : recliquez sur l'étoile pleine.",
      "Les favoris sont pratiques pour accéder rapidement aux produits les plus vendus sans chercher."
    ]},
    {icon:"📝",title:"Article divers / Services",desc:"Ajouter un article libre ou un service rapide au panier.",steps:[
      "Sur l'écran « Vente », cliquez sur l'icône crayon (✏️) en haut à droite, à côté du bouton pause.",
      "Une popup « Article divers / Services » s'ouvre.",
      "SERVICES RAPIDES : 4 boutons prédéfinis sont proposés — « Retouche bas de manches » (10€), « Retouche bas d'ourlet » (15€), « Retouche ajustement » (20€), « Emballage cadeau » (5€). Cliquez sur un bouton pour l'ajouter directement au panier.",
      "ARTICLE PERSONNALISÉ : en bas de la popup, saisissez une description (ex : « Retouche ceinture ») et un prix TTC, puis cliquez « Ajouter au panier ».",
      "L'article apparaît dans le panier avec la mention « (divers) » et l'icône 📝."
    ]},
    {icon:"💸",title:"Appliquer une remise",desc:"Remise sur un article ou sur tout le panier.",steps:[
      "REMISE sur UN article : dans le panier (colonne gauche), cliquez sur le bouton « Remise » à droite de l'article (il affiche « Remise » si aucune remise, ou « -10% » si une remise est déjà appliquée).",
      "Une popup s'ouvre. Choisissez le type : « % » (pourcentage) ou « € » (montant fixe en euros).",
      "Saisissez la valeur (ex : 10 pour 10% ou 5 pour 5€). Des boutons rapides sont proposés : 5%, 10%, 15%, 20% (ou 2€, 5€, 10€, 20€ en mode montant).",
      "Cliquez « Appliquer ». Le prix barré et le nouveau prix apparaissent sur la ligne de l'article.",
      "REMISE GLOBALE sur tout le panier : cliquez sur « Remise globale » (icône %) sous la liste des articles dans le panier, juste au-dessus des boutons de paiement.",
      "Choisissez % ou €, saisissez la valeur, puis « Appliquer ». Pour supprimer la remise globale, cliquez « Supprimer » dans la popup.",
      "⚠️ La remise maximale autorisée dépend de votre rôle. Si vous dépassez la limite, un message rouge apparaît et le bouton « Appliquer » est désactivé."
    ]},
    {icon:"🏷️",title:"Code promo et promotions",desc:"Saisir un code promo ou voir les promos actives.",steps:[
      "Sur l'écran « Vente », en haut du panier (colonne gauche), sous le bouton client, vous voyez le champ « Code promo… ».",
      "Saisissez le code promo donné par le client (ex : SOLDES20) et cliquez « OK ».",
      "Si le code est valide et actif, la remise s'applique automatiquement au panier. Le détail apparaît en vert dans le récapitulatif (ex : « ✓ Promo SOLDES20 »).",
      "Les promotions actives sont aussi affichées dans un bandeau jaune au-dessus de la grille produits (ex : « Promos actives: Soldes été »).",
      "Les promos de type « collection » ou « quantité » s'appliquent automatiquement sans code — elles sont calculées quand les conditions sont remplies.",
      "Pour voir toutes les promos disponibles : cliquez sur « Promos » dans la barre latérale gauche (9ème bouton, icône éclair)."
    ]},
    {icon:"💳",title:"Paiement fractionné (multi-moyens)",desc:"Payer une partie en CB, une partie en espèces, etc.",steps:[
      "Depuis l'écran « Vente », avec des articles dans le panier, cliquez sur le bouton violet « Fractionné » en bas du panier.",
      "La popup de paiement fractionné s'ouvre. Le montant total est affiché en haut.",
      "5 champs de paiement sont disponibles :",
      "  • CB/AMEX : deux boutons « CB » et « AMEX » permettent de choisir le type de carte. Saisissez le montant.",
      "  • Espèces : saisissez le montant payé en liquide.",
      "  • Carte cadeau : saisissez le montant à débiter de la carte cadeau.",
      "  • Chèque : saisissez le montant du chèque.",
      "  • Avoir client : saisissez le montant d'un avoir à utiliser.",
      "Le bouton « = Reste » à côté de chaque champ remplit automatiquement le montant restant à payer. Pratique pour le dernier moyen.",
      "Le bandeau « Reste à payer » en bas se met à jour en temps réel. Quand il affiche 0,00€ (fond vert), le bouton « Valider » devient actif.",
      "Cliquez « Valider » pour finaliser. Le ticket affichera le détail de chaque moyen utilisé (ex : « CB 30,00€ + ESP 15,50€ »)."
    ]},
    {icon:"👤",title:"Choisir un vendeur",desc:"Attribuer la vente à un autre vendeur.",steps:[
      "Sur l'écran « Vente », en bas du panier, juste au-dessus du bouton « Vider le panier », vous voyez un menu déroulant « Vendeur: [votre nom] (moi) ».",
      "Cliquez sur ce menu pour sélectionner un autre vendeur parmi la liste des utilisateurs actifs.",
      "La vente sera attribuée au vendeur sélectionné dans les statistiques et le ticket de caisse.",
      "À côté du menu vendeur, un champ « Note… » permet d'ajouter une note libre à la vente (ex : « Cadeau anniversaire »). Cette note apparaîtra sur le ticket."
    ]},
    {icon:"❌",title:"Annuler une vente / Vider le panier",desc:"Annuler le panier en cours avec un motif NF525.",steps:[
      "Pour vider le panier simplement : cliquez sur le bouton rouge « Vider le panier » tout en bas du panier, ou appuyez sur F8.",
      "Si le panier contient des articles, une popup de confirmation apparaît.",
      "Sélectionnez un motif d'annulation dans le menu déroulant (obligatoire NF525) : « Erreur de saisie », « Client annule l'achat », « Produit indisponible », « Erreur de prix », « Autre ».",
      "Cliquez « Confirmer l'annulation ». L'annulation est enregistrée dans le journal d'audit.",
      "Pour annuler une vente DÉJÀ validée : allez dans « Tickets » (6ème bouton), retrouvez le ticket, et cliquez « Annuler » dans le détail.",
      "⚠️ L'annulation de ventes est tracée de manière inaltérable (NF525). Un motif est toujours obligatoire."
    ]},
    {icon:"↩️",title:"Faire un retour / échange",desc:"Retourner un article et rembourser ou faire un avoir.",steps:[
      "Cliquez sur « Retours » dans la barre latérale gauche (2ème bouton, icône flèche).",
      "Recherchez le ticket d'origine : tapez le numéro de ticket, le nom du client ou la date dans la barre de recherche en haut.",
      "Cliquez sur le ticket trouvé pour l'ouvrir. La liste des articles du ticket s'affiche.",
      "Cochez les articles à retourner en cliquant sur la case à gauche de chaque article. Ajustez la quantité retournée si nécessaire.",
      "Sélectionnez le motif du retour dans le menu déroulant (taille incorrecte, défaut, changement d'avis, etc.).",
      "Choisissez le mode de remboursement en bas de l'écran :",
      "  • « Avoir » → Génère un bon d'avoir avec un code unique que le client pourra utiliser lors d'un prochain achat.",
      "  • « Espèces » → Remboursement en liquide directement.",
      "  • « Carte » → Remboursement sur la carte bancaire du client.",
      "  • « Échange » → Le montant retourné est crédité pour un nouvel achat immédiat.",
      "Cliquez sur « Valider le retour » pour confirmer. Un ticket de retour est généré et signé (NF525).",
      "⚠️ Le délai maximum de retour et les modes autorisés sont configurables dans Réglages → onglet « Retours »."
    ]},
    {icon:"📷",title:"Scanner un code-barres",desc:"Ajouter des articles en scannant leur code-barres.",steps:[
      "Branchez votre scanner USB ou connectez-le en Bluetooth via les paramètres de votre appareil.",
      "Depuis l'écran « Vente », la barre de recherche est déjà active. Il suffit de scanner — pas besoin de cliquer.",
      "Le scanner « tape » automatiquement le code EAN. Si un produit correspond, il est ajouté au panier.",
      "Si le produit a des variantes, la popup de sélection de variante apparaît : choisissez la taille/couleur.",
      "Si aucun produit ne correspond, un message orange « Aucun produit pour EAN: [code] » s'affiche.",
      "Pour résoudre : vérifiez dans Dashboard → Produits → fiche du produit → champ EAN de chaque variante que le code est bien renseigné.",
      "Compatible EAN-13, EAN-8 et codes internes. Le scanner doit envoyer un « Entrée » (Enter) après le code."
    ]},
    {icon:"❤️",title:"Associer un client (fidélité)",desc:"Lier un client à la vente pour cumuler ses points.",steps:[
      "Sur l'écran « Vente », en haut du panier, cliquez sur le bouton « Associer un client » (bordure pointillée avec icône personnes).",
      "La popup client s'ouvre avec la liste de tous les clients.",
      "Cliquez sur un client pour l'associer. Son nom, ses points et son tier (Bronze/Silver/Gold) apparaissent en haut du panier.",
      "Pour chercher un client : la liste est filtrable, scrollez pour trouver le bon.",
      "Pour créer un nouveau client : cliquez « + Nouveau client » dans la popup. Remplissez Prénom, Nom, Email, Téléphone puis « Créer et associer ».",
      "Pour retirer le client : rouvrez la popup et cliquez « Aucun client ».",
      "Les points de fidélité (+1 point par euro dépensé) sont ajoutés automatiquement après validation de la vente.",
      "Si le client a un historique, le « Prix précédent » est affiché en gris sous chaque article dans le panier."
    ]},
    {icon:"⏸️",title:"Mettre un panier en attente",desc:"Sauvegarder le panier pour le reprendre plus tard.",steps:[
      "Depuis l'écran « Vente », avec des articles dans le panier, cliquez sur l'icône pause (⏸) en haut du panier à côté du titre, ou appuyez sur F5.",
      "Le panier est sauvegardé avec la date, l'heure et le client associé. L'écran se vide pour un nouveau client.",
      "Un badge rouge apparaît sur l'icône pause en haut pour indiquer le nombre de paniers en attente.",
      "Pour reprendre : cliquez sur l'icône pause (le badge indique combien de paniers sont en attente).",
      "La popup liste tous les paniers : date, nombre d'articles, nom du client. Cliquez « Reprendre » pour restaurer un panier.",
      "Plusieurs paniers peuvent être en attente en même temps."
    ]},
    {icon:"🖨️",title:"Imprimer un ticket / étiquette",desc:"Impression thermique et étiquettes code-barres.",steps:[
      "TICKET après une vente : le ticket s'affiche automatiquement. 3 boutons en bas :",
      "  • « Email » → Ouvre votre messagerie avec un email pré-rempli contenant les infos du ticket. L'adresse du client est pré-remplie s'il est associé.",
      "  • « Ticket » (ou « Imprimer ») → Envoie le ticket à l'imprimante thermique connectée (ESC/POS). Si non connectée, ouvre le dialogue d'impression du navigateur.",
      "  • « Terminé » → Ferme le ticket et revient à l'écran de vente.",
      "CONFIGURER l'imprimante : « Réglages » (barre latérale) → onglet « 🖨️ Imprimante » → « Connecter l'imprimante ». Choisissez largeur 32 col. (58mm) ou 48 col. (80mm). Testez avec « Test impression ».",
      "ÉTIQUETTES code-barres : « Produits » (barre latérale) → cliquez sur un produit → bouton « Étiquettes ». Choisissez le format (50×30mm, 40×25mm, etc.) et les variantes à imprimer, puis cliquez « Imprimer les étiquettes ».",
      "PERSONNALISER le ticket : « Réglages » → onglet « 🧾 Ticket » → ajouter un logo (URL), modifier l'en-tête/pied de page, activer/désactiver l'affichage TVA détaillée, vendeur, etc.",
      "L'indicateur d'imprimante est visible en haut à droite de l'écran de vente : « ESC/POS » en vert si connectée, « — » sinon."
    ]},
    {icon:"✈️",title:"Vente en détaxe",desc:"Appliquer la détaxe pour un client hors UE.",steps:[
      "Depuis l'écran « Vente », avec des articles dans le panier (minimum 100,01€ TTC requis).",
      "Cliquez sur le bouton « Détaxe » juste au-dessus des boutons de paiement, à côté de « Remise globale ».",
      "Le bouton devient vert « ✓ Détaxe ». Un encadré vert apparaît : « Vente en détaxe — TVA à 0% — Réservé aux résidents hors UE ».",
      "La TVA passe à 0% sur tous les articles. Le total TTC = total HT.",
      "Finalisez le paiement normalement. Le ticket mentionne « VENTE EN DÉTAXE — TVA 0% — ART. 262 CGI ».",
      "Pour annuler la détaxe avant paiement : recliquez sur le bouton Détaxe pour le désactiver.",
      "⚠️ Vérifiez l'identité (passeport) et le bordereau PABLO. Réservé aux résidents hors Union Européenne."
    ]},
    {icon:"🔐",title:"Ouvrir et fermer la caisse",desc:"Fond de caisse à l'ouverture, clôture Z en fin de journée.",steps:[
      "OUVERTURE : au démarrage, l'écran d'ouverture de caisse apparaît automatiquement.",
      "Mode rapide : saisissez le montant total du fond de caisse dans le champ unique, puis cliquez « Ouvrir la caisse ».",
      "Mode détaillé : cliquez sur « Comptage par coupures » pour saisir le nombre de chaque billet (500€, 200€, 100€, 50€, 20€, 10€, 5€) et pièce (2€, 1€, 50c, 20c, 10c, 5c, 2c, 1c). Le total se calcule automatiquement.",
      "Pour ne pas ouvrir de caisse : cliquez « Passer » en haut de l'écran.",
      "CLÔTURE Z : cliquez sur « Clôture » dans la barre latérale gauche (10ème bouton, icône cadenas).",
      "L'écran affiche le récapitulatif de la journée : nombre de ventes, CA par moyen de paiement, total espèces théorique.",
      "Saisissez le montant réel compté en caisse. L'écart (positif ou négatif) s'affiche automatiquement.",
      "Cliquez « Valider la clôture Z » pour archiver. Le rapport est signé numériquement (NF525).",
      "⚠️ La clôture Z est obligatoire. Elle est inaltérable et constitue une pièce comptable officielle."
    ]},
    {icon:"📊",title:"Consulter les statistiques",desc:"Voir le CA, le panier moyen, les graphiques et les performances.",steps:[
      "Cliquez sur « Stats » dans la barre latérale gauche (3ème bouton, icône graphique).",
      "En haut : 5 indicateurs — CA TTC, Nombre de tickets, Panier moyen, Marge (€), Marge (%). Si une période est sélectionnée, un badge vert/rouge indique l'évolution vs la période précédente.",
      "FILTRES : sous les indicateurs, sélectionnez une période rapide (Aujourd'hui, Semaine, Ce mois, Mois dernier, Année, Tout) ou des dates précises avec les champs « du / au ». Filtrez aussi par catégorie.",
      "13 onglets sont disponibles pour détailler les statistiques :",
      "  • « Évolution CA » → Graphique en barres du CA jour par jour.",
      "  • « Comparaison » → Compare la période sélectionnée avec la période précédente.",
      "  • « CA par heure » → Graphique montrant les heures de pointe (utile pour le planning).",
      "  • « CA par jour » → CA par jour de la semaine (lundi, mardi…).",
      "  • « Best-sellers » → Classement des produits les plus vendus avec quantité et CA.",
      "  • « Détail variantes » → Ventes détaillées par produit et variante (taille/couleur).",
      "  • « Par vendeur » → CA par vendeur, commissions, et progression vs objectif.",
      "  • « Tailles/Couleurs » → Graphiques des tailles et couleurs les plus vendues.",
      "  • « Collections » → CA par collection, avec marge et quantité.",
      "  • « Clients » → Top clients par CA et fréquence d'achat.",
      "  • « Retours » → Statistiques des retours (taux, motifs, montants).",
      "  • « Paiements » → Répartition du CA par moyen de paiement (camembert).",
      "  • « Remises » → Total des remises accordées et détail.",
      "Bouton « Export CSV » en haut à droite pour télécharger les données au format tableur."
    ]},
    {icon:"📦",title:"Consulter le stock",desc:"Voir les niveaux de stock et les alertes.",steps:[
      "Cliquez sur « Stock » dans la barre latérale gauche (4ème bouton, icône grille).",
      "Un badge rouge sur l'icône Stock indique le nombre d'alertes de stock (rupture ou stock bas).",
      "L'écran affiche tous les produits avec le stock par variante (taille/couleur).",
      "Les variantes en rupture (stock = 0) sont en rouge. Les stocks bas sont en orange.",
      "Utilisez la barre de recherche pour trouver un produit spécifique.",
      "Pour ajuster un stock : cliquez sur le produit, modifiez la quantité de la variante et enregistrez.",
      "Les alertes de stock apparaissent aussi dans le bandeau vert « Aujourd'hui » en haut de l'écran de vente."
    ]},
    {icon:"📦",title:"Gérer les produits (mode caisse)",desc:"Voir, modifier et ajouter des produits depuis la caisse.",steps:[
      "Cliquez sur « Produits » dans la barre latérale gauche (5ème bouton, icône colis).",
      "La liste de tous les produits s'affiche avec nom, SKU, catégorie, prix, nombre de variantes et stock total.",
      "Cliquez sur un produit pour ouvrir sa fiche complète.",
      "Vous pouvez modifier le nom, le prix, la catégorie, la TVA, le coût d'achat, et les variantes.",
      "Pour chaque variante : modifiez la taille, la couleur, le code EAN et le stock.",
      "Cliquez « Enregistrer » pour sauvegarder. « Étiquettes » pour imprimer des étiquettes code-barres. « Supprimer » pour supprimer le produit.",
      "Bouton « + Nouveau produit » en haut pour créer un nouveau produit directement depuis la caisse.",
      "Bouton « Dupliquer » pour copier un produit existant."
    ]},
    {icon:"📜",title:"Historique des tickets",desc:"Retrouver, consulter et réimprimer un ancien ticket.",steps:[
      "Cliquez sur « Tickets » dans la barre latérale gauche (6ème bouton, icône ticket).",
      "La liste de tous les tickets s'affiche, du plus récent au plus ancien, avec la date, le numéro, le montant, le mode de paiement et le vendeur.",
      "Utilisez la barre de recherche en haut pour filtrer par numéro de ticket, nom de client ou date.",
      "Cliquez sur un ticket pour voir le détail complet : articles (avec taille/couleur/EAN), montants, TVA, mode de paiement, empreinte NF525.",
      "Depuis le détail du ticket :",
      "  • « Imprimer » → Réimprime le ticket sur l'imprimante thermique.",
      "  • « Email » → Envoie le ticket par email au client.",
      "  • « Annuler » → Annule la vente (nécessite un motif NF525). L'annulation est irréversible et tracée.",
      "Les tickets annulés sont barrés et marqués en rouge dans la liste."
    ]},
    {icon:"👥",title:"Gérer les clients",desc:"Ajouter, modifier ou consulter les fiches clients.",steps:[
      "Cliquez sur « Clients » dans la barre latérale gauche (7ème bouton, icône personnes).",
      "La liste de tous les clients s'affiche avec nom, email, téléphone, points de fidélité et tier (Bronze/Silver/Gold).",
      "Barre de recherche en haut pour filtrer par nom, email ou téléphone.",
      "« + Nouveau client » en haut à droite : remplissez Prénom, Nom, Email, Téléphone, Ville, Notes, puis « Créer ».",
      "Bouton « Modifier » (icône crayon) : ouvre la fiche pour modifier les informations.",
      "Bouton « Historique » : affiche toutes les ventes passées de ce client avec les dates et montants.",
      "Bouton « RGPD » : exporte ou supprime les données personnelles du client (conformité RGPD).",
      "Les points de fidélité sont attribués automatiquement (+1 point par euro dépensé). Les tiers sont : Bronze (0-199), Silver (200-499), Gold (500+)."
    ]},
    {icon:"🎁",title:"Cartes cadeaux",desc:"Créer, vendre et utiliser des cartes cadeaux.",steps:[
      "Cliquez sur « Cadeaux » dans la barre latérale gauche (8ème bouton, icône cadeau).",
      "La liste de toutes les cartes s'affiche : code, montant initial, solde restant, date de création, statut (active/épuisée).",
      "CRÉER : cliquez « + Nouvelle carte cadeau », saisissez le montant (ex : 50€), cliquez « Créer ». Un code unique est généré automatiquement.",
      "UTILISER lors d'un paiement : choisissez « Fractionné » dans les boutons de paiement, puis saisissez le montant dans le champ « Carte cadeau ».",
      "Le solde de la carte diminue du montant utilisé. Si le solde ne suffit pas, complétez avec un autre moyen de paiement."
    ]},
    {icon:"🏷️",title:"Consulter les promotions",desc:"Voir les promotions actives et les appliquer.",steps:[
      "Cliquez sur « Promos » dans la barre latérale gauche (9ème bouton, icône éclair).",
      "Les promotions actives sont affichées avec un badge vert. Les inactives en gris.",
      "3 types de promos : « Collection » (s'applique à une catégorie entière), « Quantité » (ex : 3 pour le prix de 2), « Code promo » (le client donne un code).",
      "Les promos « Collection » et « Quantité » s'appliquent automatiquement lors de l'encaissement.",
      "Les promos « Code promo » nécessitent de saisir le code dans le champ « Code promo… » en haut du panier.",
      "Pour créer ou modifier des promotions, il faut passer en mode Dashboard → Promotions."
    ]},
    {icon:"🚶",title:"Compteur d'entrées (footfall)",desc:"Compter les visiteurs pour calculer le taux de conversion.",steps:[
      "Cliquez sur « Entrées » dans la barre latérale gauche (11ème bouton, icône activité).",
      "Le compteur du jour est affiché en gros. Cliquez sur le bouton « + Entrée » à chaque visiteur entrant dans le magasin.",
      "Le taux de conversion est calculé automatiquement : (nombre de tickets du jour ÷ nombre d'entrées) × 100.",
      "Un tableau en dessous affiche l'historique jour par jour : date, entrées, tickets, taux de conversion.",
      "Un bon taux de conversion en textile est entre 15% et 30%."
    ]},
    {icon:"📋",title:"Journal d'audit",desc:"Traçabilité complète de toutes les actions.",steps:[
      "Cliquez sur « Audit » dans la barre latérale gauche (12ème bouton, icône activité).",
      "2 onglets en haut : « Audit » (actions métier) et « JET (NF525) » (événements techniques).",
      "L'onglet Audit affiche : ventes, annulations, modifications de produits, modifications de prix, réceptions de stock, connexions, etc.",
      "L'onglet JET affiche : connexions, déconnexions, changements de paramètres, erreurs système.",
      "Filtrez par utilisateur avec le menu déroulant en haut à droite.",
      "Bouton « Export » pour télécharger le journal en CSV.",
      "Navigation par pages en bas si le journal est long.",
      "⚠️ Ce journal est inaltérable (NF525). Il constitue une preuve en cas de contrôle fiscal."
    ]},
    {icon:"🛡️",title:"Conformité NF525",desc:"Vérifier la chaîne fiscale, exporter FEC et archive.",steps:[
      "Cliquez sur « NF525 » dans la barre latérale gauche (13ème bouton, icône bouclier).",
      "En haut : l'attestation de conformité avec le numéro de certification, l'organisme (INFOCERT/LNE) et la catégorie.",
      "3 compteurs : Tickets (nombre total), Clôtures Z, GT (Grand Total cumulé).",
      "La chaîne SHA-256 : chaque vente est signée et chaînée à la précédente. Le dernier hash est affiché.",
      "Bouton « Archive fiscale » : télécharge un fichier JSON avec toutes les données fiscales.",
      "Bouton « Export FEC » : génère le Fichier des Écritures Comptables au format réglementaire pour l'administration fiscale ou votre comptable.",
      "Bouton « Vérifier l'intégrité de la chaîne » : lance un contrôle complet. Un résultat vert = tout est conforme, rouge = anomalie détectée.",
      "En bas : le tableau « Déclaration TVA assistée » avec la base HT et la TVA collectée par taux."
    ]},
    {icon:"⚙️",title:"Réglages complets",desc:"Tous les paramètres de la caisse et de la boutique.",steps:[
      "Cliquez sur « Réglages » dans la barre latérale gauche (14ème bouton, icône engrenage).",
      "13 onglets disponibles en haut de l'écran :",
      "  • « Général » → Nom boutique, adresse, code postal, ville, SIRET, N° TVA intra, téléphone, message de pied de ticket. Cliquez « Enregistrer » après modification.",
      "  • « 💰 Prix HT/TTC » → Choisissez si vous saisissez vos prix en HT ou TTC. Le système calcule automatiquement l'autre.",
      "  • « Commission » → Configurez le taux de commission des vendeurs (% sur marge ou CA).",
      "  • « Magasins » → Ajoutez plusieurs points de vente avec nom et adresse. Utile pour le multi-sites.",
      "  • « 🖨️ Imprimante » → Connecter/déconnecter l'imprimante thermique, choisir largeur (32/48 col.), test d'impression. En dessous : configuration des étiquettes (format, contenu).",
      "  • « 🧾 Ticket » → URL du logo, texte d'en-tête, texte de pied de page, cases à cocher pour afficher/masquer : TVA détaillée, vendeur, N° ticket, date, etc.",
      "  • « 📺 Écran 2 » → Couleur de fond (hex), couleur texte (hex), URL du logo, message d'accueil quand le panier est vide.",
      "  • « 🏷️ Icônes catégories » → Pour chaque catégorie, saisissez un emoji (ex : 👕 pour Hauts, 👖 pour Bas). Cet emoji apparaît sur les cartes produits dans la grille de vente.",
      "  • « Retours » → Délai max de retour (jours), motifs autorisés, modes de remboursement activés (avoir, espèces, carte, échange).",
      "  • « 📏 Ordre tailles » → Liste de toutes les tailles avec leur rang de tri. Modifiez le numéro pour réordonner (ex : XS=1, S=2, M=3, L=4, XL=5). Les tailles de vos produits sont importées automatiquement.",
      "  • « Thème » → Couleur principale et couleur d'accent de l'interface.",
      "  • « Pointages » → Historique des pointages IN/OUT de tous les utilisateurs.",
      "  • « Historique prix » → Journal de toutes les modifications de prix : ancien prix → nouveau prix, date, utilisateur.",
      "⚠️ Cliquez « Enregistrer » après chaque modification d'onglet."
    ]},
    {icon:"⌨️",title:"Raccourcis clavier",desc:"Aller plus vite avec le clavier.",steps:[
      "F2 → Paiement rapide par carte bancaire (valide et encaisse le panier en CB immédiatement).",
      "F3 → Paiement rapide en espèces (montant exact, pas de rendu de monnaie).",
      "F4 → Ouvre la popup de paiement fractionné.",
      "F5 → Met le panier actuel en attente.",
      "F8 → Annule / vide le panier en cours (demande un motif).",
      "Shift + ? → Affiche la popup récapitulative des raccourcis.",
      "Vous pouvez aussi voir les raccourcis en cliquant sur « ? Raccourcis » en haut à droite de l'écran de vente (dans le bandeau vert).",
      "⚠️ Les raccourcis fonctionnent uniquement quand le curseur n'est PAS dans un champ de saisie."
    ]},
    {icon:"🔒",title:"Pointage (arrivée / départ)",desc:"Pointer son entrée et sa sortie de poste.",steps:[
      "Dans la barre latérale gauche, en haut sous votre initiale (le rond avec votre première lettre), vous voyez deux petits boutons :",
      "  • « IN » (fond vert clair) → Cliquez pour pointer votre arrivée. L'heure est enregistrée.",
      "  • « OUT » (fond rouge clair) → Cliquez pour pointer votre départ.",
      "Un indicateur « Online » (vert) ou « Offline » (rouge) est affiché juste en dessous pour voir l'état de la connexion.",
      "L'historique des pointages est consultable dans Réglages → onglet « Pointages », ou dans Dashboard → Journal d'audit."
    ]},
    {icon:"📺",title:"Écran client (Écran 2)",desc:"Afficher le panier sur un 2ème écran orienté vers le client.",steps:[
      "Dans la barre latérale gauche, tout en bas (avant le bouton rouge « Sortir »), cliquez sur le bouton « Écran 2 ».",
      "Une nouvelle fenêtre s'ouvre. Faites-la glisser sur le 2ème écran (orienté vers le client).",
      "L'écran affiche en temps réel : les articles ajoutés au panier, les prix, les remises et le total TTC.",
      "Quand le panier est vide, un message d'accueil personnalisable s'affiche.",
      "Pour personnaliser : « Réglages » → onglet « 📺 Écran 2 » → modifiez les couleurs, le logo et le message d'accueil."
    ]},
    {icon:"📶",title:"Mode hors-ligne et synchronisation",desc:"Que se passe-t-il quand la connexion est perdue.",steps:[
      "Un indicateur « Online » (point vert) ou « Offline » (point rouge) est visible sous votre initiale dans la barre latérale.",
      "Si la connexion au serveur est perdue, un bandeau orange/rouge apparaît en haut de l'écran : « Mode hors-ligne — Données locales ».",
      "Vous pouvez continuer à encaisser normalement. Les ventes sont enregistrées localement.",
      "Si des synchronisations échouent, un badge « ⏳ X sync » apparaît sous l'indicateur. Cliquez dessus pour voir les détails ou purger la file d'attente.",
      "Quand la connexion revient, les données se synchronisent automatiquement avec le serveur."
    ]},
    {icon:"🚪",title:"Se déconnecter",desc:"Quitter la session et revenir à l'écran de connexion.",steps:[
      "Dans la barre latérale gauche, tout en bas, cliquez sur le bouton rouge « Sortir » (icône de déconnexion).",
      "Vous revenez à l'écran de connexion. Le panier en cours est conservé en mémoire.",
      "Sur l'écran de connexion, vous pouvez choisir un autre utilisateur ou basculer en mode Dashboard (admin uniquement)."
    ]}
  ];
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <div style={{width:44,height:44,borderRadius:14,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <HelpCircle size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Aide Caissier</h2>
        <p style={{fontSize:12,color:C.textMuted,margin:0}}>Guide complet — cliquez sur une section pour voir les instructions détaillées</p></div></div>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {sections.map((s,idx)=>(<div key={s.title} style={{background:C.surface,borderRadius:16,border:`1.5px solid ${openIdx===idx?C.primary:C.border}`,boxShadow:`0 1px 4px ${C.shadow}`,overflow:"hidden",transition:"all 0.2s"}}>
        <button onClick={()=>setOpenIdx(openIdx===idx?null:idx)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"14px 18px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
          <span style={{fontSize:26}}>{s.icon}</span>
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:C.text}}>{s.title}</div>
            <div style={{fontSize:11,color:C.textMuted}}>{s.desc}</div></div>
          <ChevronDown size={18} color={C.textMuted} style={{transform:openIdx===idx?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}/></button>
        {openIdx===idx&&<div style={{padding:"0 18px 16px 18px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:12}}>
            {s.steps.map((step,i)=>(<div key={i} style={{display:"flex",alignItems:"start",gap:10,fontSize:12,color:C.text,lineHeight:1.5}}>
              {!step.startsWith("  •")&&!step.startsWith("⚠️")?<span style={{minWidth:22,height:22,borderRadius:11,background:`${C.primary}15`,color:C.primary,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{step.startsWith("⚠️")?"":(i+1)}</span>
              :<span style={{minWidth:22}}/>}
              <span style={{fontWeight:step.startsWith("⚠️")?600:400,color:step.startsWith("⚠️")?C.warn:step.startsWith("  •")?C.textMuted:C.text}}>{step}</span></div>))}</div></div>}
      </div>))}</div></div>);
}


export default HelpCashierScreen;
export { HelpCashierScreen };
