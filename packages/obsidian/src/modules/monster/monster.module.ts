import type {
  EditContext,
  EntityPresenter,
  ModalConstructor,
  RenderContext,
} from "../../shared/rendering/entity-presenter";
import type { Monster } from "@archivist/dnd5e/monster/monster.types";
import { renderMonsterBlock } from "./monster.renderer";
import { renderMonsterEditMode } from "./edit/monster-edit-render";
import { MonsterModal } from "./monster.modal";

// The plugin cast below is the documented accepted seam (convention doc §6 /
// 0f spec §0.2): RenderContext.plugin stays `unknown`; edit renderers cast to
// the concrete plugin class via a type-only import.
import type ArchivistPlugin from "../../main";

/**
 * The monster presenter: how a monster is DRAWN — read-mode block, edit-mode
 * UI, and the "Insert monster" modal. Parsing lives in the dnd5e pack codec;
 * AI generation lives in the pack's `monsterGeneratable` + generation bridge.
 */
class MonsterModule implements EntityPresenter {
  readonly type = "monster";
  readonly supportsColumns = true;

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
    return MonsterModal;
  }
}

export const monsterModule: EntityPresenter = new MonsterModule();
