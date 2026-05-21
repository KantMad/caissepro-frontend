import React, { useState } from "react";
import { Archive, HelpCircle, ChevronDown } from "lucide-react";
import { C } from "../constants.jsx";

function HelpDashboardScreen(){
  const[openIdx,setOpenIdx]=useState(null);
  const sections=[
    {icon:"📊",title:"Tableau de bord (Dashboard)",desc:"Vue d'ensemble de l'activité du magasin.",steps:[
      "Cliquez sur « Dashboard » dans la barre latérale gauche (1er élément, icône tableau de bord). C'est la page d'accueil du mode gestion.",
      "En haut : le bandeau vert « Aujourd'hui » affiche en temps réel le nombre de ventes du jour, le CA du jour et le panier moyen.",
      "En dessous : 4 cartes récapitulatives — CA total (Grand Total), Marge totale (si autorisé), Nombre de tickets, Alertes de stock.",
      "Si des produits sont en rupture ou stock bas, un encadré orange « Alertes de stock » liste les variantes concernées.",
      "En bas : le classement « Top 5 produits » affiche les articles les plus vendus avec la quantité et le CA généré."
    ]},
    {icon:"📦",title:"Gestion des produits",desc:"Ajouter, modifier, dupliquer et supprimer des produits.",steps:[
      "Cliquez sur « Produits » dans la barre latérale gauche (2ème élément, icône colis).",
      "La liste de tous vos produits s'affiche avec le nom, la catégorie, le prix et le nombre de variantes.",
      "AJOUTER un produit : cliquez sur le bouton « + Nouveau produit » en haut à droite.",
      "  • Remplissez les champs : Nom, SKU (référence), Catégorie, Prix de vente TTC (ou HT selon votre réglage), Prix d'achat (coût), Taux de TVA.",
      "  • Pour ajouter une variante : dans la section « Variantes », cliquez « + Ajouter une variante ». Renseignez la taille, la couleur, le code EAN et le stock initial.",
      "  • Cliquez « Enregistrer » pour sauvegarder le produit.",
      "MODIFIER un produit : cliquez sur la ligne du produit dans la liste. La fiche s'ouvre. Modifiez les champs souhaités puis cliquez « Enregistrer ».",
      "DUPLIQUER un produit : dans la fiche produit, cliquez sur le bouton « Dupliquer ». Une copie est créée avec le suffixe « (copie) ».",
      "IMPRIMER DES ÉTIQUETTES : dans la fiche produit, cliquez sur le bouton « Étiquettes » (entre « Enregistrer » et « Supprimer »). Sélectionnez le format et les variantes à imprimer.",
      "SUPPRIMER un produit : dans la fiche produit, cliquez sur le bouton « Supprimer » (en rouge). Confirmez la suppression.",
      "⚠️ La suppression est définitive. Pour les produits ayant un historique de vente, préférez les désactiver plutôt que les supprimer."
    ]},
    {icon:"📄",title:"Import CSV de produits",desc:"Importer des produits en masse depuis un fichier Excel/CSV.",steps:[
      "Cliquez sur « Produits » dans la barre latérale gauche, puis sur le bouton « Importer CSV » en haut de l'écran.",
      "Cliquez sur « Choisir un fichier » et sélectionnez votre fichier .csv (séparateur virgule ou point-virgule).",
      "L'aperçu des colonnes détectées s'affiche. Pour chaque colonne de votre fichier, sélectionnez le champ CaissePro correspondant dans le menu déroulant :",
      "  • Colonnes disponibles : Nom, SKU, Prix de vente, Prix d'achat, Catégorie, TVA, Taille, Couleur, EAN, Stock.",
      "Si vos colonnes portent des noms standard (name, price, sku, etc.), le mapping est automatique.",
      "Vérifiez l'aperçu des premières lignes en bas de l'écran. Les données doivent correspondre aux bons champs.",
      "Cliquez « Importer » pour lancer l'import. Une barre de progression s'affiche.",
      "À la fin, un résumé indique le nombre de produits créés et les éventuelles erreurs."
    ]},
    {icon:"📈",title:"Statistiques de vente",desc:"Analyser le CA, les tendances, les graphiques et les performances.",steps:[
      "Cliquez sur « Statistiques » dans la barre latérale gauche (4ème élément, icône graphique).",
      "En haut : 5 indicateurs clés — CA TTC, Nombre de tickets, Panier moyen, Marge (€), Marge (%). Si une période est filtrée, un badge vert/rouge montre l'évolution par rapport à la période précédente.",
      "FILTRES DE PÉRIODE : sous les indicateurs, cliquez sur un bouton rapide (Tout, Aujourd'hui, Semaine, Ce mois, Mois dernier, Année) ou saisissez des dates précises dans les champs « du / au ». Vous pouvez aussi filtrer par catégorie de produit.",
      "13 onglets sont disponibles pour détailler les statistiques :",
      "  • « Évolution CA » → Graphique en barres du chiffre d'affaires jour par jour sur la période sélectionnée.",
      "  • « Comparaison » → Compare les performances de la période actuelle avec la période précédente (même durée).",
      "  • « CA par heure » → Graphique montrant les heures de pointe de votre magasin. Utile pour optimiser le planning des vendeurs.",
      "  • « CA par jour » → CA par jour de la semaine (lundi, mardi…). Identifiez vos meilleurs jours.",
      "  • « Best-sellers » → Classement des produits les plus vendus : nom, SKU, quantité vendue, CA généré, marge.",
      "  • « Détail variantes » → Ventes détaillées par produit et par variante (taille/couleur). Utile pour réassortir.",
      "  • « Par vendeur » → CA par vendeur, nombre de ventes, commission calculée, progression vers l'objectif de vente.",
      "  • « Tailles/Couleurs » → Deux graphiques : les tailles les plus vendues et les couleurs les plus vendues.",
      "  • « Collections » → CA par collection/marque avec quantité et marge.",
      "  • « Clients » → Top clients par CA dépensé et fréquence d'achat.",
      "  • « Retours » → Taux de retour, montants retournés, motifs les plus fréquents.",
      "  • « Paiements » → Répartition du CA par moyen de paiement : camembert (CB, Espèces, Chèque, Carte cadeau, etc.).",
      "  • « Remises » → Total des remises accordées sur la période, par article et globales.",
      "Bouton « Export CSV » en haut à droite : télécharge les données au format tableur (compatible Excel)."
    ]},
    {icon:"↩️",title:"Retours & Avoirs",desc:"Consulter l'historique des retours et des avoirs émis.",steps:[
      "Cliquez sur « Retours & Avoirs » dans la barre latérale gauche (5ème élément, icône flèche retour).",
      "Deux onglets sont disponibles en haut : « Tickets » (liste des ventes ayant fait l'objet d'un retour) et « Avoirs » (liste des avoirs générés).",
      "ONGLET TICKETS : chaque retour affiche la date, le numéro de ticket d'origine, les articles retournés, le motif et le mode de remboursement.",
      "ONGLET AVOIRS : chaque avoir affiche le code unique, le montant, la date de création et le statut (« Actif » si non utilisé, « Utilisé » si consommé).",
      "⚠️ Les retours sont tracés de manière inaltérable (NF525). Un retour ne peut pas être supprimé ni modifié après validation."
    ]},
    {icon:"👥",title:"Gestion des clients",desc:"Base de données clients et programme de fidélité.",steps:[
      "Cliquez sur « Clients » dans la barre latérale gauche (6ème élément, icône personnes).",
      "La liste de tous les clients s'affiche avec nom, email, téléphone, points de fidélité et tier (Bronze/Silver/Gold).",
      "AJOUTER un client : cliquez « + Nouveau client » en haut à droite. Renseignez le nom, l'email et le téléphone, puis « Créer ».",
      "MODIFIER un client : cliquez sur le bouton « Modifier » (icône crayon) à droite de la ligne du client.",
      "HISTORIQUE D'ACHATS : cliquez sur « Historique » à côté du client pour voir toutes ses ventes passées, les montants et les dates.",
      "RGPD : cliquez sur « RGPD » pour exporter ou supprimer les données personnelles du client (conformité RGPD).",
      "FIDÉLITÉ : les points sont attribués automatiquement à chaque achat. Les seuils des tiers sont configurables."
    ]},
    {icon:"👤",title:"Utilisateurs & rôles",desc:"Créer des comptes et gérer les permissions de l'équipe.",steps:[
      "Cliquez sur « Utilisateurs » dans la barre latérale gauche (7ème élément, icône personne).",
      "La liste de tous les utilisateurs s'affiche avec leur nom, rôle (Admin ou Caissier) et statut.",
      "CRÉER un utilisateur : cliquez « + Nouvel utilisateur » en haut à droite.",
      "  • Saisissez le nom, choisissez le rôle dans le menu déroulant (« Administrateur » ou « Caissier(e) »), et définissez un code PIN (mot de passe).",
      "  • Cliquez « Créer » pour enregistrer. Le compte est immédiatement disponible sur tous les appareils.",
      "MODIFIER un utilisateur : cliquez sur le bouton « Modifier » (icône engrenage) à droite de la ligne. Changez le nom, le rôle ou le PIN, puis « Enregistrer ».",
      "  • Pour changer le PIN : saisissez le nouveau PIN dans le champ « CODE PIN ». Laissez vide pour ne pas le modifier.",
      "SUPPRIMER un utilisateur : cliquez sur l'icône corbeille (🗑️) à droite. L'utilisateur est désactivé (pas supprimé, pour conserver l'historique).",
      "⚠️ Les rôles déterminent les permissions : un « Caissier » n'a pas accès au Dashboard, un « Admin » a tous les droits."
    ]},
    {icon:"💶",title:"Taux de TVA",desc:"Gérer les taux de TVA appliqués aux produits.",steps:[
      "Cliquez sur « Taux de TVA » dans la barre latérale gauche (8ème élément, icône pourcentage).",
      "La liste des taux actifs s'affiche : libellé et pourcentage (ex : « Normal 20% », « Réduit 5,5% »).",
      "MODIFIER un taux : cliquez « Modifier » à droite du taux. Changez le libellé ou le pourcentage, puis cliquez l'icône de sauvegarde (💾).",
      "AJOUTER un taux : en bas de l'écran, remplissez « Libellé » (ex : « Super réduit ») et « Taux % » (ex : 2.1), puis cliquez « + Ajouter ».",
      "SUPPRIMER un taux : cliquez l'icône corbeille à droite. Au moins un taux doit rester.",
      "ℹ️ En bas de page : un rappel des taux légaux en France (20%, 10%, 5,5%, 2,1%) avec leur usage.",
      "⚠️ Modifier un taux ne change pas la TVA des produits existants. Changez la TVA produit par produit dans leur fiche."
    ]},
    {icon:"🎁",title:"Cartes cadeaux",desc:"Créer et suivre les cartes cadeaux.",steps:[
      "Cliquez sur « Cartes cadeaux » dans la barre latérale gauche (9ème élément, icône cadeau).",
      "La liste de toutes les cartes s'affiche avec le code, le montant initial, le solde restant et le statut.",
      "CRÉER une carte : cliquez « + Nouvelle carte cadeau ». Saisissez le montant et cliquez « Créer ». Un code unique est généré automatiquement.",
      "UTILISER une carte : lors d'un paiement en mode caisse, choisissez « Fractionné », puis saisissez le code de la carte dans le champ dédié.",
      "Le solde de la carte diminue du montant utilisé. Quand le solde atteint 0€, la carte est marquée comme épuisée."
    ]},
    {icon:"🏷️",title:"Promotions",desc:"Créer, activer et gérer les promotions.",steps:[
      "Cliquez sur « Promotions » dans la barre latérale gauche (10ème élément, icône éclair).",
      "La liste des promotions s'affiche. Les promos actives ont un badge vert, les inactives un badge gris.",
      "CRÉER une promo : cliquez « + Nouvelle promotion » en haut à droite.",
      "  • Choisissez le type : « Collection » (s'applique à une catégorie), « Quantité » (ex : 3 pour le prix de 2), ou « Code promo » (le client doit saisir un code).",
      "  • Saisissez le nom, la valeur de la remise (en %), les dates de début et fin.",
      "  • Pour « Collection » : sélectionnez la catégorie concernée.",
      "  • Pour « Code promo » : définissez le code que le client devra donner (ex : SOLDES20).",
      "  • Cliquez « Créer » pour enregistrer.",
      "ACTIVER / DÉSACTIVER : cliquez sur le bouton toggle à droite de chaque promo pour l'activer ou la désactiver instantanément.",
      "Les promos actives s'appliquent automatiquement en caisse si les conditions sont remplies."
    ]},
    {icon:"🚶",title:"Compteur d'entrées (footfall)",desc:"Suivre la fréquentation et le taux de conversion.",steps:[
      "Cliquez sur « Entrées » dans la barre latérale gauche (11ème élément, icône activité).",
      "En haut : le compteur d'entrées du jour avec le bouton « + Entrée » pour ajouter un visiteur.",
      "En dessous : le taux de conversion du jour (nombre de tickets ÷ nombre d'entrées × 100).",
      "Le tableau en bas liste l'historique jour par jour : date, nombre d'entrées, nombre de tickets et taux de conversion.",
      "Le comptage peut aussi être fait depuis le mode caisse (même écran « Entrées »)."
    ]},
    {icon:"⚙️",title:"Paramètres complets",desc:"Configurer tous les aspects de la boutique.",steps:[
      "Cliquez sur « Paramètres » dans la barre latérale gauche (12ème élément, icône engrenage).",
      "Les onglets sont affichés en haut de l'écran. Cliquez sur un onglet pour accéder à sa section :",
      "ONGLET « Général » : informations de la boutique — Nom, Adresse, Code postal, Ville, SIRET, N° TVA intracommunautaire, Téléphone, Message ticket de caisse. Remplissez chaque champ puis cliquez « Enregistrer ».",
      "ONGLET « 💰 Prix HT/TTC » : choisissez si vous saisissez vos prix en HT ou en TTC. Le système calcule automatiquement l'autre valeur.",
      "ONGLET « Commission » : configurez les commissions vendeurs (pourcentage sur les ventes).",
      "ONGLET « Magasins » : si vous avez plusieurs points de vente, ajoutez-les ici avec leur nom et adresse.",
      "ONGLET « 🖨️ Imprimante » : connectez votre imprimante thermique (bouton « Connecter l'imprimante »), choisissez la largeur papier (32 ou 48 colonnes), testez l'impression. En dessous : configuration du format d'étiquettes code-barres (50×30mm, 40×25mm, etc.).",
      "ONGLET « 🧾 Ticket » : personnalisez le ticket de caisse — ajoutez un logo (collez l'URL de l'image), modifiez le texte d'en-tête et de pied de page, activez/désactivez l'affichage de la TVA détaillée, du vendeur, du numéro de ticket.",
      "ONGLET « 📺 Écran 2 » : personnalisez l'écran client — couleur de fond, couleur du texte, URL du logo, message d'accueil affiché quand le panier est vide.",
      "ONGLET « 🏷️ Icônes catégories » : pour chaque catégorie de produit, choisissez un emoji qui sera affiché sur les cartes produits dans la grille de vente en caisse. Cliquez sur le champ emoji à côté de la catégorie et saisissez l'emoji souhaité.",
      "ONGLET « Retours » : configurez la politique de retour — délai maximum (en jours), motifs autorisés, modes de remboursement disponibles (avoir, espèces, carte, échange).",
      "ONGLET « 📏 Ordre tailles » : réorganisez l'ordre d'affichage des tailles dans les fiches produits et dans la caisse. Modifiez le numéro de rang de chaque taille (les tailles sont triées par rang croissant : XS=1, S=2, M=3, etc.). Les nouvelles tailles de vos produits sont importées automatiquement.",
      "ONGLET « Thème » : choisissez les couleurs de l'interface (couleur principale, couleur d'accent).",
      "ONGLET « Pointages » : historique des pointages IN/OUT de tous les utilisateurs avec date et heure.",
      "ONGLET « Historique prix » : journal de toutes les modifications de prix sur vos produits (ancien prix → nouveau prix, date, utilisateur).",
      "⚠️ Après chaque modification, cliquez toujours sur « Enregistrer » pour sauvegarder."
    ]},
    {icon:"📦",title:"Gestion du stock",desc:"Suivre les niveaux de stock et gérer les alertes.",steps:[
      "Cliquez sur « Stock » dans la barre latérale gauche (3ème élément, icône grille).",
      "La liste de tous les produits s'affiche avec le stock actuel de chaque variante (taille/couleur).",
      "Les variantes en rupture (stock = 0) sont surlignées en rouge. Les variantes en stock bas sont en orange.",
      "AJUSTER un stock : cliquez sur le produit, modifiez la quantité de la variante et enregistrez.",
      "RÉCEPTION de marchandise : utilisez le bouton « Réception » pour ajouter du stock (livraison fournisseur).",
      "Les alertes de stock apparaissent aussi sur le Dashboard (encadré orange) et dans le badge rouge sur l'icône « Stock » en mode caisse."
    ]},
    {icon:"🛡️",title:"Fiscal NF525",desc:"Conformité fiscale, clôtures Z, exports FEC et archive.",steps:[
      "Cliquez sur « Fiscal NF525 » dans la barre latérale gauche (13ème élément, icône bouclier).",
      "En haut : l'attestation de conformité avec le numéro de certification (CERT-NF525-2026-001), l'organisme (INFOCERT/LNE), et les 4 conditions ISCA (Inaltérabilité, Sécurisation, Conservation, Archivage).",
      "3 compteurs récapitulatifs : Tickets (nombre total émis), Clôtures Z (nombre effectuées), GT (Grand Total cumulé en €).",
      "La chaîne SHA-256 : chaque vente est signée et chaînée à la précédente. Le dernier hash est affiché dans un encadré gris.",
      "2 boutons d'export :",
      "  • « Archive fiscale » (violet) → Télécharge un fichier JSON complet contenant toutes les données fiscales. À conserver en cas de contrôle.",
      "  • « Export FEC » (bleu) → Génère le Fichier des Écritures Comptables au format réglementaire (texte tabulé). Transmettez-le à votre comptable ou à l'administration fiscale.",
      "Bouton « Vérifier l'intégrité de la chaîne » : lance un contrôle complet de toutes les signatures. Résultat vert = conforme, rouge = anomalie détectée.",
      "En bas : le tableau « Déclaration TVA assistée » résume la TVA collectée par taux (20%, 10%, 5,5%, 2,1%) avec la base HT et le montant TVA. Utile pour préparer votre déclaration de TVA.",
      "⚠️ Toutes ces données sont inaltérables. Aucune modification n'est possible après signature. C'est la garantie NF525."
    ]},
    {icon:"📋",title:"Journal d'audit",desc:"Traçabilité complète de toutes les actions du système.",steps:[
      "Cliquez sur « Journal d'audit » dans la barre latérale gauche (14ème élément, icône activité).",
      "2 onglets en haut : « Audit » (actions métier) et « JET (NF525) » (Journal des Événements Techniques).",
      "ONGLET AUDIT : liste toutes les actions métier — ventes (VENTE), annulations (VOID_SALE, VOID_LINE), modifications de produits (PRODUCT), réceptions de stock (RECEPTION), modifications de prix (PRICE_CHANGE), clôtures (CLOTURE), exports (EXPORT, FEC), etc.",
      "ONGLET JET : événements techniques — connexions (LOGIN), déconnexions (LOGOUT), changements de paramètres, erreurs système, avoirs.",
      "Chaque entrée affiche : la date/heure, l'utilisateur, le type d'action (badge coloré), le détail et la référence.",
      "FILTRER : menu déroulant « Tous les utilisateurs » en haut à droite pour ne voir que les actions d'un utilisateur spécifique.",
      "Bouton « Export » en haut à droite : télécharge le journal en CSV pour archivage ou transmission.",
      "Navigation par pages en bas : 50 entrées par page. Cliquez sur les numéros pour naviguer.",
      "⚠️ Le journal d'audit est inaltérable (NF525). Aucune entrée ne peut être modifiée ou supprimée. Il constitue une preuve en cas de contrôle fiscal."
    ]},
    {icon:"🔄",title:"Basculer vers le mode Caisse",desc:"Passer du Dashboard au mode Caisse et inversement.",steps:[
      "Pour quitter le Dashboard et aller en mode Caisse : cliquez sur « Déconnexion » en bas de la barre latérale gauche (bouton rouge).",
      "Sur l'écran de connexion, sélectionnez votre profil et choisissez « Mode Caisse » ou « Mode Dashboard ».",
      "Le mode Caisse est destiné aux opérations quotidiennes (encaissements, retours, etc.).",
      "Le mode Dashboard est destiné à la gestion (produits, stats, paramètres, utilisateurs, fiscal).",
      "⚠️ Seuls les utilisateurs avec le rôle « Admin » peuvent accéder au mode Dashboard."
    ]}
  ];
  return(<div style={{height:"100%",overflowY:"auto",padding:20,background:C.bg}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
      <div style={{width:44,height:44,borderRadius:14,background:C.primary,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <HelpCircle size={22} color="#fff"/></div>
      <div><h2 style={{fontSize:22,fontWeight:800,margin:0}}>Aide Dashboard</h2>
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
              {!step.startsWith("  •")&&!step.startsWith("⚠️")&&!step.startsWith("ℹ️")?<span style={{minWidth:22,height:22,borderRadius:11,background:`${C.primary}15`,color:C.primary,fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</span>
              :<span style={{minWidth:22}}/>}
              <span style={{fontWeight:step.startsWith("⚠️")||step.startsWith("ℹ️")?600:step.startsWith("ONGLET")||step.startsWith("AJOUTER")||step.startsWith("MODIFIER")||step.startsWith("CRÉER")||step.startsWith("SUPPRIMER")||step.startsWith("DUPLIQUER")||step.startsWith("IMPRIMER")||step.startsWith("ACTIVER")||step.startsWith("HISTORIQUE")||step.startsWith("RGPD")||step.startsWith("FILTRER")||step.startsWith("RÉCEPTION")||step.startsWith("AJUSTER")||step.startsWith("UTILISER")?600:400,color:step.startsWith("⚠️")?C.warn:step.startsWith("ℹ️")?C.info:step.startsWith("  •")?C.textMuted:C.text}}>{step}</span></div>))}</div></div>}
      </div>))}</div></div>);
}



/* ══════════ EXPORTS CENTER (Dashboard) ══════════ */

export default HelpDashboardScreen;
export { HelpDashboardScreen };
