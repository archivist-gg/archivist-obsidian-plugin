import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import comments from "@eslint-community/eslint-plugin-eslint-comments";
import importPlugin from "eslint-plugin-import";

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

// The five package tsconfigs the type-aware parser already loads. Reused by the
// import/no-restricted-paths TS resolver so it can follow the `@archivist/*`
// package `exports` subpaths (the node resolver cannot, which would let the
// dependency-arrow rule silently under-enforce).
const tsconfigProjects = [
  "./packages/core/tsconfig.json",
  "./packages/dnd5e/tsconfig.json",
  "./packages/dnd5e/tsconfig.tools.json",
  "./packages/generators/tsconfig.json",
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
  // Enforce the layered dependency arrows (core ← dnd5e ← generators). obsidian
  // may import any package, so it has no zone and is intentionally OUTSIDE this
  // block's scope: the TS `import/resolver` lives here too (it is a global
  // `settings` key shared by every eslint-plugin-import rule), and scoping it to
  // the three layered packages keeps obsidian's `import/no-extraneous-dependencies`
  // behaviour exactly as it was before the resolver existed. `packages/dnd5e/**`
  // also covers dnd5e/tools/**. The parser/project come from the `**/*.ts` block
  // above (flat config merges languageOptions across matching blocks).
  {
    files: [
      "packages/core/**/*.ts",
      "packages/dnd5e/**/*.ts",
      "packages/generators/**/*.ts",
    ],
    plugins: {
      // obsidianmd's recommended config already registers `import` (its copy
      // resolves to this same module instance), so re-registering with the same
      // object is a no-op for flat config rather than a "Cannot redefine plugin"
      // error. Registering it here keeps the dependency-arrow rule self-contained.
      import: importPlugin,
    },
    settings: {
      // The TS resolver follows `@archivist/*` package exports/subpaths so
      // import/no-restricted-paths can tell which package an import targets.
      "import/resolver": {
        typescript: {
          project: tsconfigProjects,
          // Five project tsconfigs is intentional (one per package); silence the
          // resolver's perf hint about consolidating into a single tsconfig.
          noWarnOnMultipleProjects: true,
        },
      },
    },
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./packages/core",
              from: "./packages",
              except: ["./core"],
              message: "core must not import other @archivist packages",
            },
            {
              target: "./packages/dnd5e",
              from: "./packages",
              except: ["./dnd5e", "./core"],
              message: "dnd5e may import only @archivist/core",
            },
            {
              target: "./packages/generators",
              from: "./packages",
              except: ["./generators", "./core", "./dnd5e"],
              message: "generators may import only core + dnd5e",
            },
          ],
        },
      ],
    },
  },
  // Dev CLI tools: progress logging to stdout/stderr is intended behaviour, so
  // narrow the no-console rule here rather than littering the code with
  // forbidden eslint-disable comments. `no-console` remains enforced
  // everywhere else (in obsidianmd's recommended config it is implemented via
  // `obsidianmd/rule-custom-message`, which wraps `no-console`).
  // Node-side rules (fetch, popout-window document reference, etc.) target
  // the Obsidian plugin runtime and do not apply to Node CLI tools that run
  // outside Obsidian.
  {
    files: ["packages/dnd5e/tools/**/*.ts"],
    rules: {
      "no-console": "off",
      "obsidianmd/rule-custom-message": "off",
      "obsidianmd/prefer-active-doc": "off",
      "no-restricted-globals": "off",
    },
  },
]);
