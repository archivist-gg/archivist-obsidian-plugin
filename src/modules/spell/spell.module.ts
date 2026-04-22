import type { App, Editor } from "obsidian";
import type {
  AIToolRegistry,
  ArchivistModule,
  CoreAPI,
  EditContext,
  ModalConstructor,
  ParseResult,
  RenderContext,
} from "../../core/module-api";
import type { Spell } from "./spell.types";
import { parseSpell } from "./spell.parser";
import { renderSpellBlock } from "./spell.renderer";
import { renderSpellEditMode } from "./spell.edit-render";
import { SpellModal } from "./spell.modal";
import { generateSpellTool } from "./spell.ai-tools";

// TODO(phase0-task13): ArchivistPlugin typing will flow through
// ctx.plugin once the module registry wires plugin access generically.
import type ArchivistPlugin from "../../main";

/**
 * The spell module.
 *
 * This module is the self-contained home for every spell-specific
 * concern: YAML parsing, read-mode rendering, edit-mode UI, AI-tool
 * registration, and the "Insert spell" modal.
 *
 * Not yet wired into the plugin — Task 12 replaces the direct imports
 * in `main.ts` / `compendium-ref-extension.ts` with registry dispatch
 * that flows through `register()` here.
 */
class SpellModule implements ArchivistModule {
  readonly id = "spell";
  readonly codeBlockType = "spell";
  readonly entityType = "spell";

  register(_core: CoreAPI): void {
    // Task 12 populates this: the registry calls register() during
    // plugin load, and the module stashes any core handles (e.g. the
    // compendium manager) it needs for later callbacks. At Task 9 we
    // only need the module to type-check.
  }

  parseYaml(source: string): ParseResult<Spell> {
    return parseSpell(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): void {
    const spell = data as Spell;
    const block = renderSpellBlock(spell);
    el.appendChild(block);
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const spell = data as Spell;
    // ctx.plugin / ctx.ctx are typed as `unknown` on the interface;
    // the spell edit-render currently needs the concrete plugin
    // type. Task 12 narrows this when the registry adds a typed
    // plugin accessor.
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderSpellEditMode>[2];
    renderSpellEditMode(spell, el, mdCtx, plugin);
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateSpellTool.name,
      description: generateSpellTool.description,
      schema: generateSpellTool.inputSchema,
      execute: async (input: unknown) => {
        const args = input as Parameters<typeof generateSpellTool.handler>[0];
        return generateSpellTool.handler(args, {});
      },
    });
  }

  getInsertModal(): ModalConstructor {
    // SpellModal's constructor is (app, editor); the ArchivistModule
    // contract widens the trailing args to `...unknown[]`, which is
    // compatible here.
    return SpellModal as unknown as new (app: App, editor: Editor) => unknown as ModalConstructor;
  }
}

export const spellModule: ArchivistModule = new SpellModule();
