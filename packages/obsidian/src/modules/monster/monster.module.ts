import type {
  ArchivistModule,
  CoreAPI,
  EditContext,
  ModalConstructor,
  ParseResult,
  RenderContext,
} from "../../core/module-api";
import type { Monster } from "@archivist/dnd5e/monster/monster.types";
import { parseMonster } from "@archivist/dnd5e/monster/monster.parser";
import { renderMonsterBlock } from "./monster.renderer";
import { renderMonsterEditMode } from "./edit/monster-edit-render";
import { MonsterModal } from "./monster.modal";

// TODO(phase1): narrow RenderContext.plugin to a typed host-plugin handle
// so modules don't need to reach into src/main for the concrete class.
import type ArchivistPlugin from "../../main";

/**
 * The monster module.
 *
 * This module is the self-contained home for every monster-specific
 * concern: YAML parsing, read-mode rendering, edit-mode UI, and the
 * "Insert monster" modal. (AI generation is owned by the dnd5e pack's
 * `monsterGeneratable` + the generation bridge, not this module.)
 */
class MonsterModule implements ArchivistModule {
  readonly id = "monster";
  readonly codeBlockType = "monster";
  readonly entityType = "monster";
  readonly supportsColumns = true;

  register(_core: CoreAPI): void {
    // No-op: monster module is stateless; all wiring happens via the
    // generic code-block processor and compendium-ref registry lookups.
  }

  parseYaml(source: string): ParseResult<Monster> {
    return parseMonster(source);
  }

  render(el: HTMLElement, data: unknown, ctx: RenderContext): HTMLElement {
    const monster = data as Monster;
    const columns = ctx.columns ?? monster.columns ?? 1;
    const block = renderMonsterBlock(monster, columns);
    el.appendChild(block);
    return block;
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const monster = data as Monster;
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderMonsterEditMode>[2];
    renderMonsterEditMode(monster, el, mdCtx, plugin, ctx.onExit, ctx.compendium, ctx.onReplaceRef);
  }

  getInsertModal(): ModalConstructor {
    // MonsterModal's `(app, editor)` constructor satisfies ModalConstructor's
    // `new (app, ...never[]) => { open(): void }` shape directly — the rest
    // parameter is contravariant so any stricter tuple is assignable.
    return MonsterModal;
  }
}

export const monsterModule: ArchivistModule = new MonsterModule();
