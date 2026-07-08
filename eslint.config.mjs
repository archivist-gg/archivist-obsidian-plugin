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
  // sentence-case is the one rule we deliberately permit disabling inline (for
  // legitimate proper nouns / acronyms in UI copy). `no-restricted-disable`
  // matches rule IDs with gitignore semantics (the `ignore` package), where
  // `obsidianmd/*` excludes the `obsidianmd/ui` *parent* and gitignore cannot
  // re-include a child of an excluded directory — so a bare
  // `!obsidianmd/ui/sentence-case` is inert. Re-include the `ui` dir, re-exclude
  // its rules, then re-include only sentence-case; every other obsidianmd/ui/*
  // rule (sentence-case-json, sentence-case-locale-module, …) stays restricted.
  "!obsidianmd/ui",
  "obsidianmd/ui/*",
  "!obsidianmd/ui/sentence-case",
];

// The obsidian package tsconfig the type-aware parser loads (it is the global
// `**/*.ts` block's `project`). dnd5e is now an external repo, so its tsconfigs
// no longer participate in the plugin's lint.
const tsconfigProjects = [
  "./packages/obsidian/tsconfig.json",
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
      parserOptions: {
        project: tsconfigProjects,
      },
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
