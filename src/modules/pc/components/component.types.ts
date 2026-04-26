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
  /**
   * The panel id of the tab currently active in the parent view (e.g.
   * `"panel-inventory"`). Lifted up so it survives re-renders triggered by
   * editState mutations — without this, every onChange would empty the
   * container and TabsContainer would reset to the first tab. Optional so
   * existing test fixtures that don't pass it fall back to the historical
   * "first tab is active" behavior.
   */
  activeTabId?: string;
  /**
   * Callback fired when the user clicks a different tab. The parent view
   * uses this to remember the new selection so the next re-render keeps
   * the user where they were. Optional for the same backward-compat reason.
   */
  onActiveTabChange?: (panelId: string) => void;
}

export interface SheetComponent {
  readonly type: string;
  render(el: HTMLElement, ctx: ComponentRenderContext): void;
}
