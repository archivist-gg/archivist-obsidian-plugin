import type { ComponentRenderContext } from "../component.types";
import { classSpellCandidates, type SpellCandidate } from "./spell-access";
import { renderSpellBlock } from "../../../spell/spell.renderer";
import { compactCastingTime, formatRange, componentLetters } from "./spell-display";

type SourceFilter = "all" | "2014" | "2024";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Muted meta sub-line for a candidate row: school · time · range · components ·
 *  damage type. Structured-only (no inference); empty/unknown segments omitted. */
function metaLine(c: SpellCandidate): string {
  const parts: string[] = [];
  if (c.entity.school) parts.push(c.entity.school);
  const t = compactCastingTime(c.entity.casting_time); if (t !== "—") parts.push(t);
  const r = formatRange(c.entity.range); if (r !== "—") parts.push(r);
  const comp = componentLetters(c.entity.components).letters.join(" "); if (comp) parts.push(comp);
  const dmg = c.entity.damage?.types?.[0]; if (dmg) parts.push(dmg);
  return parts.join(" · ");
}

/** Inline add-spell drawer. Themed controls; Source + Level filters; candidates
 *  grouped by level. Each row: ＋/✓ add-remove toggle (left) + name · level ·
 *  source tag / meta line; clicking the row (not the toggle) expands the full
 *  spell block inline (same renderSpellBlock as Cast/Inventory). */
export function renderAddDrawer(parent: HTMLElement, ctx: ComponentRenderContext): void {
  const drawer = parent.createDiv({ cls: "pc-spell-adddrawer" });
  let showAll = false;
  let query = "";
  let source: SourceFilter = "all";
  let levelFilter: number | "all" = "all";
  const expanded = new Set<string>();  // slugs whose inline spell block is open

  const bar = drawer.createDiv({ cls: "pc-spell-filters" });
  const search = bar.createEl("input", { cls: "pc-spell-search", attr: { type: "text", placeholder: "Search spells…" } });
  const allBtn = bar.createEl("button", { cls: "pc-spell-filter", text: "All classes" });
  const srcGroup = bar.createDiv({ cls: "pc-spell-fgroup" });
  srcGroup.createSpan({ cls: "pc-spell-flabel", text: "Source" });
  const srcBtns: Record<SourceFilter, HTMLElement> = {
    all: srcGroup.createEl("button", { cls: "pc-spell-filter active", text: "All" }),
    "2014": srcGroup.createEl("button", { cls: "pc-spell-filter", text: "5e" }),
    "2024": srcGroup.createEl("button", { cls: "pc-spell-filter", text: "2024" }),
  };
  // Level filter row — rebuilt each draw from the levels currently available.
  const levelBar = drawer.createDiv({ cls: "pc-spell-filterbar pc-add-levelbar" });
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

  // Build the inline spell block inside an item. Mirrors toggleSpellBlock:
  // the .pc-spell-expand container is created synchronously; markdown fills async.
  const mountBlock = (item: HTMLElement, c: SpellCandidate): void => {
    const expand = item.createDiv({ cls: "pc-spell-expand" });
    void renderSpellBlock(c.entity, ctx.app).then((block) => expand.appendChild(block));
  };
  const toggleExpand = (item: HTMLElement, c: SpellCandidate): void => {
    const open = item.querySelector(":scope > .pc-spell-expand");
    if (open) { open.remove(); expanded.delete(c.slug); item.classList.remove("open"); return; }
    expanded.add(c.slug);
    item.classList.add("open");
    mountBlock(item, c);
  };

  const draw = () => {
    list.empty();
    levelBar.empty();
    const known = knownSet();
    // Empty known-set so already-known spells still appear (as removable toggles);
    // known-state is computed per row below.
    const matched = classSpellCandidates(ctx.core.entities, classSlugs, maxLevel, new Set(), showAll, query)
      .filter((c) => source === "all" || editionOf(c.entity) === source);

    // Level chips reflect the levels present after class/source/search (before the level filter).
    const presentLevels = [...new Set(matched.map((c) => c.level))].sort((a, b) => a - b);
    const grp = levelBar.createDiv({ cls: "pc-spell-fgroup" });
    grp.createSpan({ cls: "pc-spell-flabel", text: "Level" });
    const chip = (label: string, val: number | "all") => {
      const c = grp.createSpan({ cls: `pc-spell-fchip${levelFilter === val ? " active" : ""}`, text: label });
      c.addEventListener("click", () => { levelFilter = val; draw(); });
    };
    chip("All", "all");
    for (const l of presentLevels) chip(l === 0 ? "Cantrip" : ordinal(l), l);

    const cands = (levelFilter === "all" ? matched : matched.filter((c) => c.level === levelFilter)).slice(0, 300);
    if (!cands.length) {
      list.createDiv({ cls: "pc-spell-pick-meta", text: "No matching spells." });
      return;
    }

    // Group by level, one section header per level.
    const byLevel = new Map<number, SpellCandidate[]>();
    for (const c of cands) (byLevel.get(c.level) ?? byLevel.set(c.level, []).get(c.level)!).push(c);
    for (const lvl of [...byLevel.keys()].sort((a, b) => a - b)) {
      const head = list.createDiv({ cls: "pc-actions-section-head pc-add-section-head" });
      head.createSpan({ text: lvl === 0 ? "Cantrips" : `${ordinal(lvl)} Level` });
      for (const c of byLevel.get(lvl)!) {
        const isKnown = known.has(c.slug);
        const item = list.createDiv({ cls: "pc-add-item" });
        const row = item.createDiv({ cls: "pc-add-row" });

        const toggle = row.createEl("button", { cls: `pc-add-toggle${isKnown ? " on" : ""}`, text: isKnown ? "✓" : "＋" });
        toggle.addEventListener("click", (e) => {
          e.stopPropagation();
          if (known.has(c.slug)) ctx.editState?.removeKnownSpell(c.slug);
          else ctx.editState?.addKnownSpell(c.slug, { class: classSlugs[0] });
        });

        const main = row.createDiv({ cls: "pc-add-row-main" });
        const nl = main.createDiv({ cls: "pc-add-row-nl" });
        nl.createSpan({ cls: `pc-add-row-name${isKnown ? " on" : ""}`, text: c.name });
        nl.createSpan({ cls: "pc-add-row-lvl", text: c.level === 0 ? "· Cantrip" : `· ${ordinal(c.level)}` });
        const ed = editionOf(c.entity);
        if (ed) nl.createSpan({ cls: `pc-spell-srctag e${ed}`, text: ed === "2014" ? "5e" : ed });
        const meta = metaLine(c);
        if (meta) main.createDiv({ cls: "pc-add-row-meta", text: meta });

        // Click anywhere on the row except the toggle → expand the spell block.
        row.addEventListener("click", () => toggleExpand(item, c));

        // Preserve open state across re-draws (filter/search/level changes).
        if (expanded.has(c.slug)) { item.classList.add("open"); mountBlock(item, c); }
      }
    }
  };

  search.addEventListener("input", () => { query = search.value; draw(); });
  allBtn.addEventListener("click", () => { showAll = !showAll; allBtn.classList.toggle("active", showAll); draw(); });
  (Object.keys(srcBtns) as SourceFilter[]).forEach((k) => {
    srcBtns[k].addEventListener("click", () => {
      source = k;
      (Object.keys(srcBtns) as SourceFilter[]).forEach((j) => srcBtns[j].classList.toggle("active", j === k));
      draw();
    });
  });
  draw();
}
