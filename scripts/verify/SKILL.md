---
name: verify-in-vault
description: Use when an archivist-obsidian plugin change needs end-to-end verification in the live Obsidian vault, after deploying main.js, before declaring UI/render work done, or whenever the next step would otherwise be "deployed, awaiting in-app verify".
---

# Verify in Vault (Archivist plugin, live Obsidian)

## Overview

Never report a plugin change as done on a green test suite alone: drive the LIVE Obsidian and observe the render. The bundled `cdp-verify.mjs` connects to Obsidian over CDP (zero dependencies, Node >= 22), reloads the plugin so the deployed `main.js` is actually live, opens a real note in reading view, waits for the rendered block, screenshots the window, and fails on any console error or uncaught exception captured while doing so.

Beyond that baseline it can drive PC-sheet tabs, sweep the sheet across widths, and detect horizontal overflow / element overlap, so responsive breakage is caught before the work is called done.

## MANDATORY flow for PC-sheet UI work

Any change that touches the PC character sheet UI MUST, before it is declared done, be verified with ALL FIVE of:

1. **A responsive width sweep** across at least 3 named widths including a step below the 499px breakpoint: `--widths 1200,768,400`. The tool measures `.pc-content` clientWidth at each width and FAILS the sweep as vacuous if the narrow step never drops below 499px (meaning the responsive rules were never exercised).
2. **The overlap + horizontal-overflow check** at every swept width: `--check-overflow --check-overlap`.
3. **At least one functional assertion** that the feature is actually present: `--assert-selector <sel>` and/or `--assert-text <text>`.
4. **EVERY tab the sheet exposes for that PC, not just the two the sweep defaults to.** With no `--tab`, the sweep drives ONLY Actions + Passive & Features. The sheet also has `panel-spells`, `panel-inventory`, and dynamic pool tabs (`panel-pool-<id>`, e.g. `panel-pool-interdict-boons` on the Illrigger PC). Drive the rest with additional runs: `--tab spells`, `--tab inventory`, `--tab pool-interdict-boons` (any `X` maps to `panel-X`). A tab your change "shouldn't affect" still gets at least one look — shared CSS/rows leak across tabs.
5. **Scroll through everything that scrolls.** The screenshot captures ONLY the visible fold, and `--assert-text` reads VISIBLE text only (hidden/below-fold content false-negatives — proven in live testing). If the sheet content scrolls at any swept size (and at narrow widths it always does), you MUST scroll through the FULL content and capture/inspect each viewport-full, top to bottom. **Tool gap:** cdp-verify.mjs has no scroll-capture flag yet — drive it manually over CDP (`Runtime.evaluate` stepping the scroll container's `scrollTop` by clientHeight + `Page.captureScreenshot` per step), or extend the tool. Do NOT skip this because the tool lacks the flag.

**Do NOT vary viewport heights / aspect ratios** — user directive 2026-07-21: height/short-viewport passes are NOT part of the flow (widths + full scrolling + every tab + expanded states cover it). Do not resurrect a `--heights` step.

Additionally, when the change touches rows/expandable content: **expand at least one row per affected section type** before asserting/screenshotting (collapsed-state-only verification has missed expanded-state breakage before).

One invocation covers items 1-3 (plus the two default tabs of item 4):

```
node <skill-dir>/cdp-verify.mjs --vault DnD --note "PlayerCharacters/Test.md" \
  --widths 1200,768,400 --check-overflow --check-overlap \
  --assert-selector ".pc-weapon-mastery"
```

Exit 0 means: sheet rendered, zero console errors, the sweep narrowed below 499px and found no overflow / overlap, and every assertion held. Exit 1 means one of those failed. Read the printed screenshots (one per width per tab) and confirm the layout visually. Then cover items 4-5 with the extra `--tab` runs and the manual full-content scroll passes — they are not optional, and "the tool doesn't do it" is not a waiver.

Before trusting the detector on real work, prove it fires at least once with `--self-test`.

## Steps

All paths relative to this skill's base directory.

1. **Deploy first** if verifying new code (skip when verifying what is already deployed):
   `/Users/shinoobi/w/archivist-obsidian/.superpowers/bin/deploy-vault.sh`
2. **Ensure the CDP port**: `<skill-dir>/obsidian-debug.sh 9222` (no-op if already open; otherwise quits and relaunches Obsidian with `--remote-debugging-port`, it autosaves and the workspace restores).
3. **Verify**: run `cdp-verify.mjs` with the flags the change needs (see below). The live vault IS `DnD` (`/Users/shinoobi/Obsidian/DnD`), that is a fact of this setup, not an example. Pick a `--note` you know contains the target block type.
4. **Read the screenshots it prints** with the Read tool and confirm the render visually. A selector can exist while the layout is broken, and the screenshot is the evidence. Screenshots land in `archivist-obsidian/.superpowers/verify/`.
5. Exit 0 = verified. Exit 1 = failed (fix and re-run from step 1; do not hand back partially verified work). Exit 2 = connection, wrong-vault, or misuse problem (fix the environment or the flags, then re-run step 3; the code is not implicated).

Test PC notes: Baelor (Illrigger/Hellspeaker Kalashtar) `PlayerCharacters/Test.md`; Gareth (SRD-2024 Fighter L1) `PlayerCharacters/Gareth the Bold.md`.

Other block types: pass `--selector .archivist-monster-block` / `.archivist-item-block` / `.archivist-spell-block` / `.archivist-class-block` and a `--note` that contains that block.

## Flags

Default (retained): `--port 9222`, `--vault DnD`, `--note <path>`, `--plugin archivist-gg`, `--selector .archivist-pc-sheet`, `--out DIR`, `--no-reload`, `--timeout 15000`. With none of the flags below, behavior is identical to the original single-run verify.

| Flag | What it does | Example |
|---|---|---|
| `--tab actions\|passive` | Clicks that PC tab (`button.pc-tab-btn[data-tab="panel-actions"\|"panel-passive"]`) before asserting / screenshotting. | `--tab passive` |
| `--widths 1200,768,400` | Responsive sweep: per width, collapses both sidebars and narrows the active workspace leaf, measures `.pc-content` clientWidth, screenshots (one file per width per tab). Fails (vacuous) if the narrow step does not drop below 499px. | `--widths 1200,768,400` |
| `--check-overflow` | Fails on horizontal overflow (`scrollWidth > clientWidth`) on `.pc-content`, reporting the culprit element. | `--check-overflow` |
| `--check-overlap` | Fails on bounding-box overlap of in-flow sibling rows / cells. | `--check-overlap` |
| `--assert-selector <sel>` | Fails unless at least one element matches `<sel>`. | `--assert-selector ".pc-weapon-mastery"` |
| `--assert-text <text>` | Fails unless rendered text matches. Modes: plain substring, `/regex/flags`, or the keyword `no-emdash`. | `--assert-text "Second Wind"` |
| `--assert-text no-emdash` | Flags any em-dash char (`U+2014`) or `&mdash;` entity. REQUIRES `--within` (see caveat). | `--assert-text no-emdash --within ".pc-weapon-mastery"` |
| `--within <sel>` | Scopes `--assert-text` (and required for `no-emdash`) to a subtree. | `--within "#panel-passive"` |
| `--self-test` | Injects a known-overflowing and a known-good fixture, asserts the detector fires on the bad one and stays clean on the good one, then cleans up. Exits non-zero if the detector misses. Run it to trust the detector before gating real work. | `--self-test` |

## Container-query caveat (read before sweeping)

The PC sheet is **container-query** responsive: its breakpoints (including the 499px narrow tier) fire off the width of the Obsidian pane / leaf that holds the sheet (`@container` on `.pc-content` and the outer `.archivist-pc-sheet`), NOT the device viewport. `Emulation.setDeviceMetricsOverride` alone will not narrow the sheet if the sidebars pin the pane. The sweep therefore collapses `leftSplit` + `rightSplit` and constrains the active `.workspace-leaf.mod-active` width directly (falling back to the sheet element if the leaf will not narrow), then measures `.pc-content` clientWidth to prove the narrow tier was actually reached (below 499px). If it was not, the sweep is reported as VACUOUS and fails, because the responsive rules were never exercised. The sweep restores the pane and sidebars when it finishes.

## no-emdash is scoped on purpose

`no-emdash` never runs sheet-wide: it requires `--within <selector>` and exits 2 without it. The sheet legitimately renders em dashes (`U+2014`) in several pre-existing spots (weapon `formatDamage` emits U+2014 for zero-dice weapons; HP / proficiency placeholders; prose descriptions), so a whole-sheet scan would false-fail. Point it at the specific subtree your change owns, e.g. `--within ".pc-weapon-mastery"`.

## Gotchas (hit in live testing)

- **Multiple vault windows can be open at once** (an old "V" vault window has coexisted with "DnD"). The script picks the window by vault name and aborts on mismatch: never drop `--vault`, and do not "fix" a wrong-vault abort by removing the check; close the stray window or name the right vault.
- The verdict counts console **errors** and exceptions; warnings are reported in the JSON but non-fatal.
- The reload step disables + enables the plugin in the target vault only. If verification is interrupted mid-run, re-running it is safe and idempotent.
- A horizontal overflow at the 400px step on the Actions tab (weapon-damage cell) is a KNOWN pre-existing baseline on the current build: the tool correctly reports it (exit 1). When you see it, confirm it is the baseline and not a regression your change introduced, rather than silently passing it.

## Common mistakes

| Mistake | Reality |
|---|---|
| "npm run check is green, so it works" | The suite passed while the in-vault render was never looked at, which is the exact gap this skill closes |
| Trusting `selectorCount > 0` without viewing the screenshot | The block can mount and still render wrong; the screenshot is the evidence |
| Verifying before deploying | You verified the OLD bundle; deploy, then verify |
| Declaring PC-sheet UI done without a width sweep | Responsive breakage below 499px is invisible at desktop width; sweep with `--widths 1200,768,400` |
| Sweeping only the two default tabs | Spells, Inventory, and pool tabs (`--tab spells` / `inventory` / `pool-<id>`) render shared rows/CSS too; drive every tab the PC exposes |
| Screenshotting only the top fold | Below-fold content is invisible in the shot and to `--assert-text`; scroll through the FULL content and capture each viewport-full |
| Asserting on collapsed rows only | Expanded-state breakage is invisible; expand at least one row per affected section before asserting |
| Running `no-emdash` sheet-wide | Pre-existing benign dashes false-fail it; always `--within` the subtree you changed |
