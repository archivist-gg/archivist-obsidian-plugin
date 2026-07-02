import type { RegisteredEntity } from "@archivist/core";
import { renderRegisteredEntity } from "../../../../shared/rendering/entity-presenter-dispatch";

/** Render a registered entity's real stat block via the shared presenter
 *  dispatch — the same path the compendium-ref view/reading modes use.
 *  Falls back to a plain name line when the type has no presenter/codec,
 *  the parse fails, or the render crashes synchronously. Returns the host. */
export function renderEntityBlock(parent: HTMLElement, entity: RegisteredEntity): HTMLElement {
  const host = parent.createDiv({ cls: "pc-bblock" });
  try {
    const rendered = renderRegisteredEntity(entity, host, undefined);
    if (!rendered) {
      host.createDiv({ cls: "pc-bblock-fallback", text: entity.name });
    }
  } catch (err) {
    // A synchronous crash in the presenter's render must never leave the
    // pane silently empty — fall back to the name line.
    console.error("[Archivist] entity block dispatch failed", err);
    host.createDiv({ cls: "pc-bblock-fallback", text: entity.name });
  }
  return host;
}
