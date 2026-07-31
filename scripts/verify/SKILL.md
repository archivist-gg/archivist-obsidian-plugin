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
4. **EVERY tab the sheet exposes for that PC, not just the two the sweep defaults to.** With no `--tab`, the sweep drives ONLY Actions + Passive & Features. The sheet also has `panel-spells`, `panel-inventory`, and dynamic pool tabs (`panel-pool-<id>`, built as `panel-pool-${decl.id}` in `tabs-container.ts`). On the Illrigger test PC the pool decl id is `boons`, so the real panel is **`panel-pool-boons`**, driven as **`--tab pool-boons`**. Drive the rest with additional runs: `--tab spells`, `--tab inventory`, `--tab pool-boons` (any `X` maps to `panel-X`). A tab your change "shouldn't affect" still gets at least one look: shared CSS/rows leak across tabs. **A `--tab` that does not activate now FAILS the run** (exit 1). It used to pass vacuously, which is how the stale `--tab pool-interdict-boons` command this file used to print stayed green while driving no tab at all.
5. **Scroll through everything that scrolls.** The reason is the SCREENSHOT, which captures only the visible fold. It is NOT `--assert-text`: that reads `innerText`, and `innerText` under a rendered root **includes text below the fold**. Measured live on the sheet with `scrollTop` still `0` and the fold bottom at `y=800`: of the 35 rendered leaf text nodes below it carrying 12 or more characters, the deepest sat at **`y=2022`** and its text was present in `innerText`. (The count moves with how you filter; the presence does not.) Do not reach for a scroll pass to make a text assertion work; reach for it because only your eyes on each viewport-full can catch layout breakage. If the sheet content scrolls at any swept size (and at narrow widths it always does), you MUST scroll through the FULL content and capture/inspect each viewport-full, top to bottom. Use **`--scroll-capture`**: it steps the view's scroll container by one `clientHeight` at a time, screenshots each viewport-full, then restores `scrollTop`. It FAILS the run if the container matches nothing, if the container cannot scroll, if the capture produced fewer than TWO shots, if it hits the 20-step cap without ever reaching the bottom, or if `scrollTop` does not come back to where it started. **A single-shot run is never a pass**, because the tool cannot distinguish "there was nothing to scroll" from "I resolved the wrong element". It runs ONCE, at natural width, AFTER any `--widths` sweep has restored the pane, because its filenames carry no width or tab label and a per-pair run would overwrite its own evidence. The requirement is the scrolling, not the flag: cover the full content either way.

**Do NOT vary viewport heights / aspect ratios** · user directive 2026-07-21: height/short-viewport passes are NOT part of the flow (widths + full scrolling + every tab + expanded states cover it). Do not resurrect a `--heights` step.

Additionally, when the change touches rows/expandable content: **expand at least one row per affected section type** before asserting/screenshotting (collapsed-state-only verification has missed expanded-state breakage before).

One invocation covers items 1-3 (plus the two default tabs of item 4):

```
node <skill-dir>/cdp-verify.mjs --vault DnD --note "PlayerCharacters/Test.md" \
  --widths 1200,768,400 --check-overflow --check-overlap \
  --assert-selector ".pc-weapon-mastery"
```

Exit 0 means: sheet rendered, zero console errors, the sweep narrowed below 499px and found no overflow / overlap, every requested tab actually activated, and every assertion held. Exit 1 means one of those failed. Read the printed screenshots (one per width per tab) and confirm the layout visually. Then cover items 4-5 with the extra `--tab` runs and a `--scroll-capture` pass: they are not optional.

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

Default (retained): `--port 9222`, `--vault DnD`, `--note <path>`, `--plugin archivist-gg`, `--selector .archivist-pc-sheet`, `--out DIR`, `--no-reload`, `--timeout 15000`. With none of the flags below, a run still does what the original single-run verify did. It is NOT true that every prior invocation is unchanged: see "Behavior changes" under the table before you reuse an old command line.

