import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";

export class BackgroundTab implements SheetComponent {
  readonly type = "background-tab";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-background-body" });
    const block = this.registry.get("background-block");
    if (!block) {
      root.createDiv({ cls: "pc-empty-line", text: "No background." });
      return;
    }
    block.render(root, ctx);
  }
}
