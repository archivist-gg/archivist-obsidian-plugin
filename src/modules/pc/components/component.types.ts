import type { App } from "obsidian";
import type { CoreAPI } from "../../../core/module-api";
import type { ResolvedCharacter, DerivedStats } from "../pc.types";
import type { CharacterEditState } from "../pc.edit-state";

export interface ComponentRenderContext {
  resolved: ResolvedCharacter;
  derived: DerivedStats;
  core: CoreAPI;
  /** Obsidian App handle. Components needing Modals/Notice should use this
   *  rather than `window`/`activeWindow`, since Electron's renderer blocks
   *  native `window.prompt`/`alert`/`confirm` at runtime. */
  app: App;
  editState: CharacterEditState | null;
}

export interface SheetComponent {
  readonly type: string;
  render(el: HTMLElement, ctx: ComponentRenderContext): void;
}
