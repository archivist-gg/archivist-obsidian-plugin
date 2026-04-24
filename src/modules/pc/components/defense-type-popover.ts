import type { ComponentRenderContext } from "./component.types";
import { DAMAGE_TYPES } from "../../../shared/dnd/constants";
import {
  CONDITION_SLUGS,
  CONDITION_DISPLAY_NAMES,
} from "../constants/conditions";

export type DefenseKind = "resistances" | "immunities" | "vulnerabilities" | "condition_immunities";

const KIND_HEADERS: Record<DefenseKind, string> = {
  resistances: "Damage Resistances",
  immunities: "Damage Immunities",
  vulnerabilities: "Damage Vulnerabilities",
  condition_immunities: "Condition Immunities",
};

let current: { root: HTMLElement; cleanup: () => void } | null = null;

export function openDefenseTypePopover(
  anchor: HTMLElement,
  kind: DefenseKind,
  ctx: ComponentRenderContext,
): void {
  closeDefenseTypePopover();
  if (!ctx.editState) return;

  const editState = ctx.editState;
  const popover = activeDocument.body.createDiv({ cls: "pc-def-popover" });

  const rect = anchor.getBoundingClientRect();
  popover.style.top = `${rect.bottom + activeWindow.scrollY + 4}px`;
  popover.style.left = `${rect.left + activeWindow.scrollX}px`;

  popover.createDiv({ cls: "pc-def-popover-header", text: KIND_HEADERS[kind] });
  const list = popover.createDiv({ cls: "pc-def-popover-list" });

  if (kind === "condition_immunities") {
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
    const arr = ctx.derived.defenses[kind] ?? [];
    const active = new Set(arr);
    for (const type of DAMAGE_TYPES) {
      // Damage types stored lowercase (matches existing fixture convention)
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
