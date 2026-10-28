// Garde-fou unique : variables et composants NON DEFINIS (no-undef). Un tel bug, dans un
// try/catch, echoue en silence : ni le build ni les tests ne le voient (cas reels du
// 28/10/2026 : todayStr dans la verification du Z, setStockAlerts, new Intent).
// Lance par « npm run test » -> bloque deploy.sh, la CI et la publication de l'APK.
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";   // charge pour les commentaires eslint-disable existants

export default [
  { ignores: ["dist/**", "dist-*/**", "android/**", "node_modules/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/**/*.test.*"],
    plugins: { react, "react-hooks": reactHooks },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    languageOptions: {
      ecmaVersion: "latest", sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, __APP_VERSION__: "readonly", __BUILD_TIME__: "readonly" },
    },
    rules: { "no-undef": "error", "react/jsx-no-undef": "error", "react/jsx-uses-vars": "error",
             "react-hooks/exhaustive-deps": "off" },
  },
];
