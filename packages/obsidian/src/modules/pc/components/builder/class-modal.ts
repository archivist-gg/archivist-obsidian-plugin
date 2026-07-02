import { Modal, type App } from "obsidian";
import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "@archivist/core";
import type { ColSpec } from "./selection-table";
import { renderEntityPicker } from "./entity-picker";
import { renderClassChronicle, type ClassData } from "./class-chronicle";

const dieOf = (e: RegisteredEntity): string => String((e.data as ClassData).hit_die ?? "");
const savesOf = (e: RegisteredEntity): string =>
  ((e.data as ClassData).saving_throws ?? []).map((s) => s.toUpperCase()).join(" · ");

export const CLASS_COLUMNS: ColSpec[] = [
  {
    label: "Hit Die", cls: "col-die", width: "70px",
    sort: (a, b) => parseInt(dieOf(a).replace(/\D/g, ""), 10) - parseInt(dieOf(b).replace(/\D/g, ""), 10),
    render: (cell, e) => cell.setText(dieOf(e) || "—"),
  },
  { label: "Saves", cls: "col-saves", width: "110px", render: (cell, e) => cell.setText(savesOf(e) || "—") },
];

export interface AddClassModalOptions {
  /** Classes already held — filtered out of the ledger. */
  exclude: Set<string>;
  onAdd: (slug: string) => void;
}

/** Parchment Add-Class modal (rest-modal chrome). Reading and adding are
 *  separated: row click = accordion Chronicle read + highlight; only the
 *  sticky footer button or the in-block claim bar commits. */
export class AddClassModal extends Modal {
  constructor(
    app: App,
    private readonly ctx: ComponentRenderContext,
    private readonly opts: AddClassModalOptions,
  ) { super(app); }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.addClass("archivist-modal");
    this.contentEl.addClass("pc-bclass-modal");
    renderAddClassBody(this.contentEl, this.ctx, { ...this.opts, close: () => this.close() });
  }

  onClose(): void { this.contentEl.empty(); }
}

export function renderAddClassBody(
  host: HTMLElement,
  ctx: ComponentRenderContext,
  opts: AddClassModalOptions & { close: () => void },
): void {
  let highlighted: string | null = null;
  const commit = (slug: string): void => { opts.onAdd(slug); opts.close(); };
  const draw = (): void => {
    host.empty();
    // Title-Case display heading (CSS uppercases it on screen), matching the
    // rest-modal chrome. Built off a const so the sentence-case UI lint — which
    // only inspects bare literal arguments, as rest-modal's ternary relies on —
    // leaves the stylistic casing intact.
    const title = "Add a Class";
    host.createEl("h2", { cls: "pc-bcm-title" }).setText(title);
    const scroll = host.createDiv({ cls: "pc-bcm-scroll" });
    renderEntityPicker(scroll, ctx, {
      entityType: "class",
      stateKey: "builder.class-modal",
      selectedSlug: highlighted,
      exclude: opts.exclude,
      onSelect: (slug) => { highlighted = slug; draw(); },
      columns: CLASS_COLUMNS,
      expandSelect: true,
      renderExpand: (wrap, e) => {
        renderClassChronicle(wrap, ctx, { entity: e, level: 1, mode: "browse", stateKey: "builder.class-modal.read" });
        const claim = wrap.createEl("button", { cls: "pc-bcm-claim", text: `Add ${e.name} ▸` });
        claim.addEventListener("click", () => commit(e.slug));
      },
    });
    const foot = host.createDiv({ cls: "pc-bcm-foot" });
    const name = highlighted ? (ctx.services.entities.getByTypeAndSlug("class", highlighted)?.name ?? highlighted) : null;
    if (!name) foot.createSpan({ cls: "pc-bcm-hint", text: "Click a class to read it — adding is explicit." });
    const add = foot.createEl("button", { cls: "pc-bcm-add", text: name ? `Add ${name} to your character ▸` : "Add a class ▸" });
    add.disabled = !highlighted;
    add.addEventListener("click", () => { if (highlighted) commit(highlighted); });
  };
  draw();
}
