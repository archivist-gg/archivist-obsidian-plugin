import type { ComponentRenderContext } from "../component.types";
import { classSpellCandidates } from "./spell-access";

type SourceFilter = "all" | "2014" | "2024";

/** Inline add-spell drawer. Themed controls; Source filter; ＋ is an
 *  add/remove toggle reflecting known-state. Stays open for bulk adds. */
export function renderAddDrawer(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const drawer = parent.createDiv({ cls: "pc-spell-adddrawer" });
  let showAll = false;
  let query = "";
  let source: SourceFilter = "all";

  const bar = drawer.createDiv({ cls: "pc-spell-filters" });
  const search = bar.createEl("input", { cls: "pc-spell-search", attr: { type: "text", placeholder: "Search spells…" } });
  const allBtn = bar.createEl("button", { cls: "pc-spell-filter", text: "All classes" });
  const srcGroup = bar.createDiv({ cls: "pc-spell-fgroup" });
  srcGroup.createSpan({ cls: "pc-spell-flabel", text: "Source" });
  const srcBtns: Record<SourceFilter, HTMLElement> = {
    all: srcGroup.createEl("button", { cls: "pc-spell-filter active", text: "All" }),
    "2014": srcGroup.createEl("button", { cls: "pc-spell-filter", text: "2014" }),
    "2024": srcGroup.createEl("button", { cls: "pc-spell-filter", text: "2024" }),
  };
  const list = drawer.createDiv({ cls: "pc-add-list" });

  const classSlugs = ctx.derived.spellcastingClasses.map((c) => c.classSlug);
  const maxLevel = Math.max(
    0,
    ...Object.keys(ctx.derived.derivedSpellSlots).map(Number),
    ctx.derived.pactMagic?.level ?? 0,
  );
  const knownSet = () => new Set(ctx.resolved.spells.map((s) => s.slug));

  const editionOf = (entity: { edition?: string }): SourceFilter | null =>
    entity.edition === "2014" ? "2014" : entity.edition === "2024" ? "2024" : null;

  const draw = () => {
    list.empty();
    const known = knownSet();
    // Pass an empty known-set to the candidate filter so already-known spells
    // still appear (as removable toggles); we compute known-state per row below.
    const cands = classSpellCandidates(ctx.core.entities, classSlugs, maxLevel, new Set(), showAll, query)
      .filter((c) => {
        if (source === "all") return true;
        return editionOf(c.entity) === source;
      });
    if (!cands.length) {
      list.createDiv({ cls: "pc-spell-pick-meta", text: "No matching spells." });
      return;
    }
    for (const c of cands.slice(0, 300)) {
      const row = list.createDiv({ cls: "pc-add-row" });
      const isKnown = known.has(c.slug);
      const toggle = row.createEl("button", { cls: `pc-add-toggle${isKnown ? " on" : ""}`, text: isKnown ? "✓" : "＋" });
      const name = row.createSpan({ cls: `pc-add-row-name${isKnown ? " on" : ""}`, text: c.name });
      const ed = editionOf(c.entity);
      if (ed) name.parentElement!.createSpan({ cls: `pc-spell-srctag e${ed}`, text: ed });
      row.createSpan({ cls: "pc-add-row-lvl", text: c.level === 0 ? "cantrip" : `lvl ${c.level}` });
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        if (known.has(c.slug)) ctx.editState?.removeKnownSpell(c.slug);
        else ctx.editState?.addKnownSpell(c.slug, { class: classSlugs[0] });
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
  (Object.keys(srcBtns) as SourceFilter[]).forEach((k) => {
    srcBtns[k].addEventListener("click", () => {
      source = k;
      (Object.keys(srcBtns) as SourceFilter[]).forEach((j) => srcBtns[j].classList.toggle("active", j === k));
      draw();
    });
  });
  draw();
}
