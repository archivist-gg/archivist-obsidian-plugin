import type { ComponentRenderContext } from "./component.types";
import type { DefenseEntry } from "@archivist-gg/dnd5e/pc/pc.types";
import { DAMAGE_TYPES } from "@archivist-gg/dnd5e/dnd/constants";
import { CONDITION_SLUGS, CONDITION_DISPLAY_NAMES } from "@archivist-gg/dnd5e/pc/conditions.constants";
import { toDefenseSlug } from "@archivist-gg/dnd5e/pc/pc.defense-normalize";
import { clampPopoverToViewport } from "./popover-utils";
import {
  cycleAction,
  defenseKindFor,
  type DefenseRowState,
} from "./defense-type-popover-logic";

/**
 * Storage key for the four defense buckets the merged Defenses+Conditions
 * panel iterates over. Imported by `defenses-conditions-panel.ts` to type its
 * `DEFENSE_ROWS` table. The first three correspond to `defenseKindFor(...)`
 * outputs from the tri-state cycle; `"condition_immunities"` is its own
 * separate bucket on the character data model.
 */
export type DefenseKind =
  | "resistances"
  | "immunities"
  | "vulnerabilities"
  | "condition_immunities";

type DefenseTab = "damages" | "conditions";

/**
 * One row of a picker tab: the canonical key the row reads and writes on, and the
 * string the user sees. They are NOT interchangeable · `slug` is what
 * `editState.{add,remove}Defense` receives and what the pip compares against
 * `DefenseEntry.value`, while `display` is presentation only.
 */
type DefenseOption = { slug: string; display: string };

/**
 * `union(shipped vocabulary, everything present in `derived.defenses`)`, KEYED BY
 * `toDefenseSlug`.
 *
 * PROTECTIVE, not corrective. Zero off-vocabulary values exist in the product today, so
 * on every character that ships this returns exactly the vocabulary. What it buys is that
 * the day a value the picker's list does not carry reaches `derived.defenses` · a homebrew
 * damage type, an unrecognised condition, anything a future overlay introduces · the
 * picker SHOWS it, with a live pip, instead of silently hiding a defense the character
 * actually has. (No PC path emits such a value today. `DAMAGE_NONMAGICAL_VARIANTS` looks
 * like a candidate but is NOT one: its only consumer anywhere is the monster editor's
 * damage presets in modules/monster/edit/info-editor.ts.)
 *
 * The keying is the whole point and is not optional · and it matters far more broadly than
 * "someone typed a lowercase value". `composeDefenseEntries` (dnd5e pc.recalc.ts, the sole
 * constructor of `DefenseEntry` for all four buckets) sets `value = toDefenseSlug(raw)` and
 * `label = raw.trim()`, so EVERY entry's `value` is lowercase while `DAMAGE_TYPES` is
 * Title-Case. Unioned on raw strings, a Staff of Fire's granted `{value:"fire",
 * label:"Fire"}` is a different member from the vocabulary's `"Fire"` · so the picker grows
 * a duplicate row whose pips fight the row above it for ANY damage type the character
 * holds, not merely for a hand-typed one. Normalizing BOTH sides with the one normalizer
 * the defenses path shares collapses them to a single row by construction.
 *
 * DISPLAY rule, expressed as seeding order rather than a per-entry fallback: the
 * vocabulary is inserted first and `present` entries never overwrite an existing key, so a
 * known slug keeps the vocabulary's spelling ("Fire", "Charmed") and an unknown one falls
 * back to the entry's authored `label`.
 *
 * ⚠️ That matches `VOCAB[slug] ?? entry.label` for VOCABULARY-vs-DERIVED, and only there.
 * The two forms DISAGREE for derived-vs-derived: when the same off-vocabulary slug appears
 * in two buckets, seeding order keeps the FIRST label and a literal per-entry `??` would
 * keep the LAST. That is a real behavioural difference, not a stylistic one · it is pinned
 * by "collapses an off-vocabulary value repeated across two buckets, first label winning"
 * in tests/pc-defense-popover.test.ts, which goes RED against a last-wins implementation.
 * Do not "simplify" this to the `??` form; it is not an equivalent rewrite.
 */
function unionDefenseOptions(
  vocabulary: readonly DefenseOption[],
  present: readonly (readonly DefenseEntry[] | undefined)[],
): DefenseOption[] {
  const bySlug = new Map<string, DefenseOption>();
  for (const option of vocabulary) bySlug.set(option.slug, option);
  for (const bucket of present) {
    for (const entry of bucket ?? []) {
      // `entry.value` is canonical by construction (the engine builds it with this same
      // function), so this call is idempotent · it is written out anyway so that BOTH
      // sides of the union visibly go through one normalizer, which is the invariant
      // that makes the collapse true rather than accidental.
      const slug = toDefenseSlug(entry.value);
      if (!bySlug.has(slug)) bySlug.set(slug, { slug, display: entry.label });
    }
  }
  return [...bySlug.values()];
}

