import type { SheetComponent, ComponentRenderContext } from "../component.types";
import type { ResolvedEquipped } from "../../pc.types";
import { AttunementStrip } from "./attunement-strip";
import { CurrencyStrip } from "./currency-strip";

export interface HeaderStripOptions {
  onPickEmpty?: (slotIndex: number) => void;
  onClickFilled?: (occupant: ResolvedEquipped, anchor: HTMLElement) => void;
}

export class HeaderStrip implements SheetComponent {
  readonly type = "header-strip";

  render(el: HTMLElement, ctx: ComponentRenderContext, options?: HeaderStripOptions): void {
    const strip = el.createDiv({ cls: "pc-header-strip" });

    const attune = strip.createDiv({ cls: "pc-header-attune" });
    new AttunementStrip(options ?? {}).render(attune, ctx);

    strip.createDiv({ cls: "pc-header-divider" });

    const currency = strip.createDiv({ cls: "pc-header-currency" });
    new CurrencyStrip().render(currency, ctx);
  }
}
