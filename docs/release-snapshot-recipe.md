# Public snapshot & release recipe

The plugin ships two lineages:

- **dev `main`** — private full history; `packages/obsidian` consumes `@archivist-gg/{core,dnd5e}` as local `file:`
  siblings; the local `npm run build` is byte-stable. NEVER pushed (no own remote).
- **`release/public-snapshot`** — the PUBLIC repo's `main` (`origin/main`); a single curated commit whose
  `packages/obsidian` consumes the packages from the **npm registry** (`^0.1.0`), with a registry-resolved lockfile so
  a fresh clone / CI can build.

## Deriving a new public snapshot

1. Start from the current `release/public-snapshot` (already curated/scrubbed — no `docs/superpowers`, `.claude/memory`,
   `.superpowers`, `.worktrees`).
2. Bring the dev-`main` source content forward (rename/scope/source changes) as needed.
3. **Re-point + version + lock — run the recipe in an ISOLATED checkout (no `@archivist-gg/*` symlinks in
   `node_modules`):**
   `node scripts/snapshot-repoint.mjs` — rewrites `packages/obsidian` deps `file:`→`^0.1.0`, bumps
   `manifest.json`/root `package.json`/`versions.json`, prunes the stale core/dnd5e lock entries, and runs
   `npm install --package-lock-only` (registry-resolved lock; frozen `obsidian`/`@codemirror` pins preserved).
   Copy the regenerated `package-lock.json` back into the snapshot tree.
4. **Verify (before pushing):** in a fresh no-sibling clone under node 20, `npm ci && npm run build` must succeed and
   produce a functional `main.js`; deploy to the vault and verify a PC sheet renders.
5. **Publish:** FF-push the snapshot to `origin/main`, then push the tag `X.Y.Z` (== `manifest.json.version`, no `v`
   prefix). CI (`.github/workflows/release.yml`) runs `npm ci && npm run build` on node 20 and creates a **published**
   GitHub release (prerelease tags — any `-` — are marked `--prerelease`).

## Version policy

`@archivist-gg/{core,dnd5e}` are versioned/published in lockstep; the recipe hardcodes `^0.1.0` — bump the constants in
`snapshot-repoint.mjs` deliberately when the packages' minor changes.

## Recovery

A published version cannot be un-shipped (BRAT auto-pulls). If a release is broken, **forward-fix**: cut the next patch.