| Flag | What it does | Example |
|---|---|---|
| `--tab actions\|passive` | Clicks that PC tab (`button.pc-tab-btn[data-tab="panel-actions"\|"panel-passive"]`) before asserting / screenshotting. | `--tab passive` |
| `--widths 1200,768,400` | Responsive sweep: per width, collapses both sidebars and narrows the active workspace leaf, measures `.pc-content` clientWidth, screenshots (one file per width per tab). Fails (vacuous) if the narrow step does not drop below 499px. | `--widths 1200,768,400` |
| `--check-overflow` | Fails on horizontal overflow (`scrollWidth > clientWidth`) on the check root, reporting the culprit element. | `--check-overflow` |
| `--check-overlap` | Fails on bounding-box overlap of in-flow sibling rows / cells under the check root. | `--check-overlap` |
| `--check-root <sel>` | Root for the two detectors above. Default `.pc-content`. A root matching no element now FAILS loudly (`ROOT NOT FOUND`) instead of passing vacuously. **This is a THIRD root flag beside `--selector` (what must render) and `--within` (what `--assert-text` scans); the three are independent.** The `--widths` breakpoint measurement stays pinned to `.pc-content` regardless, because the 499px breakpoint is PC-sheet-specific. | `--check-root ".archivist-monster-block"` |
| `--assert-selector <sel>` | Fails unless at least one element matches `<sel>`. | `--assert-selector ".pc-weapon-mastery"` |
| `--assert-text <text>` | Fails unless rendered text matches. Modes: plain substring, `/regex/flags`, or the literal keywords `no-emdash` / `no-emdash-strict`. | `--assert-text "Second Wind"` |
| `--assert-text no-emdash` | Flags the em-dash char `U+2014` in the `innerText` reading, which is **not** a synonym for "what the user can see" (it includes below-fold text, and a whole hidden panel; see "no-emdash is scoped on purpose"). It does NOT look for a `&mdash;` entity, and such a check could never have fired: the HTML fragment serializer escapes only `&`, `<`, `>` and NBSP in text nodes (plus `"` in attributes), so that string is never produced. Both modes report BOTH signals (`inVisible` from `innerText`, `inHtml` from `innerHTML`); only the verdict differs. REQUIRES `--within` (see caveat). | `--assert-text no-emdash --within ".pc-weapon-mastery"` |
| `--assert-text no-emdash-strict` | Same scan, but the verdict keys to `innerHTML`, so **attribute values and markup** are included too. Hidden panels are NOT the reason to reach for it: the default mode already scans those in full (see below). Also REQUIRES `--within`. | `--assert-text no-emdash-strict --within "#panel-passive"` |
| `--within <sel>` | Scopes `--assert-text` (and required for both `no-emdash` modes) to a subtree. Scoping a default `no-emdash` to an INACTIVE panel is OVER-BROAD, not vacuous: it reads more than the user can see (see below). | `--within ".pc-weapon-mastery"` |
| `--cdp-timeout <ms>` | Per-CDP-message reply budget, default 60000. Deliberately NOT derived from `--timeout`, which is and stays the selector poll budget. Raise it if the plugin reload or a screenshot legitimately runs long. | `--cdp-timeout 90000` |
| `--click <sel>` · `--press-key Escape\|Enter\|Tab` · `--wait <ms>` · `--expect <sel>` · `--expect-absent <sel>` · `--shot <label>` | Ordered step verbs, collected by a walk over argv (so they may REPEAT and run in the order written) and run after the `--tab` click and before the screenshot. `--expect-absent` is the negative form `--assert-selector` lacks, so "Escape closes the modal" is expressible. Keys go out as TRUSTED `Input.dispatchKeyEvent` events, because an untrusted `dispatchEvent` does not drive Obsidian's Keymap. Steps MUST be self-reverting: nothing left open, no note written. Declaring steps that never execute fails the run. | `--click ".pc-currency-clickable" --expect ".pc-coin-modal" --press-key Escape --expect-absent ".pc-coin-modal"` |
| `--scroll-capture [sel]` | Screenshots each viewport-full of the scroll container (stopping at the bottom, or at a 20-step runaway cap), then restores `scrollTop`. NOT `.pc-content`, which carries no `overflow-y`. **With no selector, resolution is LEAF-SCOPED**: it searches only inside the `.workspace-leaf` holding `--selector` (falling back to `.workspace-leaf.mod-active`), trying `.markdown-preview-view`, `.cm-scroller`, `.view-content`, and the first that actually scrolls wins. With a selector, resolution is the plain document-global `querySelector`, first match. FAILS the run on: a container matching nothing, a container that cannot scroll, fewer than TWO shots, a capture cut off by the 20-step cap with the bottom never reached, or a `scrollTop` left unrestored. Runs ONCE, at natural width, after any `--widths` sweep has restored the pane. | `--scroll-capture` |
| `--self-test` | Injects a known-overflowing and a known-good fixture, asserts the detector fires on the bad one and stays clean on the good one, then cleans up. Exits non-zero if the detector misses. Run it to trust the detector before gating real work. | `--self-test` |

