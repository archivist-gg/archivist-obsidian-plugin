import type { ComponentRenderContext } from "../component.types";
import type { DecisionItem } from "@archivist-gg/dnd5e/pc/pc.decision-engine";
import type { RegisteredEntity } from "@archivist-gg/core";
import { renderSelectionTable } from "./selection-table";
import { DecisionPickModal } from "./decision-modal";
import { humanizeSlug, humanizeToken } from "../../../../shared/rendering/renderer-utils";
import { toProfSlug, humanizeProficiency } from "@archivist-gg/dnd5e/pc/pc.proficiency-normalize";
import { bareEntitySlug } from "@archivist-gg/dnd5e/entities/slug";
import { hiddenCompendiumSet, entityCompendiumVisible } from "../../../../shared/entities/compendium-visibility";
import { renderMarkdownDescription } from "../../../../shared/rendering/markdown-description";
import type { Ability } from "@archivist-gg/dnd5e/types/choice";

/** Render a decision/trait description as a quiet markdown block (smoke r7) at
 *  the top of a top-level live row's nest. Routes through the SHARED markdown
 *  path the compendium blocks use (ctx.app threaded, async) so pipe tables —
 *  e.g. the Elf's "Elven Lineage" lineage table — render as real tables rather
 *  than raw `|...|` text. On failure the `.catch` paints a visible error div so
 *  the pane never silently drops the prose (the Plan-2 error-paint idiom). */
function renderDescBlock(host: HTMLElement, ctx: ComponentRenderContext, markdown: string): void {
  const desc = host.createDiv({ cls: "pc-dstrip-desc" });
  void renderMarkdownDescription(desc, markdown, ctx.app).catch((err: unknown) => {
    console.error("[Archivist] decision description render failed", err);
    desc.createDiv({ cls: "archivist-block-error", text: `Description failed to render: ${String(err)}` });
  });
}

/** Above this many resolved, VISIBLE candidates an entity pick is browsed rather than splatted inline:
 *  the registry-backed arm replaces its selection table, and since R4-G5 §3.2.1 the `from` arm replaces
 *  its chips wall, both with chips-of-selection plus a "Browse all N ▸" ghost onto the picker modal
 *  (smoke r1 · Fighter Weapon Mastery is choose-3-from-~70; R4-G5 · a Warlock 20's invocations are 59
 *  after the cross-edition collapse). */
const LONG_LIST_THRESHOLD = 12;

/** The hidden-compendium empty copy, verbatim as the registry-backed arm has printed it since R3-P6.
 *  R4-G5 §3.2.2 gives the `from` chips arm the same predicate, so both arms print the same sentence
 *  from one place rather than two literals that can drift. */
const HIDDEN_EMPTY_COPY = "No options available. Some exist in a hidden compendium (see Archivist settings).";

/** Tooltip on a STRANDED pick's chip (R4-G5 §3.2.3): the option is still stored and still removable,
 *  but its prerequisite no longer holds, which is the sheet's "Selected · prerequisite unmet" band in
 *  one chip's worth of room. */
export const STRANDED_TIP = "Prerequisite unmet: this pick no longer qualifies";

/** Canonical toggle semantics shared by every call-site: under the limit
 *  toggle membership; at the limit choose-1 swaps, choose-N refuses. The
 *  caller owns the Set and re-renders after applying. */
export function applyChoiceToggle(selected: Set<string>, value: string, choose: number): void {
  if (selected.has(value)) {
    selected.delete(value);
    return;
  }
  if (selected.size >= choose) {
    if (choose !== 1) return;
    selected.clear();
  }
  selected.add(value);
}

export interface DecisionStripOptions {
  items: DecisionItem[];
  /** Pill text per item: domainPill for race/background, (i) => `L${i.level}` for class. */
  pill: (item: DecisionItem) => string;
  /** false = browse preview — no controls, unresolved rows wear the crimson req dress. */
  live: boolean;
  /** Class scope for setChoice/setSubclass; omit for origin (race/background) writes. */
  classIndex?: number;
  /** Namespace for nested selection-table state in builderUiState. */
  stateKey: string;
}

const PROF_PILL: Record<string, string> = { skill: "Skill", language: "Lang", tool: "Tool" };

/** Short domain label for a decision row's leading pill (race/background scope).
 *  Deterministic over choice kind; the class scope passes its own `L${level}`
 *  pill instead. */
