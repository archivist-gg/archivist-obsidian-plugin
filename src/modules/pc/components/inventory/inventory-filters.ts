import { setIcon } from "obsidian";
import type { FilterState, StatusFilter } from "./filter-state";

export interface FiltersOptions {
  filters: FilterState;
  mode: "list" | "browse";
  onChange: (next: FilterState) => void;
}

const STATUS_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: "all",       label: "All" },
  { key: "equipped",  label: "Equipped" },
  { key: "attuned",   label: "Attuned" },
  { key: "carried",   label: "Carried" },
];

const TYPE_CHIPS: { key: string; label: string; icon: string }[] = [
  { key: "weapon",   label: "Weapons",  icon: "sword" },
  { key: "armor",    label: "Armor",    icon: "shield" },
  { key: "wondrous", label: "Wondrous", icon: "sparkles" },
  { key: "ring",     label: "Ring",     icon: "tabler-ring" },
  { key: "potion",   label: "Potion",   icon: "flask-conical" },
  { key: "scroll",   label: "Scroll",   icon: "scroll" },
  { key: "wand",     label: "Wand",     icon: "tabler-wand" },
  { key: "tool",     label: "Tool",     icon: "wrench" },
];

const RARITY_CHIPS = ["common", "uncommon", "rare", "very-rare", "legendary"];

export class InventoryFilters {
  constructor(private readonly opts: FiltersOptions) {}

  render(parent: HTMLElement): HTMLElement {
    const root = parent.createDiv({ cls: "pc-inv-filter-row" });

    if (this.opts.mode !== "browse") this.renderStatusGroup(root);
    this.renderTypeGroup(root);
    this.renderRarityGroup(root);

    return root;
  }

  private renderStatusGroup(root: HTMLElement): void {
    const group = root.createDiv({ cls: "pc-inv-filter-group" });
    group.createSpan({ cls: "pc-inv-filter-group-label", text: "Status" });
    for (const c of STATUS_CHIPS) {
      const chip = group.createEl("button", { cls: "pc-inv-chip" });
      chip.appendText(c.label);
      if (this.opts.filters.status === c.key) chip.classList.add("active");
      chip.addEventListener("click", () => {
        this.opts.onChange({ ...this.opts.filters, status: c.key });
      });
    }
  }

  private renderTypeGroup(root: HTMLElement): void {
    const group = root.createDiv({ cls: "pc-inv-filter-group" });
    group.createSpan({ cls: "pc-inv-filter-group-label", text: "Type" });
    for (const c of TYPE_CHIPS) {
      const chip = group.createEl("button", { cls: "pc-inv-chip" });
      const ic = chip.createSpan({ cls: "pc-inv-chip-icon" });
      setIcon(ic, c.icon);
      chip.appendText(" " + c.label);
      if (this.opts.filters.types.has(c.key)) chip.classList.add("active");
      chip.addEventListener("click", () => {
        const next = new Set(this.opts.filters.types);
        if (next.has(c.key)) next.delete(c.key);
        else next.add(c.key);
        this.opts.onChange({ ...this.opts.filters, types: next });
      });
    }
  }

  private renderRarityGroup(root: HTMLElement): void {
    const group = root.createDiv({ cls: "pc-inv-filter-group" });
    group.createSpan({ cls: "pc-inv-filter-group-label", text: "Rarity" });
    for (const r of RARITY_CHIPS) {
      const chip = group.createEl("button", { cls: "pc-inv-chip", text: r.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
      if (this.opts.filters.rarities.has(r)) chip.classList.add("active");
      chip.addEventListener("click", () => {
        const next = new Set(this.opts.filters.rarities);
        if (next.has(r)) next.delete(r);
        else next.add(r);
        this.opts.onChange({ ...this.opts.filters, rarities: next });
      });
    }
  }
}
