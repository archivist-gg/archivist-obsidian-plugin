import type { SheetComponent, ComponentRenderContext } from "./component.types";
import { numberOverride } from "./edit-primitives";
import { renderACTooltip } from "./ac-tooltip";

/**
 * Heraldic AC shield — ARMOR label top, big number, CLASS label bottom.
 * Number is click-to-edit and shows `*` when overrides.ac is set.
 */
export class AcShield implements SheetComponent {
  readonly type = "ac-shield";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const shield = el.createDiv({ cls: "pc-ac-shield" });
    shield.createDiv({ cls: "pc-ac-shield-shell" });
    shield.createDiv({ cls: "pc-ac-shield-trim" });
    const txt = shield.createDiv({ cls: "pc-ac-shield-txt" });
    txt.createDiv({ cls: "pc-ac-shield-label-top", text: "ARMOR" });
    const numEl = txt.createDiv({ cls: "pc-ac-shield-num", text: String(ctx.derived.ac) });
    txt.createDiv({ cls: "pc-ac-shield-label-bot", text: "CLASS" });

    // Hover/click breakdown.
    const overridden = ctx.resolved.definition?.overrides?.ac !== undefined;
    let tipEl: HTMLElement | null = null;
    const showTip = () => {
      if (tipEl) return;
      tipEl = activeDocument.createElement("div");
      tipEl.className = "pc-ac-tooltip-host";
      shield.appendChild(tipEl);
      renderACTooltip(tipEl, { ac: ctx.derived.ac, breakdown: ctx.derived.acBreakdown ?? [], overridden });
    };
    const hideTip = () => {
      tipEl?.remove();
      tipEl = null;
    };
    shield.addEventListener("mouseenter", showTip);
    shield.addEventListener("mouseleave", hideTip);

    if (!ctx.editState) return;
    const editState = ctx.editState;
    const overrides = ctx.resolved.definition?.overrides;
    numberOverride(numEl, {
      getEffective: () => ctx.derived.ac,
      isOverridden: () => overrides?.ac !== undefined,
      onSet: (n) => editState.setAcOverride(n),
      onClear: () => editState.clearAcOverride(),
      min: 0,
      max: 50,
    });
  }
}
