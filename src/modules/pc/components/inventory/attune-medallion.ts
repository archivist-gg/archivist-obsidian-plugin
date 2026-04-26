import { setIcon } from "obsidian";
import type { ResolvedEquipped } from "../../pc.types";
import { iconForEntity } from "./icon-mapping";

export interface MedallionOpts {
  slotIndex: number;
  occupant: ResolvedEquipped | null;
  onClickEmpty: (slotIndex: number) => void;
  onClickFilled: (occupant: ResolvedEquipped, anchor: HTMLElement) => void;
}

const RARITY_CLASS: Record<string, string> = {
  "common":     "rarity-common",
  "uncommon":   "rarity-uncommon",
  "rare":       "rarity-rare",
  "very rare":  "rarity-very-rare",
  "very-rare":  "rarity-very-rare",
  "legendary":  "rarity-legendary",
  "artifact":   "rarity-artifact",
};

export function renderMedallion(parent: HTMLElement, opts: MedallionOpts): HTMLElement {
  const wrapper = parent.createDiv({ cls: "pc-medallion-wrapper" });
  const m = wrapper.createDiv({ cls: "pc-medallion" });

  if (!opts.occupant) {
    m.classList.add("empty");
    const ic = m.createSpan({ cls: "pc-medallion-icon" });
    setIcon(ic, "plus");
    m.addEventListener("click", () => opts.onClickEmpty(opts.slotIndex));
    return wrapper;
  }

  const e = opts.occupant.entity as { rarity?: string; name?: string } | null;
  const rarityCls = RARITY_CLASS[(e?.rarity ?? "").toLowerCase()];
  if (rarityCls) m.classList.add(rarityCls);

  const ic = m.createSpan({ cls: "pc-medallion-icon" });
  setIcon(ic, iconForEntity(opts.occupant, opts.occupant.entry));

  m.addEventListener("click", () => opts.onClickFilled(opts.occupant!, m));

  // Name below
  const name = wrapper.createDiv({
    cls: "pc-medallion-name",
    text: e?.name ?? prettyName(opts.occupant.entry.item),
  });
  if (rarityCls) name.classList.add(rarityCls);

  return wrapper;
}

function prettyName(item: string): string {
  const m = item.match(/^\[\[(.+)\]\]$/);
  if (m) return m[1].replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return item;
}
