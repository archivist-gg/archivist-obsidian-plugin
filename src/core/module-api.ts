import type { App } from "obsidian";
import type { EntityRegistry } from "../shared/entities/entity-registry";
import type { CompendiumManager } from "../shared/entities/compendium-manager";
import type { SrdStore } from "../shared/ai/srd-store";
import type { ModuleRegistry } from "./module-registry";
import type { ParseResult } from "../shared/parsers/yaml-utils";

export type { ParseResult };

export interface RenderContext {
  plugin: unknown;
  ctx: unknown;
}

export interface EditContext extends RenderContext {
  source: string;
  /** Called by the module's edit-mode renderer to exit back to view mode
   *  when no content change triggers Obsidian to re-render the block
   *  (e.g. cancel with no edits, save with identical YAML). */
  onExit?: () => void;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  schema: unknown;
  execute: (input: unknown) => Promise<unknown>;
}

export interface AIToolRegistry {
  register(tool: AIToolDefinition): void;
}

export type ModalConstructor = new (app: App, ...args: unknown[]) => unknown;

export interface ArchivistModule {
  /** Unique module identifier */
  id: string;
  /** Code block language tag (e.g. "monster", "spell", "pc"). Optional — inquiry has none. */
  codeBlockType?: string;
  /** Compendium entity type. Optional — inquiry has none. */
  entityType?: string;
  /** Called once on plugin load. Module registers itself with core. */
  register(core: CoreAPI): void;
  /** Parse YAML source → typed entity. Only if codeBlockType is set. */
  parseYaml?(source: string): ParseResult<unknown>;
  /** Render entity into DOM element. Only if codeBlockType is set. */
  render?(el: HTMLElement, data: unknown, ctx: RenderContext): void;
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
