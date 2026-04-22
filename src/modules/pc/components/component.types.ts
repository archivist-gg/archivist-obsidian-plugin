import type { CoreAPI } from "../../../core/module-api";
import type { ResolvedCharacter, DerivedStats } from "../pc.types";

export interface ComponentRenderContext {
  resolved: ResolvedCharacter;
  derived: DerivedStats;
  core: CoreAPI;
}

export interface SheetComponent {
  readonly type: string;
  render(el: HTMLElement, ctx: ComponentRenderContext): void;
}
