import type { SheetComponent, ComponentRenderContext } from "../components/component.types";
import type { ClassEntity } from "../../class/class.types";
import type { ResolvedClass } from "../pc.types";
import type { Feature } from "../../../shared/types";

export class ClassBlock implements SheetComponent {
  readonly type = "class-block";

  render(el: HTMLElement, ctx: ComponentRenderContext): void {
    for (const rc of ctx.resolved.classes) {
      if (!rc.entity) continue;
      this.renderSingleClass(el, rc);
    }
  }

  private renderSingleClass(el: HTMLElement, rc: ResolvedClass) {
    const e = rc.entity as ClassEntity;
    const section = el.createDiv({ cls: "pc-block pc-class-block" });
    section.createEl("h3", { cls: "pc-block-title", text: `${e.name} — Level ${rc.level}` });

    const meta = section.createDiv({ cls: "pc-block-meta" });
    metaItem(meta, "Hit Die", e.hit_die);
    metaItem(meta, "Saves", (e.saving_throws ?? []).map((s) => s.toUpperCase()).join(", ") || "—");
    if (e.primary_abilities?.length) metaItem(meta, "Primary", e.primary_abilities.map((a) => a.toUpperCase()).join(", "));

    const byLevel = e.features_by_level ?? {};
    const relevantLevels = Object.keys(byLevel).map(Number).filter((n) => !Number.isNaN(n) && n <= rc.level).sort((a, b) => a - b);
    if (relevantLevels.length === 0) return;

    section.createEl("h4", { cls: "pc-block-subtitle", text: "Features" });
    const list = section.createEl("ul", { cls: "pc-feature-list" });
    for (const lvl of relevantLevels) {
      for (const feat of byLevel[lvl] ?? []) {
        const li = list.createEl("li", { cls: "pc-feature-item" });
        li.createEl("strong", { text: `Level ${lvl} — ${feat.name}` });
        const desc = resolveFeatureDescription(feat, rc.choices[lvl]);
        if (desc) li.createDiv({ cls: "pc-feature-desc", text: desc });
      }
    }
  }
}

function metaItem(parent: HTMLElement, label: string, value: string) {
  const line = parent.createDiv({ cls: "pc-meta-line" });
  line.createSpan({ cls: "pc-meta-label", text: `${label}: ` });
  line.createSpan({ cls: "pc-meta-val", text: value });
}

/**
 * If the feature describes a choice and the character recorded a choice value
 * at this level, append a "Chose: …" line after the description. Otherwise
 * return the raw description.
 */
export function resolveFeatureDescription(feature: Feature, choice: unknown): string {
  const base = feature.description ?? feature.entries?.join(" ") ?? "";
  if (!choice || typeof choice !== "object") return base;
  const parts: string[] = [];
  const c = choice as Record<string, unknown>;
  if (Array.isArray(c.skills) && c.skills.length) parts.push(`Skills: ${(c.skills as string[]).map(prettify).join(", ")}`);
  if (Array.isArray(c.expertise) && c.expertise.length) parts.push(`Expertise: ${(c.expertise as string[]).map(prettify).join(", ")}`);
  if (Array.isArray(c.languages) && c.languages.length) parts.push(`Languages: ${(c.languages as string[]).map(prettify).join(", ")}`);
  if (typeof c.feat === "string") parts.push(`Feat: ${prettify(c.feat.replace(/\[\[|\]\]/g, ""))}`);
  if (typeof c["fighting-style"] === "string") parts.push(`Fighting Style: ${prettify(c["fighting-style"])}`);
  if (parts.length === 0) return base;
  return base ? `${base}\n\nChose: ${parts.join("; ")}` : `Chose: ${parts.join("; ")}`;
}

function prettify(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
