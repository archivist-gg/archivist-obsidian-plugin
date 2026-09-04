import type { App, Component } from "obsidian";
import { el } from "./renderer-utils";
import { renderMarkdownDescription } from "./markdown-description";

export interface BgTable { name: string; dice: string; rows: Array<{ roll: string; text: string }> }

type Cell = string | { name?: string; desc: string; alignment?: string };
type Characteristics = { personality_traits?: Record<string, Cell>; ideals?: Record<string, Cell>; bonds?: Record<string, Cell>; flaws?: Record<string, Cell> } | null | undefined;

/** The declared interface order (background.types.ts `SuggestedCharacteristics`), transcribed as ONE label table (R4-G3b §10; Gate 0 M13). */
const CHARACTERISTIC_LABELS: ReadonlyArray<[keyof NonNullable<Characteristics>, string]> =
  [["personality_traits", "Personality Traits"], ["ideals", "Ideals"], ["bonds", "Bonds"], ["flaws", "Flaws"]];

const paint = (host: HTMLElement) => (err: unknown): void => {
  console.error("[Archivist] background table cell render failed", err);
  el("div", { cls: "archivist-block-error", text: `Description failed to render: ${String(err)}`, parent: host });
};

function renderOne(parent: HTMLElement, name: string, dice: string, rows: Array<{ roll: string; text: string }>, app?: App, component?: Component): void {
  const table = el("table", { cls: "archivist-table", parent });
  const head = el("tr", { parent: el("thead", { parent: table }) });
  el("th", { text: dice, parent: head }); el("th", { text: name, parent: head });
  const body = el("tbody", { parent: table });
  for (const r of rows) {
    const tr = el("tr", { parent: body });
    el("td", { text: r.roll, parent: tr });
    const td = el("td", { parent: tr });
    void renderMarkdownDescription(td, r.text, app, component).catch(paint(td));   // wikilinks resolve; no pipe escaping
  }
}

/** `background.tables` (67 converter docs) as 2-column tables: header = dice | name; text through the markdown path. */
export function renderBackgroundTables(parent: HTMLElement, tables: BgTable[] | undefined, app?: App, component?: Component): void {
  for (const t of tables ?? []) renderOne(parent, t.name, t.dice, t.rows, app, component);
}

const cellText = (v: Cell): string => typeof v === "string" ? v
  : [v.name ? `${v.name}.` : "", v.desc, v.alignment ? `(${v.alignment})` : ""].filter(Boolean).join(" ");

/** `suggested_characteristics` (three shapes): numeric-keyed records → a table with the die DERIVED from the key count
 *  (converter records are contiguous 1..N); a non-numeric key (the bundle's `_open5e_prose`) → the joined markdown,
 *  CRLF-normalised; `null` → nothing.
 *
 *  The table arm keeps the AUTHORED key as both the roll shown and the lookup: sorting the key strings numerically,
 *  rather than round-tripping them through `Number`, means a key like `"01"` (numeric by the arm's own test, but not
 *  what `String(Number(k))` gives back) still finds its cell instead of reading `undefined`. `keys` is a fresh array
 *  from `Object.keys`, so sorting it in place touches nothing else. */
export function renderSuggestedCharacteristics(parent: HTMLElement, sc: Characteristics, app?: App, component?: Component): void {
  if (!sc) return;
  for (const [key, label] of CHARACTERISTIC_LABELS) {
    const record = sc[key];
    if (!record || typeof record !== "object") continue;
    const keys = Object.keys(record);
    if (keys.length === 0) continue;
    if (!keys.every((k) => /^\d+$/.test(k))) {
      const host = el("div", { cls: "archivist-bg-prose", parent });
      const md = keys.map((k) => cellText(record[k])).join("\n\n").replace(/\r\n/g, "\n");
      void renderMarkdownDescription(host, md, app, component).catch(paint(host));
      continue;
    }
    const rows = keys.sort((a, b) => Number(a) - Number(b)).map((k) => ({ roll: k, text: cellText(record[k]) }));
    renderOne(parent, label, `d${rows.length}`, rows, app, component);
  }
}
