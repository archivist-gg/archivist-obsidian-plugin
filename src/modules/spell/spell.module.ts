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

// TODO(phase1): narrow RenderContext.plugin to a typed host-plugin handle
// so modules don't need to reach into src/main for the concrete class.
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
    // No-op: spell module is stateless; all wiring happens via the
    // generic code-block processor and compendium-ref registry lookups.
  }

  parseYaml(source: string): ParseResult<Spell> {
    return parseSpell(source);
  }

  render(el: HTMLElement, data: unknown, _ctx: RenderContext): HTMLElement {
    const spell = data as Spell;
    // Stable wrapper held by the host as `rendered`; the async renderer fills
    // it as a child instead of replacing it. If we used placeholder.replaceWith,
    // the host's `rendered` reference would point at a detached node after the
    // swap, and `rendered.remove()` in enterEditMode would no-op — leaving the
    // view block visible underneath the edit form.
    const wrapper = el.doc.createElement("div");
    el.appendChild(wrapper);
    void renderSpellBlock(spell).then((block) => {
      wrapper.appendChild(block);
    });
    return wrapper;
  }

  renderEditMode(el: HTMLElement, data: unknown, ctx: EditContext): void {
    const spell = data as Spell;
    const plugin = ctx.plugin as ArchivistPlugin;
    const mdCtx = ctx.ctx as Parameters<typeof renderSpellEditMode>[2];
    renderSpellEditMode(spell, el, mdCtx, plugin, ctx.onExit, ctx.compendium, ctx.onReplaceRef);
  }

  registerAITools(registry: AIToolRegistry): void {
    registry.register({
      name: generateSpellTool.name,
      description: generateSpellTool.description,
      schema: generateSpellTool.inputSchema,
      execute: (input: unknown) => {
        const args = input as Parameters<typeof generateSpellTool.handler>[0];
        return generateSpellTool.handler(args, {});
      },
    });
    registry.registerSdkTool?.(generateSpellTool);
  }

  getInsertModal(): ModalConstructor {
    // SpellModal's `(app, editor)` constructor satisfies ModalConstructor's
    // `new (app, ...never[]) => { open(): void }` shape directly — the rest
    // parameter is contravariant so any stricter tuple is assignable.
    return SpellModal;
  }
}

export const spellModule: ArchivistModule = new SpellModule();
