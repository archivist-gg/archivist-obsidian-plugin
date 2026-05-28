import { setIcon } from "obsidian";

export type ToolbarMode = "list" | "browse";

export interface ToolbarOptions {
  mode: ToolbarMode;
  onSearch: (value: string) => void;
  onAdd: () => void;
  onDone: () => void;
  initialSearch?: string;
}

export class InventoryToolbar {
  constructor(private readonly opts: ToolbarOptions) {}

  render(parent: HTMLElement): HTMLElement {
    const bar = parent.createDiv({ cls: "pc-inv-toolbar" });

    const search = bar.createDiv({ cls: "pc-inv-search" });
    const searchIcon = search.createSpan({ cls: "pc-inv-search-icon" });
    setIcon(searchIcon, "search");
    const input = search.createEl("input", {
      type: "text",
      attr: {
        placeholder: this.opts.mode === "browse" ? "search compendium…" : "search items, types, tags…",
      },
    });
    if (this.opts.initialSearch) input.value = this.opts.initialSearch;
    input.addEventListener("input", () => this.opts.onSearch(input.value));

    if (this.opts.mode === "browse") {
      const done = bar.createEl("button", { cls: "pc-inv-done", text: "Done" });
      done.addEventListener("click", () => this.opts.onDone());
    } else {
      const add = bar.createEl("button", { cls: "pc-inv-add" });
      const plus = add.createSpan({ cls: "pc-inv-add-icon" });
      setIcon(plus, "plus");
      add.appendText(" Add Item");
      add.addEventListener("click", () => this.opts.onAdd());
    }

    return bar;
  }
}
