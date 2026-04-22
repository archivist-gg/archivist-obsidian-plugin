import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import comments from "@eslint-community/eslint-plugin-eslint-comments";

// Rules the Obsidian Review Bot forbids disabling via inline directives.
const restrictedDisableRules = [
  "obsidianmd/*",
  "no-console",
  "no-restricted-globals",
  "no-restricted-imports",
  "no-alert",
  "@typescript-eslint/no-deprecated",
  "@typescript-eslint/no-explicit-any",
  "@microsoft/sdl/no-document-write",
  "@microsoft/sdl/no-eval",
  "@microsoft/sdl/no-inner-html",
  "import/no-nodejs-modules",
  "!obsidianmd/ui/sentence-case",
];

export default defineConfig([
  {
    ignores: [
      "main.js",
      "node_modules/**",
      "dist/**",
      "scripts/**",
      "tests/**",
      "test-vault/**",
      "docs/**",
      "esbuild.config.mjs",
      "vitest.config.ts",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    plugins: {
      "@eslint-community/eslint-comments": comments,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      "no-undef": "off",
      // Match the Obsidian Review Bot's additional checks so we can reproduce
      // them locally before pushing.
      "require-await": "error",
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        ...restrictedDisableRules,
      ],
      "@eslint-community/eslint-comments/no-unused-disable": "error",
    },
  },
]);
