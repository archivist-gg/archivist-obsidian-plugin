import type { ResolvedEquipped } from "../../pc.types";
import { requiresAttunement } from "./requires-attunement";

export interface PopoverOpts {
  anchor: HTMLElement;
  occupant: ResolvedEquipped;
  onUnattune: (index: number) => void;
  onFindInList: (index: number) => void;
}

export function showAttunePopover(opts: PopoverOpts): HTMLElement {
  const doc = opts.anchor.ownerDocument;
  removeExisting(doc);

  const pop = doc.body.createDiv({ cls: "pc-attune-popover" });
  const e = opts.occupant.entity as { name?: string; type?: string; rarity?: string; entries?: unknown[] } | null;

  pop.createDiv({ cls: "pc-attune-pop-name", text: e?.name ?? prettyName(opts.occupant.entry.item) });
  pop.createDiv({ cls: "pc-attune-pop-subtitle", text: subtitle(e, requiresAttunement(opts.occupant.entity)) });

  const firstEntry = e?.entries?.find((x): x is string => typeof x === "string");
  if (firstEntry) {
    const desc = pop.createDiv({ cls: "pc-attune-pop-desc" });
    desc.setText(firstEntry.length > 220 ? firstEntry.slice(0, 217) + "…" : firstEntry);
  }

  const actions = pop.createDiv({ cls: "pc-attune-pop-actions" });
  const findBtn = actions.createEl("button", { cls: "pc-attune-pop-find", text: "Find in list" });
  findBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    opts.onFindInList(opts.occupant.index);
    cleanup();
  });
  const unBtn = actions.createEl("button", { cls: "pc-attune-pop-unattune", text: "Unattune" });
  unBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    opts.onUnattune(opts.occupant.index);
    cleanup();
  });

  // Position next to anchor (CSS provides `position: absolute`; we set
  // top/left dynamically). The eslint rule on `style.position` is appeased by
  // letting CSS own that property.
  const rect = opts.anchor.getBoundingClientRect();
  pop.style.top = `${rect.bottom + 6}px`;
  pop.style.left = `${rect.left}px`;

  // Stop clicks inside the popover from closing it
  pop.addEventListener("click", (ev) => ev.stopPropagation());

  // Close on outside click / Escape
  const close = (): void => cleanup();
  const onKey = (ev: KeyboardEvent): void => { if (ev.key === "Escape") close(); };
  // Defer body-click registration to the next tick so the originating click
  // (which is still bubbling when this code runs) doesn't immediately trigger
  // close on the bubble target. See WHATWG DOM spec: listener lists are cloned
  // at each invocation target during dispatch, so synchronously-added listeners
  // would fire on bubble targets that haven't been reached yet.
  activeWindow.setTimeout(() => {
    doc.body.addEventListener("click", close, { once: true });
  }, 0);
  doc.addEventListener("keydown", onKey);

  function cleanup(): void {
    pop.remove();
    doc.body.removeEventListener("click", close);
    doc.removeEventListener("keydown", onKey);
  }

  return pop;
}

function removeExisting(doc: Document): void {
  doc.body.querySelectorAll(".pc-attune-popover").forEach((p) => p.remove());
}

function subtitle(entity: { type?: string; rarity?: string } | null, attunementRequired: boolean): string {
  if (!entity) return "";
  const parts: string[] = [];
  if (entity.type) parts.push(entity.type);
  if (entity.rarity) parts.push(entity.rarity);
  if (attunementRequired) parts.push("requires attunement");
  return parts.join(", ");
}

function prettyName(item: string): string {
  const m = item.match(/^\[\[(.+)\]\]$/);
  return m ? m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : item;
}
