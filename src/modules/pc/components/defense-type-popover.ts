import type { ComponentRenderContext } from "./component.types";
import { DAMAGE_TYPES } from "../../../shared/dnd/constants";
import { CONDITION_SLUGS, CONDITION_DISPLAY_NAMES } from "../constants/conditions";

export type DefenseKind = "resistances" | "immunities" | "vulnerabilities" | "condition_immunities";

const KIND_TABS: ReadonlyArray<{ key: DefenseKind; label: string }> = [
  { key: "resistances", label: "Resistance" },
  { key: "immunities", label: "Immunity" },
  { key: "vulnerabilities", label: "Vulnerability" },
  { key: "condition_immunities", label: "Condition Imm." },
];

let current: { root: HTMLElement; cleanup: () => void } | null = null;

/**
 * Single popover for adding any defense (damage resistance / immunity /
 * vulnerability / condition immunity). Shows a tab bar with the four
 * kinds; clicking a tab updates the list below to toggleable damage types
 * or condition slugs scoped to that kind. Kind selection is an in-popover
 * step rather than a separate flow — no "back" button needed.
 *
 * See conditions-popover.ts for the click-race rationale on the document
 * `click` handler (the opening click must not self-close the popover).
 */
export function openDefenseTypePopover(
  anchor: HTMLElement,
  ctx: ComponentRenderContext,
): void {
  closeDefenseTypePopover();
  if (!ctx.editState) return;

  const editState = ctx.editState;
  const popover = activeDocument.body.createDiv({ cls: "pc-def-popover" });

  const rect = anchor.getBoundingClientRect();
  popover.style.top = `${rect.bottom + activeWindow.scrollY + 4}px`;
  popover.style.left = `${rect.left + activeWindow.scrollX}px`;

  popover.createDiv({ cls: "pc-def-popover-header", text: "Add Defense" });

  const tabBar = popover.createDiv({ cls: "pc-def-popover-tabs" });
  const list = popover.createDiv({ cls: "pc-def-popover-list" });

  let activeKind: DefenseKind = "resistances";

  const renderList = () => {
    while (list.firstChild) list.firstChild.remove();
    if (activeKind === "condition_immunities") {
      const active = new Set(ctx.derived.defenses.condition_immunities);
      for (const slug of CONDITION_SLUGS) {
        addRow(list, CONDITION_DISPLAY_NAMES[slug], active.has(slug), () => {
          if (active.has(slug)) {
            editState.removeConditionImmunity(slug);
            active.delete(slug);
          } else {
            editState.addConditionImmunity(slug);
            active.add(slug);
          }
        });
      }
    } else {
      const kind = activeKind;
      const arr = ctx.derived.defenses[kind] ?? [];
      const active = new Set(arr);
      for (const type of DAMAGE_TYPES) {
        const storeKey = type.toLowerCase();
        addRow(list, type, active.has(storeKey), () => {
          if (active.has(storeKey)) {
            editState.removeDefense(kind, storeKey);
            active.delete(storeKey);
          } else {
            editState.addDefense(kind, storeKey);
            active.add(storeKey);
          }
        });
      }
    }
  };

  for (const { key, label } of KIND_TABS) {
    const tab = tabBar.createEl("button", {
      cls: `pc-def-popover-tab${key === activeKind ? " active" : ""}`,
      text: label,
      attr: { "data-kind": key },
    });
    tab.addEventListener("click", (e) => {
      e.stopPropagation();
      activeKind = key;
      tabBar.querySelectorAll<HTMLElement>(".pc-def-popover-tab").forEach((t) => {
        t.classList.toggle("active", t.getAttribute("data-kind") === key);
      });
      renderList();
    });
  }

  renderList();

  const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") closeDefenseTypePopover(); };
  const onClick = (e: MouseEvent) => {
    if (!(e.target instanceof Node)) return;
    if (popover.contains(e.target) || anchor.contains(e.target)) return;
    closeDefenseTypePopover();
  };
  const onScroll = () => closeDefenseTypePopover();

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

function addRow(
  list: HTMLElement,
  label: string,
  isActive: boolean,
  onToggle: () => void,
): void {
  const row = list.createDiv({ cls: "pc-def-popover-row" });
  row.createDiv({ cls: "pc-def-popover-name", text: label });
  const toggle = row.createDiv({ cls: `pc-def-popover-toggle${isActive ? " on" : ""}` });
  toggle.addEventListener("click", () => {
    onToggle();
    toggle.classList.toggle("on");
  });
}

export function closeDefenseTypePopover(): void {
  if (!current) return;
  current.cleanup();
  current.root.remove();
  current = null;
}