export function domainPill(item: DecisionItem): string {
  const ch = item.choice;
  if (ch.kind === "ability-points") return "Ability";
  if (ch.kind === "select-proficiency") return PROF_PILL[ch.domain] ?? "Pick";
  if (ch.kind === "select-entity") return humanizeToken(ch.entity_type) || "Pick";
  if (ch.kind === "select-inline") {
    const tail = (ch.id ?? "").split("-").filter(Boolean).pop();
    return tail ? humanizeToken(tail) : "Pick";
  }
  return "Pick";
}

/** SP2 Plan 5 §Amendment: the always-open decision strip. Every actionable row
 *  keeps its control mounted; only the dress tracks state — `open` (unresolved /
 *  partial), `done` (resolved, green ✓ summary), `req` (browse preview, no
 *  controls), `info` (quiet informational row, no choice read). Mutations flow
 *  through ctx.editState; the sheet's onChange re-render rebuilds the ledger. */
export function renderDecisionStrip(
  parent: HTMLElement,
  ctx: ComponentRenderContext,
  opts: DecisionStripOptions,
): void {
  const root = parent.createDiv({ cls: "pc-dstrip" });
  for (const item of opts.items) renderRow(root, ctx, item, opts);
}

function renderRow(
  root: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
): void {
  // Informational: no choice to make (`choice` is a never-read sentinel — engine
  // Task 16 contract), so the block is COLLAPSED by default. Click the header to
  // reveal the feature's prose; no chevron, no label (per design) — the header's
  // pointer cursor is the affordance. Without prose, a bare name row.
  if (item.status === "informational") {
    const desc = opts.live ? item.description?.trim() : undefined;
    if (!desc) {
      const row = root.createDiv({ cls: "pc-dstrip-row info" });
      row.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
      row.createSpan({ cls: "pc-dstrip-name", text: item.featureName });
      return;
    }
    const bag = ctx.builderUiState;
    const expandKey = `${opts.stateKey}.infoExpanded`;
    const expanded = (bag?.get(expandKey) as Set<string> | undefined) ?? new Set<string>();
    bag?.set(expandKey, expanded);
    const rowKey = `${item.level}.${item.key}`;
    const row = root.createDiv();
    const draw = (): void => {
      row.empty();
      const open = expanded.has(rowKey); // default: absent ⇒ collapsed
      row.className = "pc-dstrip-row info expandable";
      const head = row.createDiv({ cls: "pc-dstrip-head" });
      head.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
      head.createSpan({ cls: "pc-dstrip-name", text: item.featureName });
      head.addEventListener("click", () => {
        if (open) expanded.delete(rowKey); else expanded.add(rowKey);
        draw();
      });
      if (open) renderDescBlock(row.createDiv({ cls: "pc-dstrip-nest" }), ctx, desc);
    };
    draw();
    return;
  }
  const done = item.status === "resolved";
  const state = done ? "done" : opts.live ? "open" : "req";

  // Browse-mode rows (live:false) have no controls/nest → no collapse toggle,
  // and keep the legacy flat header (pill/bang/name/val are direct children).
  if (!opts.live) {
    const row = root.createDiv({ cls: `pc-dstrip-row ${state}` });
    row.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
    row.createSpan({ cls: "pc-dstrip-name", text: labelOf(item) });
    row.createSpan({ cls: "pc-dstrip-val", text: statusText(item) });
    return;
  }

  // Live top-level rows are MANUALLY collapsible (SP2 Plan 5, smoke r5).
  // Default = expanded ALWAYS (incl. after resolve — never auto-collapse);
  // collapse is strictly user-initiated and persists in builderUiState. We
  // locally re-render just this row on toggle (chronicle-fold `draw()` idiom)
  // so a click costs only this row, not a full sheet re-render.
  const bag = ctx.builderUiState;
  const collapseKey = `${opts.stateKey}.rowsCollapsed`;
  const collapsed = (bag?.get(collapseKey) as Set<string> | undefined) ?? new Set<string>();
  bag?.set(collapseKey, collapsed);
  const rowKey = `${item.level}.${item.key}`;

  const row = root.createDiv();
  const draw = (): void => {
    row.empty();
    const open = !collapsed.has(rowKey);
    row.className = `pc-dstrip-row ${state}`;
    // Header wrapper carries the click+pointer; the nest below is a SEPARATE
    // flex child, so clicks on chips/steppers/tables never bubble to this
    // toggle. `.pc-dstrip-val` keeps its margin-left:auto inside the head.
    const head = row.createDiv({ cls: "pc-dstrip-head" });
    head.createSpan({ cls: "pc-dstrip-pill", text: opts.pill(item) });
    if (!done) head.createSpan({ cls: "pc-dstrip-bang", text: "!" });
    head.createSpan({ cls: "pc-dstrip-name", text: labelOf(item) });
    // A SATISFIED row is `resolved` and USUALLY has no `selected` (spec §6.2), a
    // shape that did not exist before P3b: `selectedSummary` returns "" for it, so
    // the ✓ branch would render a bare "✓ " on a row the user never acted on. It
    // gets its own copy, deliberately DIFFERENT from the nest's line just below it
    // (both are on screen at once, so printing one sentence twice reads as a
    // rendering bug) and phrased as "there was nothing to take", never as a pick.
    //
    // `satisfied` does NOT imply `selected === undefined`, which is why the copy
    // is gated on the SUMMARY being empty rather than on the flag alone.
    // `canonicalizeSelection` (engine :295-301) keeps a pool no-match verbatim
    // (`matchPool(v, pool) ?? v`) precisely so a homebrew or legacy value is never
    // erased, and the per-choice exemption (engine :375) re-admits only options
    // that are IN the pool. So a persisted value outside the enumerated pool
    // survives while the pool empties around it: the row is satisfied AND carries
    // a real frontmatter pick. Announcing "nothing left to pick" over it would
    // hide the user's own data.
    head.createSpan({
      cls: "pc-dstrip-val",
      text: done
        ? item.satisfied && !selectedSummary(item)
          ? "✓ Nothing left to pick"
          : `✓ ${selectedSummary(item)}`
        : statusText(item),
    });
    head.addEventListener("click", () => {
      if (open) collapsed.add(rowKey); else collapsed.delete(rowKey);
      draw();
    });
    if (!open) return;

    const nest = row.createDiv({ cls: "pc-dstrip-nest" });
    // The source feature/trait's own description sits at the TOP of the nest so
    // each live row is self-explanatory (smoke r7). Top-level rows only — a
    // child carries no inherited description; browse rows stay compact (no nest).
    if (item.description?.trim()) renderDescBlock(nest, ctx, item.description.trim());
    renderControl(nest, ctx, item, opts, false);
    // SP2 Plan 5 (Variant II sans pathline): children render as a FLAT group
    // inside the parent's nest — no own borders, no own pills. Each child is a
    // named sub-choice; grandchildren flatten into the same group with a modest
    // extra indent. Only the top-level row keeps the perimeter border + L-pill.
    if (item.children?.length) {
      const group = nest.createDiv({ cls: "pc-dstrip-fgroup" });
      for (const child of item.children) renderChildRow(group, ctx, child, opts, 0);
    }
  };
  draw();
}

