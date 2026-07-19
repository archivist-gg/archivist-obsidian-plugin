import { Modal, type App } from "obsidian";
import type { ComponentRenderContext } from "../component.types";
import { BrowseMode } from "./browse-mode";

interface IdentifyPickerOptions {
  /** The placeholder's `masked_category` (e.g. "potion", "weapon", "wondrous
   *  item"). Scopes the browsable compendium candidates to that category. */
  maskedCategory: string;
  /** Called with the chosen real item's slug when the user picks. */
  onSelect: (slug: string) => void;
}

/**
 * Open the identify picker: a modal hosting the compendium BrowseMode in
 * select-callback mode, scoped to the placeholder's `masked_category`. Picking a
 * real item identifies the placeholder in place (`identifyItem`) and closes the
 * modal. The scope maps a category to its candidate pool via BrowseMode's
 * `categoryScope` (weapon/armor by entity type; potion/ring/wand/scroll/wondrous
 * item by the item's `type`), which yields a non-empty list for every seeded
 * `masked_category`.
 */
export function openIdentifyPicker(
  ctx: ComponentRenderContext,
  entryIndex: number,
  maskedCategory: string,
): void {
  const editState = ctx.editState;
  if (!editState) return;
  new IdentifyPickerModal(ctx.app, ctx, {
    maskedCategory,
    onSelect: (slug) => editState.identifyItem(entryIndex, slug),
  }).open();
}

class IdentifyPickerModal extends Modal {
  constructor(
    app: App,
    private readonly ctx: ComponentRenderContext,
    private readonly opts: IdentifyPickerOptions,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.empty();
    // Scope the modal under `.archivist-pc-sheet` too so the hosted inventory
    // rows pick up the sheet-scoped styles (the browse rows are styled there).
    this.contentEl.addClass("archivist-modal", "archivist-pc-sheet", "pc-identify-picker");
    const category = this.opts.maskedCategory.trim();
    this.contentEl.createEl("h2", {
      text: category ? `Identify this ${category}` : "Identify this item",
    });
    const host = this.contentEl.createDiv({ cls: "pc-identify-picker-body" });
    new BrowseMode({
      filters: { status: "all", types: new Set(), rarities: new Set(), search: "" },
      categoryScope: category || undefined,
      onSelect: (slug) => {
        this.opts.onSelect(slug);
        this.close();
      },
    }).render(host, this.ctx);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
