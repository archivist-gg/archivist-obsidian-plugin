import type { ComponentRenderContext } from "./component.types";
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

  for (const type of DAMAGE_TYPES) {
    // `DAMAGE_TYPES` holds display strings ("Psychic"), so the row's key has to be
    // canonicalized. Deriving it with `toDefenseSlug`, the one normalizer the whole
    // defenses path shares, means the value this row COMPARES on and the value it
    // WRITES through `editState.{add,remove}Defense` are the same string by construction.
    const slug = toDefenseSlug(type);
    const row = damageList.createDiv({
      cls: "pc-def-popover-row",
      attr: { "data-type": slug },
    });
    row.createSpan({ cls: "pc-def-popover-name", text: type });
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

  for (const slug of CONDITION_SLUGS) {
    const row = condList.createDiv({
      cls: "pc-def-popover-row",
      attr: { "data-slug": slug },
    });
    row.createSpan({ cls: "pc-def-popover-name", text: CONDITION_DISPLAY_NAMES[slug] });

    // Row-local mirror of the binary state. Seeded from `ctx.derived.defenses`
    // and flipped optimistically on tap · same pattern as damage rows, and keyed on
    // the canonical `value` for the same reason. `slug` needs no normalizing here:
    // `CONDITION_SLUGS` is the canonical vocabulary, not a display list.
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
