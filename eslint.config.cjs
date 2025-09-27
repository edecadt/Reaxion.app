const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const prettier = require("eslint-config-prettier");
const pluginImport = require("eslint-plugin-import");

module.exports = [
  js.configs.recommended,

  ...tseslint.configs.recommended,

  prettier,

  {
    files: ["*.config.cjs", "*.config.js"],
    languageOptions: {
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
      },
      sourceType: "commonjs",
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

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
      "no-unused-vars": "warn",
      "no-console": "off",

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

      "@typescript-eslint/explicit-module-boundary-types": "off",
    },
    ignores: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      ".turbo",
      ".next",
      "out",

      "*.config.js",
      "*.config.cjs",
      "commitlint.config.js",
    ],
  },
];
