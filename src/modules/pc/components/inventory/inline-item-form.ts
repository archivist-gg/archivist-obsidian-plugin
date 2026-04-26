import type { EquipmentEntry } from "../../pc.types";
import { makeInlineInput } from "../edit-primitives";

export interface InlineItemFormOpts {
  entry: EquipmentEntry;
  index: number;
  onChange: (patch: Partial<EquipmentEntry>) => void;
}

export function renderInlineItemForm(parent: HTMLElement, opts: InlineItemFormOpts): HTMLElement {
  const root = parent.createDiv({ cls: "pc-inv-inline-form" });

  // Name (string)
  renderTextField(root, {
    label: "Name", value: opts.entry.item,
    cls: "pc-inv-inline-field-name",
    onCommit: (v) => opts.onChange({ item: v }),
  });

  // Qty (number)
  renderNumberField(root, {
    label: "Qty", value: opts.entry.qty ?? 1,
    cls: "pc-inv-inline-field-qty",
    onCommit: (n) => opts.onChange({ qty: n }),
  });

  // Weight (number)
  // TODO: weight is not typed on EquipmentEntry; consider EquipmentEntryOverrides extension.
  const w = (opts.entry as { weight?: number }).weight ?? 0;
  renderNumberField(root, {
    label: "Weight (lb)", value: w,
    cls: "pc-inv-inline-field-weight",
    onCommit: (n) => opts.onChange({ weight: n } as Partial<EquipmentEntry>),
  });

  // Notes (string)
  renderTextField(root, {
    label: "Notes", value: opts.entry.notes ?? "",
    cls: "pc-inv-inline-field-notes",
    onCommit: (v) => opts.onChange({ notes: v }),
    placeholder: "— optional —",
  });

  const help = root.createDiv({ cls: "pc-inv-inline-help" });
  help.appendText("No compendium entry — this is a custom inline item. ");
  const promote = help.createEl("a", { cls: "pc-inv-inline-promote", href: "#", text: "Promote to compendium item" });
  promote.addEventListener("click", (e) => {
    e.preventDefault();
    // Promote flow lands as a follow-up — see plan §16.
  });

  return root;
}

function renderTextField(parent: HTMLElement, o: { label: string; value: string; cls: string; placeholder?: string; onCommit: (v: string) => void }): void {
  const field = parent.createDiv({ cls: `pc-inv-inline-field ${o.cls}` });
  field.createDiv({ cls: "pc-inv-inline-lbl", text: o.label });
  const val = field.createDiv({ cls: "pc-inv-inline-val", text: o.value || (o.placeholder ?? "") });
  val.addEventListener("click", () => {
    const doc = val.ownerDocument;
    const input = doc.createElement("input");
    input.type = "text";
    input.value = o.value;
    input.className = "pc-inv-inline-text-input";
    val.replaceWith(input);
    input.focus();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      o.onCommit(input.value);
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      if (e.key === "Escape") { e.preventDefault(); done = true; input.replaceWith(val); }
    });
    input.addEventListener("blur", () => { if (!done) commit(); });
  });
}

function renderNumberField(parent: HTMLElement, o: { label: string; value: number; cls: string; onCommit: (n: number) => void }): void {
  const field = parent.createDiv({ cls: `pc-inv-inline-field ${o.cls}` });
  field.createDiv({ cls: "pc-inv-inline-lbl", text: o.label });
  const val = field.createDiv({ cls: "pc-inv-inline-val", text: String(o.value) });
  // Cursor: pointer is set via .pc-inv-inline-val CSS (no inline style — Correction A).
  val.addEventListener("click", () => {
    makeInlineInput(val, {
      initial: o.value, min: 0,
      onCommit: (n) => o.onCommit(n),
      onCancel: () => {},
    });
  });
}
