import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Budget policy, derived 2026-07-28 on an 8-core machine (R4-P2a).
    //
    // vitest defaults are testTimeout 5000 / hookTimeout 10000. Nothing in this
    // repo is protected by 5000: the slowest test is the SRD monster corpus
    // equivalence check (tests/dnd5e/monster-render-equivalence.test.ts),
    // measured at 1272 ms in full-suite context and 1456 ms in a
    // tests/dnd5e-only run. After that file was split per edition its worst
    // half is about 735 ms, and the runner-up in the whole repo is
    // monster-roundtrip at about 158 ms.
    //
    // The 5000 ms default has caught zero real hangs here and produced at
    // least three false reds: under real contention (two agent sessions running
    // suites at once) the machine amplified 1272 ms to 6708 ms, a factor of 5.3.
    //
    // 20000 gives 13.7x headroom over the pre-split worst case and about 27x
    // over the post-split one, absorbing roughly 2.6x worse contention than has
    // ever been observed. hookTimeout is pinned to the same value not because
    // any hook needs it, but so the policy cannot change silently under a
    // vitest upgrade and so moving expensive setup into beforeAll does not land
    // on a different, invisible budget. slowTestThreshold stays at its 300 ms
    // default so creep stays visible in every run.
    //
    // RULE: if any test ever exceeds about 2000 ms unloaded, re-derive this
    // number from measurement rather than raising it reflexively.
    testTimeout: 20000,
    hookTimeout: 20000,
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