### Behavior changes (R4-P2b) that can turn an old green command red

These are real verdict changes, not additions. If a command you have run before starts failing, check here first.

- **A check root that matches no element now FAILS** (`ROOT NOT FOUND`, exit 1). Previously the detectors returned "no overflow / no overlaps" for a missing root and the run passed having checked nothing.
- **A `--tab` that does not activate now FAILS** (exit 1). Previously a typo'd or renamed panel id was silently ignored and the run screenshotted whatever tab happened to be open.
- **`--scroll-capture` with no selector now resolves INSIDE the leaf under test, and a single-shot capture now FAILS** (exit 1). Previously it resolved `.markdown-preview-view` / `.cm-scroller` document-globally. A custom `ItemView` such as the PC sheet has neither inside its own leaf, so the resolver landed on a hidden 0x0 element belonging to an unrelated background tab, broke out of the loop immediately, and exited 0 having taken one shot and scrolled nothing. Perversely, that silent pass DEPENDED on unrelated tabs being open: with no markdown leaf anywhere the old resolver found nothing and correctly failed.
- **`--scroll-capture` now FAILS when the 20-step cap, not the bottom, ended the capture** (`SCROLL CAPTURE TRUNCATED`, exit 1). Previously the cap was a silent exit: a container taller than 20 viewport-fulls printed `20 shot(s)` and exited 0 having captured only the top. The cap is a runaway guard and never was a coverage criterion. The two legitimate terminators (`scrollTop` reaching the maximum, and `scrollTop` clamping so a further step makes no progress) both still pass.
- **Under `--widths`, ordered steps run once per (width, tab) PAIR and NOT at natural width.** With `--widths 1200,768,400` and no `--tab`, a step list therefore executes six times (3 widths x 2 default tabs), and never before the sweep has narrowed the pane. Without `--widths` the steps run exactly once, at natural width. Budget `--wait` values accordingly, and give every `--shot` a label.

Misuse (exit 2) is caught OFFLINE at parse time, before anything connects: a `no-emdash` mode without `--within`, a step verb with no value, an unknown `--press-key` value, and a non-finite `--wait`.

### Step verbs: a maintenance hazard worth knowing

`STEP_VERBS` (the argv-walk `Set`) and the step runner's if-chain are a LOCKSTEP PAIR. A verb in the `Set` but missing from the chain records a silent FAIL with no `rec.pass`; a verb in the chain but missing from the `Set` is never collected and is silently DROPPED. Adding a verb means editing both, in the same change.

## Container-query caveat (read before sweeping)

The PC sheet is **container-query** responsive: its breakpoints (including the 499px narrow tier) fire off the width of the Obsidian pane / leaf that holds the sheet (`@container` on `.pc-content` and the outer `.archivist-pc-sheet`), NOT the device viewport. `Emulation.setDeviceMetricsOverride` alone will not narrow the sheet if the sidebars pin the pane. The sweep therefore collapses `leftSplit` + `rightSplit` and constrains the active `.workspace-leaf.mod-active` width directly (falling back to the sheet element if the leaf will not narrow), then measures `.pc-content` clientWidth to prove the narrow tier was actually reached (below 499px). If it was not, the sweep is reported as VACUOUS and fails, because the responsive rules were never exercised. The sweep restores the pane and sidebars when it finishes.

## no-emdash is scoped on purpose

Both `no-emdash` and `no-emdash-strict` never run sheet-wide: each requires `--within <selector>` and exits 2 without it. The sheet legitimately renders em dashes (`U+2014`) in several pre-existing spots (weapon `formatDamage` emits U+2014 for zero-dice weapons; HP / proficiency placeholders; prose descriptions), so a whole-sheet scan would false-fail. Point it at the specific subtree your change owns, e.g. `--within ".pc-weapon-mastery"`.

**Scoping it to an INACTIVE tab panel is OVER-BROAD, not vacuous.** This file previously claimed the opposite, and that claim was assumed rather than measured.

The rule that matters is where the `display: none` sits, at the ROOT of what you scanned or below it:

