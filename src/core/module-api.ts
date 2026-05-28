import type { App, Editor } from "obsidian";
import type { EntityRegistry } from "../shared/entities/entity-registry";
import type { CompendiumManager } from "../shared/entities/compendium-manager";
import type { SrdStore } from "../shared/ai/srd-store";
import type { ModuleRegistry } from "./module-registry";
import type { ParseResult } from "../shared/parsers/yaml-utils";

export type { ParseResult };

export interface RenderContext {
  plugin: unknown;
  ctx: unknown;
  /** Optional column layout hint. Modules that declare `supportsColumns`
   *  on their ArchivistModule entry read this; others ignore it. */
  columns?: number;
}

export interface EditContext extends RenderContext {
  source: string;
  /** Called by the module's edit-mode renderer to exit back to view mode
   *  when no content change triggers Obsidian to re-render the block
   *  (e.g. cancel with no edits, save with identical YAML). */
  onExit?: () => void;
  /** Optional compendium provenance when editing a {{type:slug}} ref from
   *  compendium-ref-extension. Present for compendium-sourced blocks, absent
   *  when editing an inline code-fence. */
  compendium?: { slug: string; compendium: string; readonly: boolean };
  /** Replace the {{type:slug}} text in the host document. Provided by the
   *  compendium-ref caller; unused by the standard code-block processor. */
  onReplaceRef?: (newRefText: string) => void;
}

/**
 * A tool entry in the AI-tool registry.
 *
 * Modules register two parallel shapes:
 *   - `definition` — structured metadata (name/description/schema/execute)
 *     useful for generic listing / dispatch.
 *   - `sdkTool` — opaque value accepted by `createSdkMcpServer({ tools })`.
 *     Held as `unknown` so the shared registry doesn't pull in the SDK type.
 */
export interface AIToolDefinition {
  name: string;
  description: string;
  schema: unknown;
  execute: (input: unknown) => Promise<unknown>;
}

export interface AIToolRegistry {
  register(tool: AIToolDefinition): void;
  /** Register the raw SDK-tool handle (output of `tool()` from
   *  @anthropic-ai/claude-agent-sdk). Used by mcp-server wiring. */
  registerSdkTool?(sdkTool: unknown): void;
  /** Retrieve all structured definitions. */
  getAll?(): AIToolDefinition[];
  /** Retrieve all raw SDK-tool handles for passing to createSdkMcpServer. */
  getAllSdkTools?(): unknown[];
}

/**
 * The constructor shape a module's "Insert entity" modal must satisfy.
 *
 * Every insert modal in the codebase takes `(app: App, editor: Editor)` and
 * inherits `open(): void` from Obsidian's `Modal`. Typing the contract with
 * those exact parameters lets concrete `Modal` subclasses be returned from
 * `getInsertModal()` without a cast, and lets the insert-command dispatcher
 * construct them directly.
 */
export type ModalConstructor = new (app: App, editor: Editor) => { open(): void };

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
  /** Register AI generation tools with the tool registry. */
  registerAITools?(registry: AIToolRegistry): void;
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
