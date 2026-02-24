// Ensure all dev dependencies are saved
// npm install --save-dev eslint eslint_d globals prettier @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-html eslint-plugin-json eslint-plugin-prettier eslint-config-prettier stylelint stylelint-config-tailwindcss typescript
// Set in .bashrc or .zshrc: export ESLINT_USE_FLAT_CONFIG=true

import prettierPlugin from "eslint-plugin-prettier";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import htmlPlugin from "eslint-plugin-html";
import jsonPlugin from "eslint-plugin-json";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

const rules = {
  "arrow-parens": ["error", "always"],
  "max-len": ["warn", { code: 100 }],
  indent: ["error", 2, { SwitchCase: 1, MemberExpression: "off", flatTernaryExpressions: true }],
  "no-undef": "error",
  "no-unused-vars": [
    "warn",
    { args: "all", argsIgnorePattern: "(^.+_$)", varsIgnorePattern: "(^.+_$)" },
  ],
  "comma-spacing": ["warn", { before: false, after: true }],
  "comma-dangle": ["warn", "always-multiline"],
  "eol-last": "error",
  eqeqeq: "error",
  "linebreak-style": ["error", "unix"],
  radix: ["error", "as-needed"],
  semi: ["error", "always"],
};

export default [
  {
    files: ["**/*.js", "**/*.cjs"],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...rules,
      "prettier/prettier": "error",
    },
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
        Bun: "readonly",
        Deno: "readonly",
      },
    },
  },
  {
    files: ["**/*.mjs"],
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...rules,
      "prettier/prettier": "error",
    },
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        Bun: "readonly",
        Deno: "readonly",
        ...globals.es2021,
      },
    },
  },
  {
    files: ["**/*.ts"],
    plugins: {
      prettier: prettierPlugin,
      "@typescript-eslint": tsEslintPlugin,
    },
    rules: {
      ...rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "(^.+_$)" }],
      "prettier/prettier": "error",
    },
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        Bun: "readonly",
        Deno: "readonly",
        ...globals.es2021,
      },
    },
  },
  {
    files: ["**/*.tsx"],
    plugins: {
      prettier: prettierPlugin,
      "@typescript-eslint": tsEslintPlugin,
    },
    rules: {
      ...rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "(^.+_$)" }],
      "prettier/prettier": "error",
    },
    languageOptions: {
      parser: tsParser,
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
        Bun: "readonly",
        Deno: "readonly",
        ...globals.es2021,
      },
    },
  },
  {
    files: ["**/*.html", "**/*.htm"],
    plugins: {
      html: htmlPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...rules,
      "prettier/prettier": "error",
    },
    languageOptions: {
      sourceType: "module",
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        Bun: "readonly",
        Deno: "readonly",
      },
    },
  },
  {
    files: ["**/*.json"],
    plugins: {
      json: jsonPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      "json/*": ["error", { allowComments: true }],
      "prettier/prettier": "error",
    },
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
        Bun: "readonly",
        Deno: "readonly",
      },
    },
  },
  prettierConfig,
];

