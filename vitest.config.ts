import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Budget policy, derived 2026-07-28 on an 8-core machine (R4-P2a). The
    // post-split and contended figures below were MEASURED in task 5
    // (2026-07-29) and are recorded run by run in
    // .superpowers/sdd/2026-07-28-r4-p2a-gate-and-harness-reliability/task-5-report.md
    //
    // vitest defaults are testTimeout 5000 / hookTimeout 10000. Nothing in this
    // repo is protected by 5000: the slowest test is the SRD monster corpus
    // equivalence check (tests/dnd5e/monster-render-equivalence.test.ts).
    // Pre-split it measured 1538 ms and 2510 ms across two unloaded full-suite
    // runs (the spec's own estimate was 1272 ms full-suite, 1456 ms in a
    // tests/dnd5e-only run). After that file was split per edition, three
    // unloaded full-suite runs put its worst half (SRD 5e) at 1250, 1664 and
    // 1718 ms, and the runner-up in the whole repo is monster-roundtrip at 319
    // to 387 ms. An earlier draft of this comment carried the spec's ESTIMATE
    // of "about 735 ms" for the post-split worst case; that estimate predates
    // the split and is superseded by the measured 1718 ms.
    //
    // The 5000 ms default has caught zero real hangs here and produced at
    // least three false reds: under real contention (two agent sessions running
    // suites at once) the machine amplified 1272 ms to 6708 ms, a factor of 5.3.
    // Task 5's tracked reproducer (scripts/contend.sh: 2 concurrent suites plus
    // 16 niced burners on 8 cores) independently inflated the post-split worst
    // half to 6867 ms and 7780 ms, a factor of 4.0 to 4.5, and both of those
    // runs stayed GREEN at 20000.
    //
    // 20000 therefore gives about 8x headroom over the worst measured unloaded
    // pre-split value, about 11.6x over the measured post-split one, and still
    // about 2.6x over the worst value ever observed under deliberate
    // saturation. hookTimeout is pinned to the same value not because any hook
    // needs it, but so the policy cannot change silently under a vitest upgrade
    // and so moving expensive setup into beforeAll does not land on a
    // different, invisible budget. slowTestThreshold stays at its 300 ms
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
