import type { CoreAPI } from "../../../core/module-api";
import type { ResolvedCharacter, DerivedStats } from "../pc.types";
import type { CharacterEditState } from "../pc.edit-state";

export interface ComponentRenderContext {
  resolved: ResolvedCharacter;
  derived: DerivedStats;
  core: CoreAPI;
  editState: CharacterEditState | null;
}

export interface SheetComponent {
  readonly type: string;
  render(el: HTMLElement, ctx: ComponentRenderContext): void;
}