/** Variant II flat child: a named sub-choice rendered without its own border or
 *  pill. Resolved children wear the quiet dress (sub-label + ✓ + chips, the
 *  non-selected chips recede); the open/partial child wears the amber tint +
 *  "!" disc so the eye lands on the only open work. Grandchildren flatten into
 *  the same group with a modest extra indent (`depth` drives padding). */
function renderChildRow(
  group: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  depth: number,
): void {
  const done = item.status === "resolved";
  const fc = group.createDiv({ cls: `pc-dstrip-fc ${done ? "quiet" : "partial"}` });
  // Grandchildren indent via padding (not margin) so a partial child's tint
  // panel keeps its -9px left bleed regardless of depth.
  if (depth > 0) fc.style.paddingLeft = `${depth * 14}px`;

  const label = fc.createDiv({ cls: "pc-dstrip-fcl" });
  if (!done) label.createSpan({ cls: "pc-dstrip-fc-flag", text: "!" });
  label.createSpan({ cls: "pc-dstrip-fc-name", text: childLabel(item) });
  if (done) label.createSpan({ cls: "pc-dstrip-fc-ok", text: "✓" });

  // inChild = true: the `.pc-dstrip-fcl` sub-label above already names this
  // sub-choice (via childLabel, carrying the ": choose N" requirement), so the
  // long-list control must NOT re-emit its own `.pc-dstrip-tlabel` header
  // (which is parent-derived from labelOf and would read "FEAT FEAT" / surface
  // the inherited parent featureName). The control suppresses it in child scope.
  renderControl(fc, ctx, item, opts, true);

  // Grandchildren flatten into the SAME group (no nested border), one indent
  // step deeper so the lineage still reads.
  if (item.children?.length) {
    for (const grandchild of item.children) renderChildRow(group, ctx, grandchild, opts, depth + 1);
  }
}

