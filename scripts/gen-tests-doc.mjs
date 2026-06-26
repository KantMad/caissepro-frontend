#!/usr/bin/env node
// Génère TESTS.md à partir des VRAIS résultats Vitest.
// Usage : npm run test:doc
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync } from "node:fs";

const OUT = ".vitest-result.json";
let failed = false;
try {
  execSync(`npx vitest run --reporter=json --outputFile=${OUT}`, { stdio: ["ignore", "ignore", "inherit"] });
} catch (e) {
  failed = true; // tests rouges : on documente quand même l'état
}

const r = JSON.parse(readFileSync(OUT, "utf8"));
const root = process.cwd();
const rel = (p) => p.replace(root + "/", "");

// Regrouper les assertions par fichier
const byFile = {};
for (const f of r.testResults || []) {
  const file = rel(f.name);
  byFile[file] = (f.assertionResults || []).map((a) => ({
    title: [...(a.ancestorTitles || []), a.title].join(" › "),
    ok: a.status === "passed",
  }));
}

const icon = (ok) => (ok ? "✅" : "❌");
const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

let md = `# Tests unitaires — état du front

> **Document généré automatiquement** par \`npm run test:doc\` (ne pas éditer à la main).
> Dernière exécution : ${stamp}

## Résultat global

- ${r.numFailedTests ? "❌" : "✅"} **${r.numPassedTests}/${r.numTotalTests} tests passés** — ${Object.keys(byFile).length} fichier(s)${r.numFailedTests ? ` — ⚠️ ${r.numFailedTests} échec(s)` : ""}

## Comment lancer

\`\`\`bash
npm run test        # une passe
npm run test:watch  # mode surveillance
npm run test:doc    # régénère ce document depuis les résultats réels
\`\`\`

## Périmètre

Tests **unitaires** des fonctions **pures / logiques** (calculs fiscaux, normalisations,
EAN-13, tri, fidélité). Hors périmètre (relèveraient de tests d'intégration) : composants
React, handlers d'événements, wrappers API, provider \`context.jsx\`.

## Détail par fichier
`;

for (const file of Object.keys(byFile).sort()) {
  const tests = byFile[file];
  const pass = tests.filter((t) => t.ok).length;
  md += `\n### \`${file}\` — ${pass}/${tests.length} ${pass === tests.length ? "✅" : "❌"}\n\n`;
  for (const t of tests) md += `- ${icon(t.ok)} ${t.title}\n`;
}

writeFileSync("TESTS.md", md);
try { rmSync(OUT); } catch {}
console.log(`TESTS.md généré : ${r.numPassedTests}/${r.numTotalTests} tests.`);
process.exit(failed ? 1 : 0);
