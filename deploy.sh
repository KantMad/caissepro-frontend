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

# Retour a la version precedente : bash deploy.sh --retour
# ECHANGE dist et dist-prev, ne supprime jamais rien (une 2e fois = retour a la version recente).
# Avant (28/10/2026) : « rm -rf dist && mv dist-prev dist » a supprime la caisse en ligne alors
# que dist-prev n'existait pas encore -> caisse.techincash.app en 404.
if [ "${1:-}" = "--retour" ]; then
  if [ ! -f dist-prev/index.html ]; then
    echo "✗ Aucune version precedente (dist-prev) : rien n'a ete touche. La caisse en ligne est inchangee."
    exit 1
  fi
  rm -rf dist-swap
  [ -d dist ] && mv dist dist-swap
  mv dist-prev dist
  [ -d dist-swap ] && mv dist-swap dist-prev
  echo "✓ Version precedente remise en ligne (la version retiree est gardee dans dist-prev)."
  exit 0
fi

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
  npm install --include=dev   # build = vite + @vitejs/plugin-react (devDependencies, omis si NODE_ENV=production)
fi

# Tests AVANT toute mise en ligne (dont l'explorateur qui clique chaque ecran) : en cas d'echec,
# la caisse en ligne reste sur la version precedente. Urgence seulement : SANS_TESTS=1 bash deploy.sh
if [ "${SANS_TESTS:-0}" != "1" ]; then
  # Une ligne par fichier de test termine + un signe de vie toutes les 30 s (l'explorateur d'ecrans
  # dure plusieurs minutes sans rien afficher). Coupe au bout de 15 min s'il reste bloque.
  echo "▶ Tests (3 a 8 min sur le VPS, une ligne par fichier termine)"
  T0=$SECONDS
  ( while sleep 30; do echo "  ... tests en cours ($(( SECONDS - T0 )) s)"; done ) &
  VEILLE=$!
  set +e
  timeout 900 npm run test --silent -- --reporter=verbose 2>&1 | tee /tmp/caisse-tests.log \
    | awk '$1=="×" { print; fflush() }
           $1=="✓" && $2!=dernier { dernier=$2; print "  ✓ " $2; fflush() }
           /Test Files|Tests  / { print; fflush() }'
  CODE_TESTS=${PIPESTATUS[0]}
  set -e
  kill "$VEILLE" 2>/dev/null || true
  [ "$CODE_TESTS" = "124" ] && echo "✗ Tests bloques depuis 15 min : arretes."
  if [ "$CODE_TESTS" != "0" ]; then
    tail -40 /tmp/caisse-tests.log
    echo "✗ TESTS EN ECHEC : rien n'est mis en ligne, la caisse reste sur la version precedente."
    echo "  Journal complet : /tmp/caisse-tests.log"
    exit 1
  fi
  echo "  Tests OK"
fi

# Build dans un dossier A PART puis bascule instantanee : avant, vite vidait dist/ (servi par nginx)
# pendant le build -> caisse a moitie vide 30 s, et cassee si le build echouait.
echo "▶ Build (vite)"
rm -rf dist-next
npm run build -- --outDir dist-next --emptyOutDir
[ -f dist-next/index.html ] || { echo "✗ Build incomplet (pas d'index.html) : rien n'est mis en ligne."; exit 1; }
rm -rf dist-prev
[ -d dist ] && mv dist dist-prev
mv dist-next dist

echo "✓ Frontend déployé — https://caisse.techincash.app"
echo "  nginx sert dist/ directement, aucun restart nécessaire."
echo "  Retour a la version precedente si besoin : bash deploy.sh --retour"
