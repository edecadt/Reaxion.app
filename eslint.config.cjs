const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");
const pluginImport = require("eslint-plugin-import");

module.exports = [
  // Règles de base JS
  js.configs.recommended,

  // Règles TypeScript
  ...tseslint.configs.recommended,

  // Désactive les règles en conflit avec Prettier
  prettier,

  {
    files: ["**/*.{js,ts,jsx,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      import: pluginImport,
    },
    rules: {
      // Bonnes pratiques
      "no-unused-vars": "warn",
      "no-console": "off",

      // Ordre des imports
      "import/order": [
        "warn",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
          ],
          "newlines-between": "always",
        },
      ],

      // TypeScript
      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
    ignores: [
      // Répertoires à ignorer
      "node_modules",
      "dist",
      "build",
      "coverage",
      ".turbo",
      ".next",
      "out",

      // Fichiers de config à ignorer
      "*.config.js",
      "*.config.cjs",
      "commitlint.config.js",
    ],
  },
];
