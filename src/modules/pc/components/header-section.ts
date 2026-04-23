import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ComponentRegistry } from "./component-registry";
import type { ResolvedCharacter } from "../pc.types";

/**
 * V7 hero: crest + name/subtitle on the left, right cluster with AC shield,
 * HP widget, and Hit Dice widget. Rest buttons removed; alignment dropped
 * from the subtitle.
 */
export class HeaderSection implements SheetComponent {
  readonly type = "header-section";

  constructor(private readonly registry: ComponentRegistry) {}

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-header-root" });

    const avatar = root.createDiv({ cls: "pc-avatar" });
    avatar.createDiv({ cls: "pc-avatar-placeholder" });

    const identity = root.createDiv({ cls: "pc-identity" });
    identity.createEl("h1", { cls: "pc-name", text: ctx.resolved.definition.name });
    identity.createDiv({ cls: "pc-subtitle", text: buildSubtitle(ctx.resolved) });

    const right = root.createDiv({ cls: "pc-hero-right" });
    for (const type of ["ac-shield", "hp-widget", "hit-dice-widget"] as const) {
      const c = this.registry.get(type);
      if (!c) {
        right.createDiv({ cls: "pc-empty-line", text: `(No renderer for ${type})` });
        continue;
      }
      c.render(right, ctx);
    }
  }
}

export function buildSubtitle(resolved: ResolvedCharacter): string {
  const parts: string[] = [];
  const raceName = resolved.race?.name ?? prettySlug(stripSlugRef(resolved.definition.race));
  const subraceName = resolved.definition.subrace ? prettySlug(stripSlugRef(resolved.definition.subrace)) : null;
  if (raceName) parts.push(subraceName ? `${subraceName} ${raceName}` : raceName);

  const classLabel = resolved.classes
    .map((c) => {
      const cname = c.entity?.name ?? prettySlug(stripSlugRef(c.entity ? `[[${c.entity.slug}]]` : null) ?? "?");
      const sname = c.subclass?.name ? ` (${c.subclass.name})` : "";
      return `${cname}${sname} ${c.level}`;
    })
    .join(" / ");
  if (classLabel.trim()) parts.push(classLabel);

  if (resolved.background?.name) parts.push(resolved.background.name);
  // Alignment intentionally dropped in V7.
  return parts.join(" • ");
}

function stripSlugRef(ref: string | null): string | null {
  if (!ref) return null;
  const m = ref.match(/^\[\[(.+?)\]\]$/);
  return m ? m[1] : ref;
}

function prettySlug(slug: string | null): string | null {
  if (!slug) return null;
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