const CHILD_LABEL_MAP: Record<string, string> = {
  feat: "Feat",
  asi: "Ability points",
  "spell-list": "Spell list",
  "spellcasting-ability": "Spellcasting ability",
  skills: "Skills",
};

/** Presentation-layer sub-choice label for a flat child — names the REAL
 *  sub-choice from the child's `choice.id`, never the inherited featureName
 *  (the bug Variant II fixes). Strips a `feat:` key prefix, special-cases the
 *  known ids, else humanizes the slug. When the row carries a requirement it is
 *  appended per the mockup's Variant II ("Skills: choose 3 · 1 picked"); a
 *  single-pick or ability-points child shows the bare label. Separator is `:`,
 *  never a U+2014 (spec §13.2: routing statusText through this idiom would
 *  otherwise widen a known em-dash violation into `.pc-dstrip-val`). */
export function childLabel(item: DecisionItem): string {
  const id = (item.choice.id ?? "").replace(/^feat:/, "");
  const base = CHILD_LABEL_MAP[id] ?? (id ? humanizeSlug(id) : "Choice");
  const suffix = requirementSuffix(item);
  return suffix ? `${base}: ${suffix}` : base;
}

/** The shared requirement copy behind BOTH `childLabel`'s suffix and
 *  `statusText` (spec §13.1: one function, two callers, so the builder can no
 *  longer say "choose 2" while the sheet says "choose 1"). Returns "" when the
 *  row carries NO requirement copy; else "choose N" | "choose N · k picked".
 *
 *  FOUR guard conditions, each load-bearing:
 *  0. the `satisfied` clause, FIRST: a satisfied row has nothing left to grant
 *     (spec §6.1), so it carries no requirement copy at all. Without it a
 *     satisfied count:2 CHILD renders the quiet dress and its ✓ beside
 *     "Languages: choose 2" (spec §13.4) · the incoherence §6.1 exists to
 *     prevent, one level down. Children are reachable per §5.4;
 *  1. the ability-points clamp (`need = 1`): its ±-stepper reports "N point(s)
 *     left" itself and its `points` is not a "choose N" count, so it is never
 *     suffixed;
 *  2. the `need <= 1` early return, which keeps a single-pick child's label bare;
 *  3. the UPPER bound `have < need`, which is NOT the same as `have > 0 && need >
 *     1`: a fully-selected count:2 child must read "choose 2", never
 *     "choose 2 · 2 picked". */
function requirementSuffix(item: DecisionItem): string {
  if (item.satisfied) return "";
  const need = item.choice.kind === "ability-points" ? 1 : requiredOf(item);
  if (need <= 1) return "";
  const have = selectionCountOf(item);
  return have > 0 && have < need ? `choose ${need} · ${have} picked` : `choose ${need}`;
}

/** Count of picks already made on a child (array length / non-zero allocation
 *  cells / 1 for a set string) — drives the "k picked" requirement suffix. */
function selectionCountOf(item: DecisionItem): number {
  const s = item.selected;
  if (Array.isArray(s)) return s.length;
  if (typeof s === "string") return s ? 1 : 0;
  if (s && typeof s === "object") {
    return Object.values(s as Record<string, number>).reduce((n, v) => n + (v ?? 0), 0);
  }
  return 0;
}

/** `.pc-dstrip-val` copy for a row that is NOT resolved. Shares
 *  `requirementSuffix` with `childLabel` so a partially-picked row reports what
 *  is REMAINING, not the total (spec §13.1). The `||` fallback is what keeps
 *  "choose 1" alive: `requirementSuffix` returns "" for a single-pick row
 *  because a child's label wants no suffix there, but the value column still
 *  has to say something. The ability-points arm already uses a remaining idiom
 *  and is left exactly as it was.
 *
 *  ⚠️ The `||` swallows `requirementSuffix`'s SATISFIED return the same way it
 *  swallows the `need <= 1` one, so calling this on a satisfied row would print
 *  "choose N" for exactly the row the satisfied state exists to silence. That is
 *  UNREACHABLE, and deliberately not defended against here · verified, not
 *  assumed:
 *    - a satisfied row is `resolved`, so the live header takes the ✓ branch and
 *      never reaches this function;
 *    - the only other caller is the BROWSE header, which runs under `!live`, and
 *      all four production `renderDecisionStrip` calls pass `live: true`
 *      (race-step:101, background-step:105, class-chronicle:251,
 *      equipment-step:177), so that path is dead (spec §13.1).
 *  Reviving the browse path, or making a satisfied row anything other than
 *  `resolved`, re-arms this. Pinned by the satisfied-dress test, which asserts
 *  the live value column never says "choose". */
