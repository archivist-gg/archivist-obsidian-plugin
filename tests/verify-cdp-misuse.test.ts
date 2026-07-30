import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// These guard scripts/verify/cdp-verify.mjs, which NOTHING else checks: eslint
// ignores scripts/**, typecheck is project-references only, and vitest never
// reaches it. This file is the only durable automated protection on it.
//
// Resolved from import.meta.url, not process.cwd(), so the test is invariant to
// the directory vitest happens to be invoked from.
const SCRIPT = fileURLToPath(new URL("../scripts/verify/cdp-verify.mjs", import.meta.url));

// The three misuse diagnostics the driver can emit before it connects. Asserted
// POSITIVELY in the misuse tests and NEGATIVELY in the positive control, so a
// guard that fired unconditionally could not pass all three tests at once.
const MISUSE_NO_VALUE = "requires a value";
const MISUSE_NO_WITHIN = "requires --within";
const MISUSE_UNKNOWN_KEY = "is not a known key";

// Isolation, and it is not theoretical. `--port 1` is refused instantly by the
// kernel, so any invocation that gets past the guards fails to connect instead
// of reaching a real Obsidian. Without it PORT falls back to 9222 and a run
// would reload the plugin in the developer's LIVE vault from inside the suite.
// Test 3 below deliberately reaches the fetch, so for that case this is the
// only thing standing between the suite and the live vault. `--vault` is
// bogus for the same reason, as a second layer.
//
// Two live-vault incidents have already happened in this phase, one from
// omitting --port and one from passing it through an unquoted zsh expansion:
// zsh does not word-split, so the whole string arrived as ONE argv token,
// indexOf('--port') returned -1, and the fallback to 9222 connected. spawnSync
// with an argv ARRAY and no shell is immune to that by construction, which is
// half the reason it is used here rather than a shell string.
const ISOLATION = ["--port", "1", "--vault", "__NO_SUCH_VAULT__"];

// spawnSync, NOT execFileSync: execFileSync THROWS on a non-zero exit, so every
// call would need a try/catch just to read the exit code the assertions are about.
const run = (args: string[]) =>
  spawnSync(process.execPath, [SCRIPT, ...args, ...ISOLATION], { encoding: "utf8" });

describe("cdp-verify misuse guards", () => {
  // Both guards sit above the driver's first fetch, so these two need no
  // Obsidian running.
  //
  // NOTE on what carries the signal here: exit 2 is shared by at least four
  // sites in the driver (step-verb misuse, em-dash misuse, no CDP endpoint,
  // wrong vault), so `status === 2` alone would pass against a driver with no
  // guard at all, via the cannot-connect path. The stderr assertion is what
  // discriminates. Do not drop it.
  it("exits 2 when no-emdash-strict is used without --within", () => {
    const r = run(["--assert-text", "no-emdash-strict"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(MISUSE_NO_WITHIN);
  });

  it("exits 2 when --press-key is given no value", () => {
    const r = run(["--press-key"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(MISUSE_NO_VALUE);
  });

  // Positive control. Without it, a guard that fired on the mere PRESENCE of a
  // step verb, rather than on an invalid value, would pass both tests above and
  // break every real invocation. This asserts the complement: well-formed step
  // verbs WITH values must reach the fetch, which then fails to connect on port
  // 1. The connect failure is the expected outcome here, not an error.
  it("does not trip any misuse guard on well-formed step verbs", () => {
    const r = run(["--press-key", "Escape", "--expect", ".modal", "--wait", "100", "--shot", "after"]);
    expect(r.stderr).not.toContain(MISUSE_NO_VALUE);
    expect(r.stderr).not.toContain(MISUSE_NO_WITHIN);
    expect(r.stderr).not.toContain(MISUSE_UNKNOWN_KEY);
    expect(r.stderr).toContain("no CDP endpoint");
  });
});
