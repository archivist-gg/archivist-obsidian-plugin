import type { ClassEntity } from "./class.types";
import type { RenderContext } from "../../core/module-api";
import {
  el,
  renderTextWithInlineTags,
} from "../../shared/rendering/renderer-utils";

const COLUMN_LABELS: Record<string, string> = {
  cantrips_known: "Cantrips",
  spells_known: "Spells",
  martial_arts: "Martial Arts",
  ki_points: "Ki",
  unarmored_movement: "Movement",
  rages: "Rages",
  rage_damage: "Rage Damage",
  sneak_attack: "Sneak Attack",
  "1st_slots": "1st",
  "2nd_slots": "2nd",
  "3rd_slots": "3rd",
  "4th_slots": "4th",
  "5th_slots": "5th",
  "6th_slots": "6th",
  "7th_slots": "7th",
  "8th_slots": "8th",
  "9th_slots": "9th",
};

/**
 * Loose view of a progression-table row used by the renderer.
 *
 * The canonical schema (see ClassTableRow) carries `prof_bonus: number` and
 * `feature_ids: string[]`. Some fixtures and upstream pipelines instead supply
 * pre-formatted `proficiency_bonus` strings and a `features` array of names
 * (or `{name}` objects). The renderer accepts either shape so it can be driven
 * by both canonical entities and lightly-massaged display data.
 */
interface DisplayRow {
  prof_bonus?: number;
  proficiency_bonus?: string;
  feature_ids?: string[];
  features?: Array<string | { name: string }>;
  columns?: Record<string, string | number>;
}

function rowProficiency(row: DisplayRow): string {
  if (typeof row.proficiency_bonus === "string" && row.proficiency_bonus.length > 0) {
    return row.proficiency_bonus;
  }
  if (typeof row.prof_bonus === "number") {
    return `+${row.prof_bonus}`;
  }
  return "—";
}

function rowFeatures(row: DisplayRow): string {
  const list = row.features ?? row.feature_ids ?? [];
  const names = list.map((f) => (typeof f === "string" ? f : f.name));
  return names.join(", ") || "—";
}

function deriveColumns(table: ClassEntity["table"]): string[] {
  const seen = new Set<string>();
  const cols: string[] = [];
  for (const row of Object.values(table)) {
    if (row.columns) {
      for (const key of Object.keys(row.columns)) {
        if (!seen.has(key)) {
          seen.add(key);
          cols.push(key);
        }
      }
    }
  }
  return cols;
}

export function renderClassStub(parent: HTMLElement, data: ClassEntity, _ctx: RenderContext): HTMLElement {
  const block = el("div", { cls: "archivist-class-block", parent });

  // Header
  const header = el("div", { cls: "archivist-class-block-header", parent: block });
  el("h3", { cls: "archivist-class-name", text: data.name, parent: header });

  if (data.description) {
    el("p", { cls: "archivist-class-description", text: data.description, parent: block });
  }

  // Meta
  const meta = el("div", { cls: "archivist-class-meta", parent: block });
  const metaRow = (label: string, value: string): void => {
    const row = el("div", { cls: "archivist-class-meta-row", parent: meta });
    el("span", { cls: "archivist-class-meta-label", text: label, parent: row });
    el("span", { cls: "archivist-class-meta-value", text: value, parent: row });
  };
  metaRow("Hit Die", data.hit_die);
  metaRow("Saving Throws", data.saving_throws.map((a) => a.toUpperCase()).join(", "));
  metaRow("Subclass Level", String(data.subclass_level));

  // Progression table
  const levels = Object.keys(data.table)
    .map((k) => Number(k))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (levels.length > 0) {
    const tableEl = el("table", { cls: "archivist-table", parent: block });
    const thead = el("thead", { parent: tableEl });
    const headRow = el("tr", { parent: thead });
    el("th", { text: "Lvl", parent: headRow });
    el("th", { text: "Prof", parent: headRow });
    el("th", { text: "Features", parent: headRow });
    const dynCols = deriveColumns(data.table);
    for (const c of dynCols) el("th", { text: COLUMN_LABELS[c] ?? c, parent: headRow });

    const tbody = el("tbody", { parent: tableEl });
    for (const lvl of levels) {
      const row = data.table[lvl] as DisplayRow;
      const tr = el("tr", { parent: tbody });
      el("td", { text: String(lvl), parent: tr });
      el("td", { text: rowProficiency(row), parent: tr });
      const featCell = el("td", { parent: tr });
      renderTextWithInlineTags(rowFeatures(row), featCell);
      for (const c of dynCols) {
        const cell = el("td", { parent: tr });
        const v = row.columns?.[c] ?? "—";
        renderTextWithInlineTags(String(v), cell);
      }
    }
  }

  // Features by level (existing)
  const featLevels = Object.keys(data.features_by_level).map(Number).sort((a, b) => a - b);
  if (featLevels.length > 0) {
    el("h4", { text: "Features by level", parent: block });
    const list = el("ul", { parent: block });
    for (const lvl of featLevels) {
      const li = el("li", { parent: list });
      el("strong", { text: `Level ${lvl}: `, parent: li });
      const feats = data.features_by_level[lvl] ?? [];
      const text = feats.map((f) => f.name).join(", ");
      const span = el("span", { parent: li });
      span.appendText(text);
    }
  }

  return block;
}
