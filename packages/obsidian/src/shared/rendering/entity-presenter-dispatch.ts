import * as yaml from "js-yaml";
import type { Archivist, EntityDoc, ParseResult } from "@archivist/core";
import type { EntityPresenter, RenderContext } from "./entity-presenter";

// Module-level refs, injected by main.ts at plugin load (shared/ must not
// import modules/ — the shared-tree invariant — so the presenter map arrives
// by setter, exactly as the old compendium-ref registry did).
let presenters: ReadonlyMap<string, EntityPresenter> | null = null;
let kernel: Archivist | null = null;
let pluginRef: unknown = null;

export function setEntityPresenters(map: ReadonlyMap<string, EntityPresenter>): void {
  presenters = map;
}
export function setEntityPresenterKernel(archivist: Archivist): void {
  kernel = archivist;
}
export function setEntityPresenterPlugin(plugin: unknown): void {
  pluginRef = plugin;
}

export function getEntityPresenter(type: string): EntityPresenter | undefined {
  return presenters?.get(type);
}

/**
 * Kernel-only parse for a registered entity's YAML. Returns null (never
 * throws) when the kernel owns no codec for `type` — generate-only types
 * (npc/encounter) and unknown types keep their existing fallback rendering.
 */
export function parseRegisteredEntity(type: string, yamlStr: string): ParseResult<unknown> | null {
  const et = kernel?.getEntityType(type);
  if (!et?.doc) return null;
  const doc: EntityDoc = { type, frontmatter: {}, body: yamlStr, raw: yamlStr };
  return et.doc.parse(doc);
}

export interface EntityLike {
  entityType: string;
  data: Record<string, unknown>;
}

/**
 * Parse (kernel codec) + render (presenter) a registered entity into `host`.
 * Presenter-lookup-first: no presenter → null. No codec / parse fail → null.
 * Callers keep their existing not-found / plain-text / name-line fallbacks.
 */
export function renderRegisteredEntity(
  entity: EntityLike,
  host: HTMLElement,
  columns: number | undefined,
): HTMLElement | null {
  const presenter = getEntityPresenter(entity.entityType);
  if (!presenter) return null;
  const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
  const result = parseRegisteredEntity(entity.entityType, yamlStr);
  if (!result || !result.success) return null;
  const ctx: RenderContext = {
    plugin: pluginRef,
    ctx: null,
    ...(presenter.supportsColumns ? { columns } : {}),
  };
  const appended = presenter.render(host, result.data, ctx);
  return appended ?? (host.lastElementChild as HTMLElement | null);
}
