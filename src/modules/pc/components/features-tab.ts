import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";

export class FeaturesTab implements SheetComponent {
  readonly type = "features-tab";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-tab-body pc-features-body" });
    const order = ["class-block", "subclass-block", "race-block", "feat-block"] as const;
    for (const type of order) {
      const component = this.registry.get(type);
      if (!component) continue;
      const wrapper = root.createDiv({ cls: `pc-features-section pc-features-${type}` });
      component.render(wrapper, ctx);
    }
  }
}