function statusText(item: DecisionItem): string {
  if (item.choice.kind === "ability-points") {
    const spent = Object.values(
      (item.selected as Record<string, number> | undefined) ?? {},
    ).reduce((s, v) => s + (v ?? 0), 0);
    return `${item.choice.points - spent} point(s) left`;
  }
  return requirementSuffix(item) || `choose ${requiredOf(item)}`;
}

// ── module-private helpers ──────────────────────────────────────────────────

/** Top-level row label. An authored `choice.label` always wins; otherwise the
 *  source feature/trait name, EXCEPT for an ENTITY-level origin choice, where
 *  `featureName` is the entity's own name and three sibling rows would all read
 *  "Soldier" (spec §13.3). `pushOrigin` passes the SAME `source` object for both
 *  levels, so `bareEntitySlug` alone cannot discriminate: only `featureName`
 *  differs, hence the name test. Trait-level rows ("Skill Versatility",
 *  "Extra Language") fail it and keep their correct name.
 *
 *  The `kind` clause is NOT decoration. The origin-feat push sets
 *  `featureName = originFeat.display` AND `source.slug = feat.slug`, so it
 *  satisfies the name test and would otherwise be rewritten · an origin-feat
 *  row's feat name is the right label. Class rows can never be rewritten by
 *  construction. */
function labelOf(item: DecisionItem): string {
  if (item.choice.kind !== "ability-points" && item.choice.label) return item.choice.label;
  if (
    (item.source.kind === "race" || item.source.kind === "background") &&
    toProfSlug(item.featureName) === bareEntitySlug(item.source.slug)
  ) {
    return humanizeProficiency(item.choice.id);
  }
  return item.featureName;
}

function selectedSummary(item: DecisionItem): string {
  const s = item.selected;
  if (Array.isArray(s)) {
    return s.map((v) => item.options.find((o) => o.value === v)?.label ?? v).join(", ");
  }
  if (typeof s === "string") return item.options.find((o) => o.value === s)?.label ?? s;
  if (s && typeof s === "object") {
    return Object.entries(s).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ");
  }
  return "";
}

function requiredOf(item: DecisionItem): number {
  const ch = item.choice;
  if (ch.kind === "ability-points") return ch.points;
  if (ch.kind === "select-proficiency") return ch.count;
  return ch.count ?? 1;
}

function selectedSlugs(item: DecisionItem): string[] {
  if (Array.isArray(item.selected)) return item.selected;
  if (typeof item.selected === "string") return [item.selected];
  return [];
}

function writeValue(
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  value: unknown,
): void {
  const es = ctx.editState;
  if (!es) return;
  if (item.choice.kind === "select-entity" && item.choice.entity_type === "subclass") {
    es.setSubclass(opts.classIndex ?? 0, typeof value === "string" ? value : null);
    return;
  }
  // An origin-feat's OWN choice (e.g. Magic Initiate's spell picks). The engine
  // surfaces these into ledger.origin with source.kind "feat" and a "feat:<id>"
  // key, and the resolver reads them under "background:feat:<id>" via
  // originRead("background"). So write to that exact origin key. This must sit
  // BEFORE the race/background branch: routing a feat item through that branch
  // would double the namespace to "feat:feat:<id>", and falling through to
  // setChoice would misfile it as a class-slot choice.
  if (item.source.kind === "feat") {
    es.setOriginChoice(`background:${item.key}`, value);
    return;
  }
  if (item.source.kind === "race" || item.source.kind === "background") {
    es.setOriginChoice(`${item.source.kind}:${item.key}`, value);
    return;
  }
  es.setChoice(opts.classIndex ?? 0, item.level, item.key, value);
}

/** The persisted SHAPE of a pick (R4-G5 §3.2.6). A POOL item is written as an ARRAY at every count,
 *  because that is the shape `PoolTab.row` persists on the identical `setChoice(classIndex,
 *  anchorLevel, pool.id, …)` key and the two surfaces must not write the same key two ways (measured
 *  divergence D6: a count-1 pool synth wrote a bare string). Every other pick keeps the shipped shape,
 *  a string at count 1, which is what `collectFeatSlugs` reads (`typeof feat === "string"`). */
function pickValue(item: DecisionItem, slugs: string[], need: number): unknown {
  if (item.pool) return [...slugs];
  return need === 1 ? (slugs[0] ?? null) : [...slugs];
}

// ── controls ────────────────────────────────────────────────────────────────
// Kind-based dispatch — ability-points and the registry-backed selection table
// short-circuit BEFORE the chips fall-through, so an ability-points item (whose
// value is a Record<ability, number>) can never reach the chips writer (which
// emits a string/array) and corrupt the allocation.

