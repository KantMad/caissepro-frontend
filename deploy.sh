#!/usr/bin/env bash
set -euo pipefail

# ════════════════════════════════════════════════════════════
#  Déploiement FRONTEND CaissePro — https://caisse.techincash.app
#  Périmètre STRICT : ce dossier uniquement. Ne touche JAMAIS
#  à gestlog.techincash.app ni à aucun autre service du VPS.
# ════════════════════════════════════════════════════════════

# Se place dans le dossier du script (peu importe d'où il est lancé)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "▶ Déploiement frontend CaissePro"
echo "  Dossier : $SCRIPT_DIR"
echo "  Branche : $BRANCH"

# Récupère la dernière version (le serveur doit toujours refléter le repo)
git fetch origin
BEFORE="$(git rev-parse HEAD)"
git reset --hard "origin/$BRANCH"
AFTER="$(git rev-parse HEAD)"

if [ "$BEFORE" = "$AFTER" ]; then
  echo "  Déjà à jour ($AFTER). Rebuild quand même pour être sûr."
else
  echo "  Mise à jour : $BEFORE → $AFTER"
fi

# npm install seulement si les dépendances ont changé
if [ "$BEFORE" != "$AFTER" ] && git diff --name-only "$BEFORE" "$AFTER" | grep -qE 'package(-lock)?\.json'; then
  echo "▶ Dépendances modifiées → npm install"
  npm install
fi

echo "▶ Build (vite)"
npm run build

echo "✓ Frontend déployé — https://caisse.techincash.app"
echo "  nginx sert dist/ directement, aucun restart nécessaire."
