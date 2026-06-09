import * as yaml from "js-yaml";
import type { CoreAPI, RenderContext } from "../../../../core/module-api";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";

/** Render a registered entity's real stat block via its owning module — the
 *  same dispatch compendium-ref-extension uses (yaml.dump → parseYaml →
 *  render). Falls back to a plain name line when the type has no
 *  module/renderer or the round-trip parse fails. Returns the host div. */
export function renderEntityBlock(
  parent: HTMLElement,
  entity: RegisteredEntity,
  core: CoreAPI,
): HTMLElement {
  const host = parent.createDiv({ cls: "pc-bblock" });
  const mod = core.modules.getByEntityType(entity.entityType);
  if (!mod?.parseYaml || !mod.render) {
    host.createDiv({ cls: "pc-bblock-fallback", text: entity.name });
    return host;
  }
  const parsed = mod.parseYaml(yaml.dump(entity.data, { lineWidth: -1 }));
  if (!parsed.success) {
    host.createDiv({ cls: "pc-bblock-fallback", text: entity.name });
    return host;
  }
  const ctx: RenderContext = { plugin: core.plugin, ctx: null };
  try {
    mod.render(host, parsed.data, ctx);
  } catch (err) {
    // A synchronous crash in the module's render (e.g. a missing DOM helper)
    // must never leave the pane silently empty — fall back to the name line.
    console.error("[Archivist] entity block dispatch failed", err);
    host.createDiv({ cls: "pc-bblock-fallback", text: entity.name });
  }
  return host;
}