function renderControl(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  inChild: boolean,
): void {
  const ch = item.choice;

  // Ability-points → the always-mounted ±-stepper (Record<ability, number>).
  if (ch.kind === "ability-points") {
    renderAbilityPoints(nest, ctx, item, opts);
    return;
  }

  // Registry-backed entity pick (no explicit `from`) → the shared selection
  // table over the resolved candidate entities.
  if (ch.kind === "select-entity" && !ch.from) {
    const need = requiredOf(item);
    const selected = new Set(selectedSlugs(item));
    // Candidates ride on the options the engine already resolved (each carries
    // its `.entity`); there is no separate registry pass here. Hidden
    // compendiums filter NEW choices only: the current selection is exempt,
    // so its inline row and long-list chip label keep resolving (since R4-G5
    // §3.2.2 the `from` arm below applies the same predicate).
    const hidden = hiddenCompendiumSet(ctx.services.plugin?.settings);
    const allCandidates = item.options.flatMap((o) => (o.entity ? [o.entity] : []));
    const candidates = allCandidates.filter(
      (e) => entityCompendiumVisible(e, hidden) || selected.has(e.slug),
    );
    // Top-level only: the parent-derived caps header. In child scope the
    // `.pc-dstrip-fcl` sub-label (childLabel) already precedes this control and
    // carries the requirement, so re-emitting tlabel would duplicate the label
    // and leak the inherited parent featureName ("FEAT FEAT").
    if (!inChild) nest.createDiv({ cls: "pc-dstrip-tlabel", text: `${labelOf(item)} — choose ${need}` });
    // Zero resolved candidates → a quiet line, not the full table chrome. The
    // copy distinguishes "vault has none" from "all hidden by settings".
    if (candidates.length === 0) {
      nest.createDiv({
        cls: "pc-dstrip-empty",
        text: allCandidates.length > 0 ? HIDDEN_EMPTY_COPY : "No options available in your vault yet.",
      });
      return;
    }
    // Long candidate lists (e.g. Fighter Weapon Mastery — choose 3 from ~70)
    // would splat an enormous table into the card. Past the threshold, show the
    // current picks as removable chips + a ghost that opens the filtered picker
    // modal instead. Small lists (a class's handful of subclasses) stay inline.
    if (candidates.length > LONG_LIST_THRESHOLD) {
      renderLongListBrowse(nest, ctx, item, opts, candidates, selected, need);
      return;
    }
    renderSelectionTable(nest, ctx, {
      columns: [],
      candidates,
      stateKey: `${opts.stateKey}.${item.level}.${item.key}`,
      selected,
      single: need === 1,
      onToggle: (slug) => {
        applyChoiceToggle(selected, slug, need);
        writeValue(ctx, item, opts, pickValue(item, [...selected], need));
      },
    });
    return;
  }

  // Inline / proficiency picks, and an explicit-`from` entity pick with 12 or
  // fewer visible candidates → the always-open chips
  // row. A `missing` option (slug with no resolved entity) is shown inert:
  // visible with a "(missing)" hint and no click listener, so it can never write
  // a dangling slug. NO `muted` chips at-limit — always-open means clicking
  // another chip in a resolved choose-1 row swaps directly (applyChoiceToggle
  // swaps for choose-1; choose-N still refuses past the cap).
  // A choice whose option pool resolved empty must say so. Reaching the chips row
  // with zero options renders a header and nothing clickable, which reads as a
  // broken UI rather than as missing data. Distinct copy from the select-entity
  // empty-state above: compendium visibility is meaningless for a proficiency domain.
  //
  // The two zero-option cases are NOT coextensive (spec §6.1/§6.3), so the copy
  // splits on the engine's `satisfied` flag rather than on the count. SATISFIED
  // means exclusion emptied a pool that WAS non-empty: the character already
  // holds every language/tool this choice could grant, so it is complete, not a
  // broken row. The else-branch stays reachable for the three genuinely-open
  // shapes (a `domain:"save"` choice, an empty registry, an authored `from: []`)
  // and keeps P3a's string verbatim.
  if (item.options.length === 0) {
    nest.createDiv({
      cls: "pc-dstrip-empty",
      text: item.satisfied
        ? "You already have every option this choice offers."
        : "No options available for this choice.",
    });
    return;
  }
  const need = requiredOf(item);
  const selected = new Set(selectedSlugs(item));
  // R4-G5 §3.2.2: ONE visibility predicate for both arms. A `from`-carrying select-entity item's
  // options already carry their resolved `.entity`, so `entityCompendiumVisible` applies here exactly
  // as it does in the registry-backed arm above, with the same current-selection exemption. An option
  // with NO entity is KEPT (fail-open): a `missing` slug carries no compendium to hide it by, and the
  // inline / proficiency kinds that share this arm have no entity at all.
  const hidden = hiddenCompendiumSet(ctx.services.plugin?.settings);
  const options = item.options.filter(
    (o) => !o.entity || entityCompendiumVisible(o.entity, hidden) || selected.has(o.value),
  );
  if (options.length === 0) {
    nest.createDiv({ cls: "pc-dstrip-empty", text: HIDDEN_EMPTY_COPY });
    return;
  }
  // R4-G5 §3.2.1: a `from`-carrying ENTITY pick past the threshold takes the same chips-of-selection +
  // "Browse all N" + DecisionPickModal path the registry-backed arm has (the modal re-derives nothing
  // from `choice.where`, so the reuse is exact). The count is of VISIBLE, RESOLVED candidates, the same
  // quantity the other arm counts: a hidden option must not push a pool over the threshold, and a
  // `missing` option is not pickable in a modal and keeps its inert chip below. 12 or fewer stays chips.
  const candidates = options.flatMap((o) => (o.entity ? [o.entity] : []));
  if (ch.kind === "select-entity" && candidates.length > LONG_LIST_THRESHOLD) {
    renderLongListBrowse(nest, ctx, item, opts, candidates, selected, need);
    return;
  }
  const chips = nest.createDiv({ cls: "pc-bchoice-chips" });
  for (const o of options) {
    const sel = selected.has(o.value);
    const chip = chips.createSpan({
      cls: `pc-bchoice-chip${sel ? " sel" : ""}${o.missing ? " inert" : ""}`,
      text: sel
        ? `✓ ${o.label}${o.stranded ? " (prerequisite unmet)" : ""}`
        : o.missing ? `${o.label} (missing)` : o.label,
    });
    // The chip's option value, exposed as a stable DOM hook. The rendered text
    // is a humanized label (and is prefixed with "✓ " when selected), so it is
    // not addressable by a CSS selector; `data-prof` carries the chip's real
    // identity · the same `o.value` the `sel` test above uses. Spec §17
    // assertion 4 (`--expect-absent '.pc-bchoice-chip[data-prof="dwarvish"]'`)
    // cannot be written without it, and its failure mode is SILENT: an
    // `--expect-absent` on a selector nothing ever emits returns 0 and passes
    // unconditionally.
    chip.setAttribute("data-prof", o.value);
    // R4-G5 §3.2.3: the crimson dress a stranded pick wears IS `.sel`'s (a stranded option is by
    // construction a selected one), so this adds wording and a stable hook, never a new class: the
    // rendered text is a humanized label and is not addressable by a CSS selector, the same reason
    // `data-prof` exists. The tooltip is set FIRST, so an option carrying its own `description`
    // overwrites it on the line below: that is the shipped precedence, stated here and not changed.
    if (o.stranded) { chip.setAttribute("data-stranded", "true"); chip.setAttribute("title", STRANDED_TIP); }
    // Each option's own prose as a hover tooltip, so the player can preview what an
    // option does before picking it (the data carries it — it was never surfaced).
    if (o.description) chip.setAttribute("title", o.description);
    if (!o.missing) chip.addEventListener("click", () => {
      applyChoiceToggle(selected, o.value, need);
      writeValue(ctx, item, opts, pickValue(item, [...selected], need));
    });
  }
  // The selected option's prose, shown beneath the chips, so the pick is
  // self-explanatory (e.g. the chosen Combat Mastery's effect).
  for (const o of options) {
    if (selected.has(o.value) && o.description?.trim()) renderDescBlock(nest, ctx, o.description.trim());
  }
}

