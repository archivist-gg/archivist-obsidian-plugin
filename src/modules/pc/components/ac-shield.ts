import type { SheetComponent, ComponentRenderContext } from "./component.types";

/**
 * Pentagonal AC shield — ARMOR label top, big number, CLASS label bottom.
 * Shape comes from CSS clip-path on two layered divs (.shell + .trim) in components.css.
 */
export class AcShield implements SheetComponent {
  readonly type = "ac-shield";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const shield = el.createDiv({ cls: "pc-ac-shield" });
    shield.createDiv({ cls: "pc-ac-shield-shell" });
    shield.createDiv({ cls: "pc-ac-shield-trim" });
    const txt = shield.createDiv({ cls: "pc-ac-shield-txt" });
    txt.createDiv({ cls: "pc-ac-shield-label-top", text: "ARMOR" });
    txt.createDiv({ cls: "pc-ac-shield-num", text: String(ctx.derived.ac) });
    txt.createDiv({ cls: "pc-ac-shield-label-bot", text: "CLASS" });
  }
}
