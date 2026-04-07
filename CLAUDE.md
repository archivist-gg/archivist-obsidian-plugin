# Archivist TTRPG Blocks — Obsidian Plugin

An Obsidian plugin for D&D 5e content: monster stat blocks, spells, magic items, inline dice tags, entity registry (SRD + custom), and an AI chat engine (Claudian/Inquiry). Users write YAML inside fenced code blocks (` ```monster `, ` ```spell `, ` ```item `) and the plugin renders them as styled parchment stat blocks.

## Build & Deploy

```bash
npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/
```

Always deploy after building. The plugin name in Obsidian is `archivist`.

## Architecture

**Parser -> Type -> Renderer pipeline:**
- `src/parsers/` — Parse YAML into typed interfaces (`monster-parser.ts`, `spell-parser.ts`, `item-parser.ts`, `inline-tag-parser.ts`)
- `src/types/` — TypeScript interfaces (`monster.ts`, `spell.ts`, `item.ts`, `settings.ts`)
- `src/renderers/` — Turn typed data into DOM elements (`monster-renderer.ts`, `spell-renderer.ts`, `item-renderer.ts`, `renderer-utils.ts`)
- `src/main.ts` — Plugin entry point, wires parsers/renderers into Obsidian's `registerMarkdownCodeBlockProcessor`
- `src/dnd/` — D&D 5e math engine (constants, pure math functions, recalculation orchestrator)
- `src/edit/` — Edit mode controllers and UI rendering
- `src/extensions/` — CodeMirror 6 editor extensions (inline tags, block delete, entity suggest)
- `src/entities/` — Entity registry, vault storage, SRD importer
- `src/inquiry/` — Claudian AI chat engine
- `src/styles/archivist-dnd.css` — Main stat block CSS
- `src/styles/archivist-edit.css` — Edit mode CSS

## Testing

Uses **Vitest**. Tests in `tests/` directory.

```bash
npx vitest run                          # all tests
npx vitest run tests/dnd-math.test.ts   # single file
```

## Design System

- **No emojis anywhere** in UI or rendered output. Use Lucide icons via Obsidian's `setIcon()`.
- **Parchment theme:** `#fdf1dc` background, `#922610` crimson accent, `#d9c484` tan borders, `#7a200d` text accent.
- **Dashed borders** (`1px dashed #d9c484`) signal editability. Focus changes to solid `#922610`.
- **Custom spinners** on all number inputs (triangle up/down buttons). Never use browser native number arrows.
- **Side button stack** (right side of stat blocks): 28x28px squares, 4px gap.
  - Monster blocks: `</>` (source) -> Columns toggle -> Edit -> Trash
  - Spell/Item blocks: `</>` (source) -> Trash
- **Two-column monster blocks** must use `width: calc(100% - 80px)` to match spell/item block width.
- **Traits section** renders WITHOUT a header in two-column mode (PHB-style, inline). Other sections (Actions, Reactions, Legendary) get `.actions-header` titles.

## Design Docs

- Specs: `docs/superpowers/specs/`
- Plans: `docs/superpowers/plans/`
- Visual mockups: `.superpowers/brainstorm/*/content/`
- Key mockups:
  - Edit mode: `.superpowers/brainstorm/57430-1774976982/content/edit-mode-v8.html`
  - Multi-column: `.superpowers/brainstorm/57430-1774976982/content/multi-column-v2.html`

## Visual Companion (Brainstorming Tool)

Browser-based tool for showing mockups, diagrams, and visual options during brainstorming sessions. The skill guide is at the superpowers plugin cache: `skills/brainstorming/visual-companion.md`.

**Starting the server:**
```bash
bash /Users/shinoobi/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/scripts/start-server.sh --project-dir /Users/shinoobi/w/archivist-obsidian
```
Returns JSON with `screen_dir`, `state_dir`, `url`. Tell user to open the URL.

**Key rules:**
- Write HTML **content fragments** (no `<!DOCTYPE>` / `<html>`) to `screen_dir` using the Write tool. Server wraps in frame template automatically.
- **Never reuse filenames** — each screen gets a fresh file with semantic name (`layout.html`, `edit-mode.html`, iterations as `layout-v2.html`).
- Never use cat/heredoc to write files — always use the Write tool.
- Check `$STATE_DIR/server-info` exists before each write (server auto-exits after 30min idle).
- Read `$STATE_DIR/events` after user responds to get browser click interactions.
- Push a waiting screen when returning to terminal-only questions.
- Existing mockups persist in `.superpowers/brainstorm/` for reference.
- Full HTML docs (starting with `<!DOCTYPE`) are served as-is (no frame wrapping).

**Available CSS classes in fragments:** `.options` + `.option` (A/B/C choices), `.cards` + `.card` (visual designs), `.mockup` (preview container), `.split` (side-by-side), `.pros-cons`, mock elements (`.mock-nav`, `.mock-sidebar`, `.mock-content`, `.mock-button`, `.mock-input`).

## GitHub

- Always use the **GitHub CLI** (`gh`) for all GitHub-related tasks: PRs, issues, checks, releases, repo info, etc. Never use the GitHub web API directly or construct URLs manually.

## Subagent Rules

- Always use **Opus** model for all subagents. Never downgrade to Sonnet or Haiku.

---

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **archivist-obsidian** (4796 symbols, 16485 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/archivist-obsidian/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/archivist-obsidian/context` | Codebase overview, check index freshness |
| `gitnexus://repo/archivist-obsidian/clusters` | All functional areas |
| `gitnexus://repo/archivist-obsidian/processes` | All execution flows |
| `gitnexus://repo/archivist-obsidian/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
