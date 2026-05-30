import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "../../pc.types";
import { castingTimeBadge, componentLetters, effectTags } from "./spell-display";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";

export interface SpellRowOpts {
  showPrepare: boolean;     // prepared casters only
  castLevels: number[];     // slot levels available to cast at (≥ spell level, with slots)
  isCantrip: boolean;
}

export function renderSpellRow(tbody: HTMLElement, spell: ResolvedSpell, ctx: ComponentRenderContext, opts: SpellRowOpts): void {
  const tr = tbody.createEl("tr", { cls: "pc-action-row" });

  // Prepared box
  const prepCell = tr.createEl("td");
  if (opts.showPrepare && !opts.isCantrip && !spell.alwaysPrepared) {
    const box = prepCell.createSpan({ cls: `pc-prep-box${spell.prepared ? " on" : ""}`, text: spell.prepared ? "✓" : "" });
    box.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.togglePrepared(spell.slug); });
  }

  // Name + school (+ C/R markers)
  const nameCell = tr.createEl("td");
  nameCell.createSpan({ cls: "pc-action-row-name", text: spell.entity.name });
  if (spell.entity.concentration) nameCell.createSpan({ cls: "pc-spell-mk", text: "C" });
  if (spell.entity.ritual) nameCell.createSpan({ cls: "pc-spell-mk", text: "R" });
  nameCell.createDiv({ cls: "pc-action-row-sub", text: spell.entity.school ?? "" });

  // Casting time badge
  const badge = castingTimeBadge(spell.entity.casting_time);
  const timeCell = tr.createEl("td");
  if (badge.kind === "time") timeCell.createSpan({ cls: "pc-action-row-sub", text: badge.label });
  else timeCell.createSpan({ cls: `pc-cost-badge cost-${badge.kind}`, text: badge.label });

  // Range, duration
  tr.createEl("td", { cls: "pc-action-row-sub", text: spell.entity.range ?? "—" });
  tr.createEl("td", { cls: "pc-action-row-sub", text: spell.entity.duration ?? "—" });

  // Components
  const compCell = tr.createEl("td", { cls: "pc-spell-comp" });
  const { letters, material } = componentLetters(spell.entity.components);
  letters.forEach((l, i) => {
    if (i > 0) compCell.createSpan({ text: " " });
    compCell.createSpan({ cls: l === "M" && material ? "mat" : "", text: l });
  });

  // Effect tags
  const effCell = tr.createEl("td");
  for (const t of effectTags(spell)) effCell.createSpan({ cls: "pc-spell-efftag", text: t });

  // Expand on row click
  tr.addEventListener("click", () => toggleExpand(tbody, tr, spell, ctx, opts));
}

function toggleExpand(tbody: HTMLElement, tr: HTMLElement, spell: ResolvedSpell, ctx: ComponentRenderContext, opts: SpellRowOpts): void {
  const next = tr.nextElementSibling;
  if (next && next.classList.contains("pc-action-expand-row")) { next.remove(); return; }

  const exp = tbody.createEl("tr", { cls: "pc-action-expand-row" });
  tr.after(exp);
  const cell = exp.createEl("td", { attr: { colspan: "7" } });
  const inner = cell.createDiv({ cls: "pc-action-expand-inner" });

  // Description (renders exact dice from prose)
  const body = inner.createDiv({ cls: "pc-feature-expand-body" });
  void renderMarkdownDescription(body, spell.entity.description ?? "", ctx.app);

  // Cast controls
  const controls = inner.createDiv({ cls: "pc-feature-expand-attacks" });
  if (opts.isCantrip) {
    const b = controls.createEl("button", { cls: "pc-spell-viewtoggle", text: "Cast" });
    b.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.castCantrip(spell.slug); });
  } else {
    for (const lvl of opts.castLevels) {
      const b = controls.createEl("button", { cls: "pc-spell-viewtoggle", text: `Cast at L${lvl}` });
      b.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.castSpell(spell.slug, lvl); });
    }
    if (spell.entity.ritual) {
      const r = controls.createEl("button", { cls: "pc-spell-viewtoggle", text: "Cast as ritual" });
      r.addEventListener("click", (e) => { e.stopPropagation(); ctx.editState?.castAsRitual(spell.slug); });
    }
  }
}