let current: { root: HTMLElement; cleanup: () => void } | null = null;

/**
 * Tabbed popover for adding any defense:
 *
 * - Damages tab (default): each row has three R/I/V pips. Mutually exclusive
 *   — see `cycleAction` in ./defense-type-popover-logic for the transition table.
 * - Conditions tab: each row has a single "I" (immunity) pip that toggles
 *   on/off — same visual language as the damage pips, but binary not tri-state.
 *
 * Renders into `document.body` (outside `.archivist-pc-sheet`), so styles
 * are scoped under `.pc-def-popover` to win specificity over Obsidian's
 * defaults.
 *
 * See conditions-popover.ts for the click-race rationale on the document
 * `click` handler.
 */
export function openDefenseTypePopover(
  anchor: HTMLElement,
  ctx: ComponentRenderContext,
): void {
  closeDefenseTypePopover();
  if (!ctx.editState) return;

  const editState = ctx.editState;
  const popover = activeDocument.body.createDiv({ cls: "pc-def-popover" });

  const anchorRect = anchor.getBoundingClientRect();
  popover.style.top = `${anchorRect.bottom + activeWindow.scrollY + 4}px`;
  popover.style.left = `${anchorRect.left + activeWindow.scrollX}px`;

  popover.createDiv({ cls: "pc-def-popover-header", text: "Add Defense" });

  // ─── Tab bar ─────────────────────────────────────────────────────
  const tabBar = popover.createDiv({ cls: "pc-def-popover-tabs" });
  const damagesTab = tabBar.createEl("button", {
    cls: "pc-def-popover-tab active",
    text: "Damages",
    attr: { "data-tab": "damages", type: "button" },
  });
  const conditionsTab = tabBar.createEl("button", {
    cls: "pc-def-popover-tab",
    text: "Conditions",
    attr: { "data-tab": "conditions", type: "button" },
  });

  const panels = popover.createDiv({ cls: "pc-def-popover-panels" });

  const setActiveTab = (tab: DefenseTab) => {
    damagesTab.classList.toggle("active", tab === "damages");
    conditionsTab.classList.toggle("active", tab === "conditions");
    panels.querySelectorAll<HTMLElement>(".pc-def-popover-panel").forEach((p) => {
      p.classList.toggle("active", p.dataset.tab === tab);
    });
  };
  damagesTab.addEventListener("click", () => setActiveTab("damages"));
  conditionsTab.addEventListener("click", () => setActiveTab("conditions"));

  // ─── Panel 1: Damages (default active) ───────────────────────────
  const damagesPanel = panels.createDiv({
    cls: "pc-def-popover-panel active",
    attr: { "data-tab": "damages" },
  });
  damagesPanel.createDiv({
    cls: "pc-def-popover-legend",
    text: "R esist · I mmune · V uln",
  });
  const damageList = damagesPanel.createDiv({ cls: "pc-def-popover-list" });

  // `DAMAGE_TYPES` holds display strings ("Psychic"), so each row's key has to be
  // canonicalized. Deriving it with `toDefenseSlug`, the one normalizer the whole
  // defenses path shares, means the value a row COMPARES on and the value it
  // WRITES through `editState.{add,remove}Defense` are the same string by construction ·
  // and it is what lets the union below collapse "Fire" and a manual "fire" onto one row.
  const damageOptions = unionDefenseOptions(
    DAMAGE_TYPES.map((type) => ({ slug: toDefenseSlug(type), display: type })),
    [
      ctx.derived.defenses?.resistances,
      ctx.derived.defenses?.immunities,
      ctx.derived.defenses?.vulnerabilities,
    ],
  );

  for (const { slug, display } of damageOptions) {
    const row = damageList.createDiv({
      cls: "pc-def-popover-row",
      attr: { "data-type": slug },
    });
    row.createSpan({ cls: "pc-def-popover-name", text: display });
    const tri = row.createDiv({ cls: "pc-def-popover-tri" });

    const renderRow = (state: DefenseRowState) => {
      for (const kind of ["resistance", "immunity", "vulnerability"] as const) {
        const pip = tri.querySelector<HTMLButtonElement>(`.pc-def-popover-pip[data-kind="${kind}"]`);
        if (pip) pip.classList.toggle("on", state === kind);
      }
    };

    // Row-local mirror of the tri-state. Seeded from `ctx.derived.defenses`
    // on first render; subsequent taps update it optimistically so re-renders
    // don't need a round-trip through the resolver. (The data model is still
    // the source of truth — `editState.{add,remove}Defense` writes through.)
    const initialState = ((): DefenseRowState => {
      const d = ctx.derived.defenses;
      // Key on `value`, never `label`. `value` is canonical by construction (the engine
      // builds it with `toDefenseSlug`), whereas `label` preserves the authored spelling,
      // so a rules-granted "Psychic" only matches this row's canonical slug through `value`.
      if (d.resistances?.some((e) => e.value === slug)) return "resistance";
      if (d.immunities?.some((e) => e.value === slug)) return "immunity";
      if (d.vulnerabilities?.some((e) => e.value === slug)) return "vulnerability";
      return null;
    })();
    let rowState: DefenseRowState = initialState;

    for (const kind of ["resistance", "immunity", "vulnerability"] as const) {
      const pip = tri.createEl("button", {
        cls: "pc-def-popover-pip",
        text: kind.charAt(0).toUpperCase(),
        attr: { "data-kind": kind, type: "button" },
      });
      pip.addEventListener("click", () => {
        const action = cycleAction(rowState, kind);
        if (action.removeKind) editState.removeDefense(defenseKindFor(action.removeKind), slug);
        if (action.addKind) editState.addDefense(defenseKindFor(action.addKind), slug);
        rowState = action.addKind ?? null;
        renderRow(rowState);
      });
    }

    renderRow(rowState);
  }

  // ─── Panel 2: Conditions ──────────────────────────────────────────
  const conditionsPanel = panels.createDiv({
    cls: "pc-def-popover-panel",
    attr: { "data-tab": "conditions" },
  });
  const condList = conditionsPanel.createDiv({ cls: "pc-def-popover-list" });

  // Same union, seeded from `CONDITION_SLUGS` · NOT from `dnd/constants`' `CONDITIONS`.
  // The two vocabularies disagree by one member: `CONDITIONS` carries "Exhaustion", which
  // `CONDITION_SLUGS` deliberately omits. Seeding from `CONDITIONS` would add a brand-new
  // row to a shipped picker, which this change is not allowed to do (it is protective, not
  // corrective), and it would offer a LEVEL-based condition as a boolean immunity. So the
  // conditions union widens only by what `derived.condition_immunities` actually holds.
  const conditionOptions = unionDefenseOptions(
    CONDITION_SLUGS.map((s) => ({ slug: s, display: CONDITION_DISPLAY_NAMES[s] })),
    [ctx.derived.defenses?.condition_immunities],
  );

  for (const { slug, display } of conditionOptions) {
    const row = condList.createDiv({
      cls: "pc-def-popover-row",
      attr: { "data-slug": slug },
    });
    row.createSpan({ cls: "pc-def-popover-name", text: display });

    // Row-local mirror of the binary state. Seeded from `ctx.derived.defenses`
    // and flipped optimistically on tap · same pattern as damage rows, and keyed on
    // the canonical `value` for the same reason. `slug` needs no normalizing here:
    // both of its sources are already canonical · `CONDITION_SLUGS` is the canonical
    // vocabulary rather than a display list, and the union's other half is
    // `toDefenseSlug(entry.value)`. It is a plain `string` and not a `ConditionSlug`,
    // which is why `editState.{add,remove}ConditionImmunity` take `string`: the union
    // can by construction surface a value outside the closed slug type.
    let condState = (ctx.derived.defenses.condition_immunities ?? [])
      .some((e) => e.value === slug);
    const pip = row.createEl("button", {
      cls: "pc-def-popover-pip",
      text: "I",
      attr: { "data-kind": "immunity", type: "button" },
    });
    if (condState) pip.classList.add("on");
    pip.addEventListener("click", () => {
      if (condState) editState.removeConditionImmunity(slug);
      else editState.addConditionImmunity(slug);
      condState = !condState;
      pip.classList.toggle("on", condState);
    });
  }

  // Keep the popover inside the viewport — same helper the conditions
  // popover uses; final placement runs after both panels render.
  clampPopoverToViewport(popover, anchorRect);

  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") closeDefenseTypePopover(); };
  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Node)) return;
    if (popover.contains(e.target) || anchor.contains(e.target)) return;
    closeDefenseTypePopover();
  };
  // Close on page/anchor scroll (which would visually disconnect the popover),
  // but ignore scrolls inside the popover itself (its own list scrolling).
  const onScroll = (e: Event) => {
    if (e.target instanceof Node && popover.contains(e.target)) return;
    closeDefenseTypePopover();
  };

  activeDocument.addEventListener("keydown", onKeyDown);
  activeDocument.addEventListener("click", onClick);
  activeWindow.addEventListener("scroll", onScroll, true);

  current = {
    root: popover,
    cleanup: () => {
      activeDocument.removeEventListener("keydown", onKeyDown);
      activeDocument.removeEventListener("click", onClick);
      activeWindow.removeEventListener("scroll", onScroll, true);
    },
  };
}

export function closeDefenseTypePopover(): void {
  if (!current) return;
  current.cleanup();
  current.root.remove();
  current = null;
}
