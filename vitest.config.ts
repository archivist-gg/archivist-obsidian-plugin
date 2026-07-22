import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
    // Stale git worktrees (e.g. .worktrees/phase0) carry their own duplicate
    // test trees; without this, vitest discovers them and double-runs / pollutes
    // the suite. They have their own package.json + vitest config and are run
    // from within their own checkout, never from the root.
    // scratchpad/ holds throwaway probe/migration scripts (some are node:test,
    // not vitest) — never part of the suite.
    exclude: [...configDefaults.exclude, "**/.worktrees/**", "**/scratchpad/**"],
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts"),
      "@core": path.resolve(__dirname, "../archivist-core/src"),
      "@": path.resolve(__dirname, "packages/obsidian/src"),
    },
  },
  assetsInclude: ["**/*.md"],
});
