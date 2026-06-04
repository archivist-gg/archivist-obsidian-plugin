import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    setupFiles: [path.resolve(__dirname, "tests/setup.ts")],
    // Stale git worktrees (e.g. .worktrees/phase0) carry their own duplicate
    // test trees; without this, vitest discovers them and double-runs / pollutes
    // the suite. They have their own package.json + vitest config and are run
    // from within their own checkout, never from the root.
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
  resolve: {
    alias: {
      obsidian: path.resolve(__dirname, "tests/__mocks__/obsidian.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  assetsInclude: ["**/*.md"],
});
