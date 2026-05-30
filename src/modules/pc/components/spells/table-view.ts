import type { ComponentRenderContext } from "../component.types";
import type { ResolvedSpell } from "../../pc.types";
import { renderSpellRow } from "./spell-row";

export type SpellFilter = "all" | "prepared" | "cantrips" | "ritual" | "concentration";

export function applySpellFilter(spells: ResolvedSpell[], filter: SpellFilter): ResolvedSpell[] {
  switch (filter) {
    case "prepared": return spells.filter((s) => s.prepared);
    case "cantrips": return spells.filter((s) => (s.entity.level ?? 0) === 0);
    case "ritual": return spells.filter((s) => s.entity.ritual);
    case "concentration": return spells.filter((s) => s.entity.concentration);
    default: return spells;
  }
}

const FILTERS: SpellFilter[] = ["all", "prepared", "cantrips", "ritual", "concentration"];
const LABELS: Record<SpellFilter, string> = { all: "All", prepared: "Prepared", cantrips: "Cantrips", ritual: "Ritual", concentration: "Concentration" };

export function renderTableView(root: HTMLElement, ctx: ComponentRenderContext): void {
  let active: SpellFilter = "all";
  let query = "";

  const bar = root.createDiv({ cls: "pc-spell-filters" });
  const search = bar.createEl("input", { attr: { type: "text", placeholder: "Search…" } });

  const table = root.createEl("table", { cls: "pc-actions-table" });
  const tbody = table.createEl("tbody");

  const hasPrepared = ctx.derived.spellcastingClasses.some((c) => c.preparation === "prepared");
  const slotTotal = (lvl: number): number => ctx.resolved.definition.overrides.spell_slots?.[lvl] ?? ctx.derived.derivedSpellSlots[lvl] ?? 0;
  const slotUsed = (lvl: number): number => ctx.resolved.state.spell_slots?.[lvl]?.used ?? 0;

  const draw = () => {
    tbody.empty();
    let list = applySpellFilter(ctx.resolved.spells, active);
    if (query) list = list.filter((s) => s.entity.name.toLowerCase().includes(query.toLowerCase()));
    list = [...list].sort((a, b) => (a.entity.level ?? 0) - (b.entity.level ?? 0) || a.entity.name.localeCompare(b.entity.name));
    for (const sp of list) {
      const lvl = sp.entity.level ?? 0;
      const castLevels = lvl === 0 ? [] : Array.from({ length: 9 - lvl + 1 }, (_, i) => lvl + i).filter((l) => slotTotal(l) - slotUsed(l) > 0);
      renderSpellRow(tbody, sp, ctx, { showPrepare: hasPrepared, castLevels, isCantrip: lvl === 0 });
    }
  };

  for (const f of FILTERS) {
    const pill = bar.createEl("button", { cls: `pc-spell-filter${f === active ? " active" : ""}`, text: LABELS[f] });
    pill.addEventListener("click", () => {
      active = f;
      bar.querySelectorAll(".pc-spell-filter").forEach((el) => el.classList.toggle("active", el.textContent === LABELS[f]));
      draw();
    });
  }
  search.addEventListener("input", () => { query = search.value; draw(); });
  draw();
}
