import type { SheetComponent, ComponentRenderContext } from "./component.types";
import type { ResolvedCharacter } from "../pc.types";

export class HeaderSection implements SheetComponent {
  readonly type = "header-section";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    const root = el.createDiv({ cls: "pc-header-root" });

    const avatar = root.createDiv({ cls: "pc-avatar" });
    avatar.createDiv({ cls: "pc-avatar-placeholder" });

    const identity = root.createDiv({ cls: "pc-identity" });
    identity.createEl("h1", { cls: "pc-name", text: ctx.resolved.definition.name });
    identity.createDiv({ cls: "pc-subtitle", text: buildSubtitle(ctx.resolved) });

    const actions = root.createDiv({ cls: "pc-header-actions" });
    const shortRest = actions.createEl("button", { cls: "pc-rest-btn", text: "Short rest" });
    shortRest.setAttribute("disabled", "true");
    shortRest.setAttribute("title", "Interactive rest flows arrive later");
    const longRest = actions.createEl("button", { cls: "pc-rest-btn", text: "Long rest" });
    longRest.setAttribute("disabled", "true");
    longRest.setAttribute("title", "Interactive rest flows arrive later");
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
  if (resolved.definition.alignment) parts.push(resolved.definition.alignment);
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
