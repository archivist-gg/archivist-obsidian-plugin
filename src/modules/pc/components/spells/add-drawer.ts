import type { ComponentRenderContext } from "../component.types";
import { classSpellCandidates } from "./spell-access";

/** Inline add-spell drawer. Stays open so several spells can be added at once. */
export function renderAddDrawer(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const drawer = parent.createDiv({ cls: "pc-spell-adddrawer" });
  let showAll = false;
  let query = "";

  const bar = drawer.createDiv({ cls: "pc-spell-filters" });
  const search = bar.createEl("input", { attr: { type: "text", placeholder: "Search spells…" } });
  const allBtn = bar.createEl("button", { cls: "pc-spell-filter", text: "All classes" });
  const list = drawer.createDiv({ cls: "pc-add-list" });

  const classSlugs = ctx.derived.spellcastingClasses.map((c) => c.classSlug);
  const maxLevel = Math.max(
    0,
    ...Object.keys(ctx.derived.derivedSpellSlots).map(Number),
    ctx.derived.pactMagic?.level ?? 0,
  );
  const known = () => new Set(ctx.resolved.spells.map((s) => s.slug));

  const draw = () => {
    list.empty();
    const cands = classSpellCandidates(ctx.core.entities, classSlugs, maxLevel, known(), showAll, query);
    if (!cands.length) {
      list.createDiv({ cls: "pc-spell-pick-meta", text: "No matching spells." });
      return;
    }
    for (const c of cands.slice(0, 200)) {
      const row = list.createDiv({ cls: "pc-add-row" });
      const add = row.createEl("button", { cls: "pc-add-row-btn", text: "＋" });
      row.createSpan({ cls: "pc-add-row-name", text: c.name });
      row.createSpan({ cls: "pc-add-row-lvl", text: c.level === 0 ? "cantrip" : `${c.level}` });
      add.addEventListener("click", (e) => {
        e.stopPropagation();
        ctx.editState?.addKnownSpell(c.slug, { class: classSlugs[0] });
      });
    }
  };

  search.addEventListener("input", () => {
    query = search.value;
    draw();
  });
  allBtn.addEventListener("click", () => {
    showAll = !showAll;
    allBtn.classList.toggle("active", showAll);
    draw();
  });
  draw();
}
