#!/usr/bin/env bash
# APK Sunmi pour une instance CLIENT (docs/13-apk-client.md), construit sur le Mac.
#
#   bash scripts/build-apk-client.sh https://happybluetea.techincash.app HappyBlueTea [dossier_sortie]
#
# L'APK est une coquille qui ouvre l'adresse du client (server.url). Le reglage n'est JAMAIS
# ecrit dans ce depot : la construction se fait dans une copie temporaire (un push sur main
# publie l'APK de MCS, qui doit continuer d'ouvrir caisse.techincash.app).
# Signature : cle stable du Mac (~/.android/debug.keystore, empreinte aad3...), verifiee a la fin.
set -euo pipefail

URL="${1:?adresse https du client, ex. https://happybluetea.techincash.app}"
NOM="${2:?nom court sans espace, ex. HappyBlueTea}"
SORTIE="${3:-$PWD/apk-clients}"
ATTENDU=aad3a25b61b9df83a1ca00b61626b179a6b0fcccce600bbae2dbc2db93e237c7

[[ "$URL" =~ ^https://[a-z0-9.-]+$ ]] || { echo "ERREUR : adresse https://domaine attendue (sans / final)"; exit 1; }
[[ "$URL" != "https://caisse.techincash.app" ]] || { echo "ERREUR : c'est l'adresse de MCS (APK publie par la CI)"; exit 1; }
[[ "$NOM" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "ERREUR : nom sans espace ni accent"; exit 1; }
KS="${TIC_KEYSTORE:-$HOME/.android/debug.keystore}"
[ -f "$KS" ] || { echo "ERREUR : cle de signature absente ($KS)"; exit 1; }
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
[ -z "${JAVA_HOME:-}" ] && [ -d "$JBR" ] && export JAVA_HOME="$JBR"

DEPOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "Copie de travail : $TMP"
rsync -a --exclude node_modules --exclude dist --exclude dist-next --exclude .git \
  --exclude android/app/build --exclude android/build --exclude android/.gradle "$DEPOT/" "$TMP/app/"
ln -s "$DEPOT/node_modules" "$TMP/app/node_modules"
cd "$TMP/app"

# Reglages du client : adresse ouverte, navigation limitee a son domaine, pas d'inspection USB
HOTE="${URL#https://}"
node -e '
const fs = require("fs"); const f = "capacitor.config.json"; const c = JSON.parse(fs.readFileSync(f, "utf8"));
c.server.url = process.argv[1]; c.server.allowNavigation = [process.argv[2]];
c.android = { ...(c.android || {}), webContentsDebuggingEnabled: false };
fs.writeFileSync(f, JSON.stringify(c, null, 2) + "\n");' "$URL" "$HOTE"
grep -q "\"url\": \"$URL\"" capacitor.config.json || { echo "ERREUR : adresse non ecrite"; exit 1; }

echo "Construction web (repli hors ligne de la coquille)…"
VITE_API_URL="$URL" npx vite build --logLevel warn
npx cap sync android >/dev/null
echo "Construction Android…"
(cd android && TIC_KEYSTORE="$KS" ./gradlew -q assembleDebug)
APK=android/app/build/outputs/apk/debug/app-debug.apk

APKSIGNER="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)apksigner"
OBTENU=$("$APKSIGNER" verify --print-certs "$APK" | grep -m1 'SHA-256 digest' | awk '{print $NF}')
[ "$OBTENU" = "$ATTENDU" ] || { echo "ERREUR : signature inattendue ($OBTENU)"; exit 1; }
# Controle : l'adresse embarquee est bien celle du client
unzip -p "$APK" assets/capacitor.config.json | grep -q "\"url\": \"$URL\"" || { echo "ERREUR : l'APK n'ouvre pas $URL"; exit 1; }

mkdir -p "$SORTIE"
VERSION=$(node -p 'require("./package.json").version')
DEST="$SORTIE/TechInCash-$NOM-$VERSION.apk"
cp "$APK" "$DEST"
echo "OK : $DEST"
echo "     ouvre $URL, signature stable verifiee"