/** Long-list dress for a registry-backed entity pick. Two modes (smoke r4):
 *  - UNRESOLVED (nothing picked) → the prominent dashed ghost `Browse all N ▸`
 *    where the chips would be, inviting the first pick.
 *  - RESOLVED (pick made) → the chosen chip(s) plus a COMPACT inline `Change ▸`
 *    ghost on the SAME line, so any sub-decisions that follow visually attach to
 *    the selection, not the browse button.
 *  Both open the same DecisionPickModal; chip removal and modal writes share the
 *  applyChoiceToggle + writeValue path so the sheet re-render rebuilds the strip. */
function renderLongListBrowse(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
  candidates: RegisteredEntity[],
  selected: Set<string>,
  need: number,
): void {
  const write = (): void =>
    writeValue(ctx, item, opts, pickValue(item, [...selected], need));
  const openModal = (): void => {
    new DecisionPickModal(ctx.app, ctx, {
      title: `${labelOf(item)} — choose ${need}`,
      need,
      candidates,
      initialSelected: [...selected],
      writeValue: (value) => writeValue(ctx, item, opts, pickValue(item, value, need)),
      stateKey: `${opts.stateKey}.${item.level}.${item.key}.modal`,
    }).open();
  };

  // Resolved: chips + a compact inline "Change ▸" ghost on the same line.
  if (selected.size) {
    const chips = nest.createDiv({ cls: "pc-bchoice-chips" });
    for (const slug of selected) {
      const o = item.options.find((x) => x.value === slug);
      const label = candidates.find((e) => e.slug === slug)?.name ?? slug;
      const chip = chips.createSpan({
        cls: "pc-bchoice-chip sel",
        text: `✓ ${label}${o?.stranded ? " (prerequisite unmet)" : ""}`,
      });
      if (o?.stranded) { chip.setAttribute("data-stranded", "true"); chip.setAttribute("title", STRANDED_TIP); }
      chip.addEventListener("click", () => {
        applyChoiceToggle(selected, slug, need);
        write();
      });
    }
    const change = chips.createEl("button", { cls: "pc-dstrip-browse compact", text: `Change ▸` });
    change.addEventListener("click", openModal);
    return;
  }

  // Unresolved: the prominent dashed ghost where the chips would be.
  const browse = nest.createEl("button", {
    cls: "pc-dstrip-browse",
    text: `Browse all ${candidates.length} ▸`,
  });
  browse.addEventListener("click", openModal);
}

