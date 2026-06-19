#!/usr/bin/env bash
# Vérifie que le code Sunmi (imprimante + paiement + plugin natif) est IDENTIQUE à la baseline.
# Ce contrôle ne concerne QUE la Sunmi.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."   # → caissepro-frontend/

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

awk '/^class SunmiPrinterAdapter \{/{f=1} f{print} f&&/^}$/{exit}' src/hardware.js > "$TMP/SunmiPrinterAdapter.snapshot.js"
awk '/^class SunmiPaymentAdapter \{/{f=1} f{print} f&&/^}$/{exit}' src/hardware.js > "$TMP/SunmiPaymentAdapter.snapshot.js"
cp android/app/src/main/java/com/caissepro/app/SunmiPrinterPlugin.java "$TMP/SunmiPrinterPlugin.snapshot.java"

NEW_PRINTER=$(shasum -a 256 "$TMP/SunmiPrinterAdapter.snapshot.js" | awk '{print $1}')
NEW_PAY=$(shasum -a 256 "$TMP/SunmiPaymentAdapter.snapshot.js" | awk '{print $1}')
NEW_JAVA=$(shasum -a 256 "$TMP/SunmiPrinterPlugin.snapshot.java" | awk '{print $1}')

REF_PRINTER=$(grep SunmiPrinterAdapter sunmi-baseline/SHA256SUMS.txt | awk '{print $1}')
REF_PAY=$(grep SunmiPaymentAdapter sunmi-baseline/SHA256SUMS.txt | awk '{print $1}')
REF_JAVA=$(grep SunmiPrinterPlugin sunmi-baseline/SHA256SUMS.txt | awk '{print $1}')

status=0
check() { if [ "$2" = "$3" ]; then echo "OK    $1"; else echo "DIFF  $1 (baseline=$2  actuel=$3)"; status=1; fi; }
check "SunmiPrinterAdapter (imprimante)" "$REF_PRINTER" "$NEW_PRINTER"
check "SunmiPaymentAdapter (paiement)"   "$REF_PAY"     "$NEW_PAY"
check "SunmiPrinterPlugin.java (natif)"  "$REF_JAVA"    "$NEW_JAVA"

echo "---"
if [ "$status" -eq 0 ]; then echo "✅ Sunmi INTACTE — aucune modification."; else echo "❌ Sunmi MODIFIÉE — à corriger !"; fi
exit $status
