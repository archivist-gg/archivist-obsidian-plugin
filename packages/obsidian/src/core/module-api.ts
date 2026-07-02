import type { EntityRegistry } from "@archivist/core";
import type { CompendiumManager } from "../shared/entities/compendium-manager";
import type { SrdStore } from "@archivist/dnd5e";
import type { ModuleRegistry } from "./module-registry";
import type { ParseResult } from "@archivist/core";
import type { RenderContext, EditContext, ModalConstructor } from "../shared/rendering/entity-presenter";

export type { ParseResult };
export type { RenderContext, EditContext, ModalConstructor };

export interface AIToolRegistry {
  /** Register the raw SDK-tool handle (output of `tool()` from
   *  @anthropic-ai/claude-agent-sdk). Used by mcp-server wiring. */
  registerSdkTool?(sdkTool: unknown): void;
  /** Retrieve all raw SDK-tool handles for passing to createSdkMcpServer. */
  getAllSdkTools?(): unknown[];
}

export interface ArchivistModule {
  /** Unique module identifier */
  id: string;
  /** Code block language tag (e.g. "monster", "spell", "pc"). Optional — inquiry has none. */
  codeBlockType?: string;
  /** Compendium entity type. Optional — inquiry has none. */
  entityType?: string;
  /** Whether this module's renderer honors `RenderContext.columns` and
   *  whether callers should show a column-toggle side button. Defaults false. */
  supportsColumns?: boolean;
  /** Called once on plugin load. Module registers itself with core. */
  register(core: CoreAPI): void;
  /** Parse YAML source → typed entity. Only if codeBlockType is set. */
  parseYaml?(source: string): ParseResult<unknown>;
  /** Render entity into DOM element. Modules return the rendered node they
   *  appended to `el` so that callers performing in-place swaps (e.g. the
   *  column-toggle re-render) can replace it directly. Returning `void` is
   *  permitted for modules that don't need swap support. */
  render?(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement | void;
  /** Render edit mode UI. Only if module supports editing. */
  renderEditMode?(el: HTMLElement, data: unknown, ctx: EditContext): void;
  /** Return modal constructor for "Insert Entity" command. */
  getInsertModal?(): ModalConstructor | null;
  /** Tear down: called on plugin unload. */
  destroy?(): Promise<void>;
}

export interface CoreAPI {
  plugin: unknown;
  modules: ModuleRegistry;
  entities: EntityRegistry;
  compendiums: CompendiumManager;
  srd: SrdStore;
  aiTools: AIToolRegistry;
}
