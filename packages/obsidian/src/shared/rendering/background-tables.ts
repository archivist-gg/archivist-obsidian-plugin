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

/** `background.tables` (67 converter docs, 88 tables) as 2-column tables: header = dice | name; text through
 *  the markdown path. Renders EVERY table it is handed: the converter also embeds 84 of those 88 as markdown
 *  pipe tables inside `description`, so the NOTE path filters through `tablesNotInDescription` first (R4-G3b
 *  Task 15) while the builder step, which renders its description as plain TEXT, passes them all. */
export function renderBackgroundTables(parent: HTMLElement, tables: BgTable[] | undefined, app?: App, component?: Component): void {
  for (const t of tables ?? []) renderOne(parent, t.name, t.dice, t.rows, app, component);
}

/** Lowercase, every run of non-alphanumerics collapsed to ONE space, trimmed. The shared normal form for
 *  comparing a description's pipe cells against a structured table's own strings, so "Scam", "scam:" and
 *  "  SCAM  " are one key. */
const normCell = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** How many characters of the first row's `text` the row arm compares: a prefix rather than the whole text, so a
 *  trailing edit in either copy still matches. 24 is the value MEASURED over the converter corpus, where the header
 *  arm and this row arm agree on all 88 tables (R4-G3b Task 15). */
const ROW_PREFIX = 24;

/** Every markdown pipe line of a description as normalised cells. A pipe line is a trimmed line that opens
 *  AND closes with `|`; the outer bars come off before the split, so `| d6 | Scam |` yields ["d6", "scam"].
 *  A separator line (`| --- | --- |`) normalises to all-empty cells and is dropped here, so no arm can ever
 *  match one. Lines with fewer than two cells are dropped too. */
function pipeCells(description: string): string[][] {
  const out: string[][] = [];
  for (const raw of description.split(/\r?\n/)) {
    const line = raw.trim();
    if (!/^\|.*\|$/.test(line)) continue;
    const cells = line.slice(1, -1).split("|").map(normCell);
    if (cells.length < 2 || cells.every((c) => c === "")) continue;
    out.push(cells);
  }
  return out;
}

/** True when `description` already carries this table as a markdown pipe table. Two arms, either sufficient,
 *  measured to AGREE on all 88 converter tables (R4-G3b Task 15): the HEADER arm matches a pipe line whose
 *  first two cells are the table's own `dice` and `name` (Charlatan `| d6 | Scam |`); the ROW arm matches a
 *  pipe line whose first two cells are the FIRST row's `roll` and the opening of its `text`, which catches a
 *  description that spells the header differently. A prefix, not an equality: the description cell holds the
 *  whole row text, and `normCell` of a prefix is always a prefix of `normCell` of the whole. An absent
 *  description is false; a table with no rows falls to the header arm only. */
export function descriptionEmbedsTable(description: string | null | undefined, t: BgTable): boolean {
  if (!description) return false;
  const lines = pipeCells(description);
  const dice = normCell(t.dice ?? ""), name = normCell(t.name ?? "");
  const first = t.rows?.[0];
  const roll = first ? normCell(first.roll ?? "") : null;
  const prefix = first ? normCell((first.text ?? "").slice(0, ROW_PREFIX)) : "";
  return lines.some((c) => (c[0] === dice && c[1] === name) || (roll !== null && c[0] === roll && c[1].startsWith(prefix)));
}

/** The tables a description does NOT already embed. A fresh array from `filter`; the input is never mutated.
 *  The entity-note path renders through this so a converter background does not show the same roll table
 *  twice (R4-G3b Task 15). */
export function tablesNotInDescription(tables: BgTable[] | undefined, description: string | null | undefined): BgTable[] {
  return (tables ?? []).filter((t) => !descriptionEmbedsTable(description, t));
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
