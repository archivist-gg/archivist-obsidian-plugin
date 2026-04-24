import type { CoreAPI } from "../../core/module-api";
import type { ComponentRegistry } from "./components/component-registry";
import type { ComponentRenderContext } from "./components/component.types";
import type { ResolvedCharacter, DerivedStats } from "./pc.types";
import type { CharacterEditState } from "./pc.edit-state";

export interface RenderSheetOptions {
  root: HTMLElement;
  resolved: ResolvedCharacter;
  derived: DerivedStats;
  registry: ComponentRegistry;
  editState: CharacterEditState | null;
  core: CoreAPI;
  warnings: string[];
}

/**
 * Pure DOM render of a resolved + derived PC into `root`. Clears the root
 * first. Top strip → ability row → combat stats → 2-col body. Warnings get
 * a banner at the very top.
 */
export function renderPCSheet(opts: RenderSheetOptions): void {
  const { root, resolved, derived, registry, core, warnings } = opts;
  const prevScroll = root.scrollTop;
  root.empty();
  const sheet = root.createDiv({ cls: "archivist-pc-sheet" });

  if (warnings.length > 0) renderWarnings(sheet, warnings);

  const ctx: ComponentRenderContext = { resolved, derived, core, editState: opts.editState };

  // 1. Hero (AC / HP / HD rendered internally by HeaderSection)
  safeRender(sheet, "pc-hero", "header-section", registry, ctx);

  // 2. Stats band — free-floating abilities (left) + right cluster
  const band = sheet.createDiv({ cls: "pc-stats-band" });
  safeRender(band, "pc-abilities", "ability-row", registry, ctx);
  const right = band.createDiv({ cls: "pc-stats-right" });
  safeRender(right, "pc-stats-tiles-wrap", "stats-tiles", registry, ctx);
  safeRender(right, "pc-def-cond-wrap", "defenses-conditions-panel", registry, ctx);

  // 3. Body — trimmed sidebar (skills / senses / proficiencies) + tabs
  const body = sheet.createDiv({ cls: "pc-body" });
  const sidebar = body.createDiv({ cls: "pc-sidebar" });
  for (const type of ["skills-panel", "senses-panel", "proficiencies-panel"]) {
    safeRender(sidebar, `pc-${type}`, type, registry, ctx, { wrap: false });
  }
  const content = body.createDiv({ cls: "pc-content" });
  safeRender(content, "pc-tabs", "tabs-container", registry, ctx, { wrap: false });

  root.scrollTop = prevScroll;
}

/**
 * Clear-render an error banner with a "Go to markdown" fallback button.
 */
export function renderPCSheetError(root: HTMLElement, message: string, onFallback: () => void): void {
  root.empty();
  const err = root.createDiv({ cls: "archivist-pc-error" });
  err.createEl("h2", { text: "Cannot render character sheet" });
  err.createEl("p", { text: message });
  const btn = err.createEl("button", { cls: "mod-cta", text: "Edit as Markdown" });
  btn.addEventListener("click", onFallback);
}

function renderWarnings(root: HTMLElement, warnings: string[]) {
  const box = root.createDiv({ cls: "archivist-pc-warnings" });
  box.createEl("strong", { text: "Warnings:" });
  const ul = box.createEl("ul");
  for (const w of warnings) ul.createEl("li", { text: w });
}

function safeRender(
  parent: HTMLElement,
  wrapperCls: string,
  componentType: string,
  registry: ComponentRegistry,
  ctx: ComponentRenderContext,
  opts: { wrap?: boolean } = { wrap: true },
) {
  const component = registry.get(componentType);
  const host = opts.wrap === false ? parent : parent.createDiv({ cls: wrapperCls });
  if (!component) {
    host.createDiv({ cls: "pc-empty-line", text: `(No renderer for ${componentType})` });
    return;
  }
  component.render(host, ctx);
}
