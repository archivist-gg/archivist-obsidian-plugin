import type { App } from "obsidian";
import type { PCServices } from "../pc.services";
import type { ResolvedCharacter, DerivedStats } from "@archivist/dnd5e/pc/pc.types";
import type { CharacterEditState } from "../pc.edit-state";

export interface ComponentRenderContext {
  resolved: ResolvedCharacter;
  derived: DerivedStats;
  services: PCServices;
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
  /**
   * The Builder step currently active in the parent view. Lifted to
   * PCSheetView (like activeTabId) so it survives editState re-renders and
   * never leaks across files/leaves through the singleton BuilderView.
   */
  activeStepId?: string;
  /** Callback fired when the user moves to a different Builder step. */
  onActiveStepChange?: (stepId: string) => void;
  /**
   * Per-loaded-file bag for transient Builder UI state (search queries,
   * ticked compendiums, expanded rows, focused detail). Owned by PCSheetView,
   * reset on file switch only. Components key into it with a stateKey and
   * type-narrow their own entry; the view never inspects contents.
   */
  builderUiState?: Map<string, unknown>;
}

export interface SheetComponent {
  readonly type: string;
  render(el: HTMLElement, ctx: ComponentRenderContext): void;
}
