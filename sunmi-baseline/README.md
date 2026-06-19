# Baseline Sunmi — NE PAS MODIFIER

Snapshot de référence du **code Sunmi qui fonctionne** (testé OK), capturé avant la refonte des
autres canaux d'impression. Sert à **vérifier que la Sunmi n'a pas été modifiée**.

## Contenu

| Fichier | Origine |
|---------|---------|
| `SunmiPrinterAdapter.snapshot.js` | classe `SunmiPrinterAdapter` extraite de `src/hardware.js` |
| `SunmiPaymentAdapter.snapshot.js` | classe `SunmiPaymentAdapter` extraite de `src/hardware.js` |
| `SunmiPrinterPlugin.snapshot.java` | `android/.../SunmiPrinterPlugin.java` (plugin natif) |
| `SHA256SUMS.txt` | empreintes de référence |

## Vérifier que la Sunmi n'a pas changé

Lancer `./verify.sh` depuis `caissepro-frontend/`. Le script ré-extrait les classes Sunmi du
code **actuel** et compare leurs empreintes à la baseline. Sortie `OK` = Sunmi intacte.

```bash
bash sunmi-baseline/verify.sh
```

Règle : **seul ce contrôle concerne la Sunmi.** Si une empreinte diffère → la Sunmi a été
touchée par erreur, il faut annuler la modif.