- **Hidden ROOT.** Per the HTML specification, `innerText` on an element that is **not being rendered** returns its `textContent`. Measured live in one pass over one sheet, `innerText` / `textContent` per hidden panel: `#panel-actions` **7633 / 7633**, `#panel-spells` **79 / 79**, `#panel-inventory` **258 / 258**, `#panel-pool-boons` **621 / 621**. Every hidden root read in FULL, identical, not the empty string.
- **Hidden DESCENDANT of a rendered root.** These really are skipped. In the same pass the ONE rendered panel, `#panel-passive`, returned **568** characters of `innerText` against **12002** of `textContent`, its hidden descendants dropped. That gap is also what proves the reading was taken with layout live rather than flattened.

The same layout-live reading is why below-fold text is NOT skipped: it is rendered, merely scrolled out of view. Do not extrapolate "hidden is skipped" to "off-screen is skipped".

So a default `no-emdash --within "#panel-passive"` on an unopened Passive tab reads the panel in FULL. It cannot pass vacuously. What it can do is **false-fail** on a dash the user never sees, which is the opposite hazard: activate the tab with `--tab passive` when you want the verdict to mean "visible to the user". `no-emdash-strict` remains meaningfully stricter for a different reason, because `innerHTML` additionally carries attribute values (`title=`, `aria-label=`) and markup that no text reading surfaces.

## Gotchas (hit in live testing)

- **Multiple vault windows can be open at once** (an old "V" vault window has coexisted with "DnD"). The script picks the window by vault name and aborts on mismatch: never drop `--vault`, and do not "fix" a wrong-vault abort by removing the check; close the stray window or name the right vault.
- The verdict counts console **errors** and exceptions; warnings are reported in the JSON but non-fatal.
- The reload step disables + enables the plugin in the target vault only. If verification is interrupted mid-run, re-running it is safe and idempotent.
- **There is no known-good overflow baseline on the current build.** Treat any reported overflow as a real finding and adjudicate it on its own evidence. (The former "400px Actions-tab weapon-damage cell" baseline was retired by R3-P1 and no longer fires; leaving it documented would invite mis-adjudicating a fresh regression as an accepted one.)

## Common mistakes

| Mistake | Reality |
|---|---|
| "npm run check is green, so it works" | The suite passed while the in-vault render was never looked at, which is the exact gap this skill closes |
| Trusting `selectorCount > 0` without viewing the screenshot | The block can mount and still render wrong; the screenshot is the evidence |
| Verifying before deploying | You verified the OLD bundle; deploy, then verify |
| Declaring PC-sheet UI done without a width sweep | Responsive breakage below 499px is invisible at desktop width; sweep with `--widths 1200,768,400` |
| Sweeping only the two default tabs | Spells, Inventory, and pool tabs (`--tab spells` / `inventory` / `pool-boons`) render shared rows/CSS too; drive every tab the PC exposes |
| Guessing a pool tab id | The id is `panel-pool-<decl.id>`; on the Illrigger test PC that is `panel-pool-boons`, not `pool-interdict-boons`. A wrong id now fails the run instead of passing silently |
| Screenshotting only the top fold | Below-fold content is invisible in the SHOT (though not to `--assert-text`, whose `innerText` reading includes it); use `--scroll-capture` and read every shot |
| Recording a one-shot `--scroll-capture` as a pass | One shot means the viewport never moved, so nothing below the fold was seen; the tool now fails such a run, and a green with `shots: 1` in an older log verified nothing |
| Trusting a `--scroll-capture` that stopped at the step cap | The 20-step cap is a runaway guard, not a coverage criterion: content taller than 20 viewport-fulls used to print its shot count and exit 0 holding only the TOP. The tool now fails that run loudly (`SCROLL CAPTURE TRUNCATED`). To judge an OLDER log, a last shot named `scroll19` proves nothing on its own: hash the shots and read the TAIL. Trailing DUPLICATES mean the bottom was reached and then re-shot up to the cap, which is a complete capture (the 20-shot set on disk from 2026-07-30 is exactly this: six distinct images, indices 7 through 19 identical). Twenty DISTINCT shots is the truncation signature |
| Asserting on collapsed rows only | Expanded-state breakage is invisible; expand at least one row per affected section before asserting |
| Running `no-emdash` sheet-wide | Pre-existing benign dashes false-fail it; always `--within` the subtree you changed |
| `no-emdash --within` an unopened tab panel | Hidden panels do NOT have empty `innerText`: it falls back to `textContent`, so the scan reads the panel in full and can false-FAIL on a dash nobody can see. Activate the tab when the verdict should mean "visible to the user" |
| Reusing an old command line and trusting the old verdict | A missing check root, a dead `--tab` id, and steps under `--widths` all behave differently now; see "Behavior changes" |