/** ±-stepper for ability-points: one cell per pool ability, always mounted.
 *  Caps are PICKER-owned (the engine never reflects over-selection or max_per):
 *  + disables at the points-spent cap and the per-ability max_per cap. Writes
 *  the merged allocation through writeValue; clearing the last point writes
 *  null. */
function renderAbilityPoints(
  nest: HTMLElement,
  ctx: ComponentRenderContext,
  item: DecisionItem,
  opts: DecisionStripOptions,
): void {
  const ch = item.choice;
  if (ch.kind !== "ability-points") return;
  const alloc: Partial<Record<Ability, number>> =
    item.selected && typeof item.selected === "object" && !Array.isArray(item.selected)
      ? { ...item.selected }
      : {};
  const spent = Object.values(alloc).reduce((s, v) => s + (v ?? 0), 0);

  const row = nest.createDiv({ cls: "pc-bpoints" });
  for (const o of item.options) {
    const a = o.value as Ability;
    const cell = row.createDiv({ cls: "pc-bpoints-cell" });
    cell.createSpan({ cls: "pc-bpoints-ab", text: o.label });
    const minus = cell.createEl("button", { cls: "pc-bpoints-btn", text: "−" });
    cell.createSpan({ cls: "pc-bpoints-n", text: String(alloc[a] ?? 0) });
    const plus = cell.createEl("button", { cls: "pc-bpoints-btn", text: "+" });
    plus.disabled = spent >= ch.points || (alloc[a] ?? 0) >= ch.max_per;
    minus.disabled = (alloc[a] ?? 0) <= 0;
    plus.addEventListener("click", () => {
      alloc[a] = (alloc[a] ?? 0) + 1;
      writeValue(ctx, item, opts, alloc);
    });
    minus.addEventListener("click", () => {
      alloc[a] = (alloc[a] ?? 0) - 1;
      if (alloc[a] === 0) delete alloc[a];
      writeValue(ctx, item, opts, Object.keys(alloc).length ? alloc : null);
    });
  }
}

export interface StripInfoRowSpec {
  pill: string;
  name: string;
  value: string;
}

/** A quiet strip-dressed row for fixed grants (no decision). Returns the row
 *  so the caller can attach expansion behavior (e.g. origin-feat block). */
export function renderStripInfoRow(parent: HTMLElement, spec: StripInfoRowSpec): HTMLElement {
  const row = parent.createDiv({ cls: "pc-dstrip-row info" });
  row.createSpan({ cls: "pc-dstrip-pill", text: spec.pill });
  row.createSpan({ cls: "pc-dstrip-name", text: spec.name });
  row.createSpan({ cls: "pc-dstrip-val", text: spec.value });
  return row;
}
