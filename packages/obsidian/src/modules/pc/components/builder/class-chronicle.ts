import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { DecisionItem, DecisionLedger } from "../../pc.decision-engine";
import type { Feature } from "../../../../shared/types/feature";
import type { StartingEquipmentEntry } from "../../../../shared/types/equipment-grant";
import { recognizeDecision } from "../../decision-recognizer";
import { renderChronicleBlock, renderSectionRule, firstSentence } from "./chronicle-block";
import { renderDecisionStrip } from "./decision-strip";
import { humanizeSlug, grantLabel } from "../../../../shared/rendering/renderer-utils";

/** Structural view of the class runtime entity (class.types.ts). */
export interface ClassData {
  hit_die?: string;
  primary_abilities?: string[];
  saving_throws?: string[];
  skill_choices?: { count: number; from: string[] } | null;
  proficiencies?: { armor?: string[]; weapons?: { fixed?: string[]; categories?: string[] } };
  spellcasting?: { ability: string; preparation: string; spell_list: string } | null;
  subclass_level?: number | null;
  subclass_feature_name?: string | null;
  starting_equipment?: StartingEquipmentEntry[];
  table?: Record<number, { prof_bonus: number; columns?: Record<string, string | number>; feature_ids: string[] }>;
  features_by_level?: Record<number, Array<{ id?: string; name: string; description?: string; choices?: unknown[] }>>;
  description?: string;
  source?: string;
  edition?: string;
}

export interface BrowseDecision { level: number; name: string }

/** A class-entity feature as it appears in the per-level arrays the timeline /
 *  progression render from. Class `features_by_level` is typed inline on
 *  ClassData; subclass features arrive as the shared `Feature` shape — both
 *  narrow to this minimal structural view. */
export interface ChronicleFeature { id?: string; name: string; description?: string; choices?: unknown[] }

/** Structural view of a subclass runtime entity (subclass.types.ts) — only the
 *  fields the class card consumes when merging granted features. */
export interface SubclassData {
  name?: string;
  features_by_level?: Record<number, ChronicleFeature[]>;
}

/** One merged-feature entry: the feature plus whether it was granted by the
 *  picked subclass (true) or the base class (false). */
export interface MergedFeature { f: ChronicleFeature; fromSubclass: boolean }

export interface ClassChronicleOptions {
  entity: RegisteredEntity;
  /** Scoping level: owned → the class entry's level; browse → 1. */
  level: number;
  mode: "browse" | "owned";
  /** Owned only: index for setChoice/setSubclass writes. */
  classIndex?: number;
  /** Owned only: a prebuilt ledger (the card stack builds one for all cards). */
  ledger?: DecisionLedger;
  /** Owned only: the picked subclass's registered entity, when the entry has a
   *  subclass. Its granted features fold into the card's timeline & progression
   *  (Fix A). Browse mode stays class-only — never supply this there. */
  subclassEntity?: RegisteredEntity;
  /** Owned-card mode (smoke r7): the chosen subclass's display name, rendered as
   *  a tag next to the class title in the identity area ("Fighter · Champion"),
   *  NOT in the band's right controls. */
  subclassName?: string;
  stateKey: string;
  /** Owned-card mode (smoke r6): inline band controls (level select / subclass
   *  name / remove ghost). Threaded to the block's `bandRight` hook so the band
   *  is the card's one header — no separate strip above. */
  bandRight?: (host: HTMLElement) => void;
  /** Owned-card mode: makes the band the collapse handle. When `collapsed`, the
   *  block renders only the band (+ controls + chevron); the body unmounts. */
  collapsible?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Owned-card mode: content rendered at the TOP of the expanded body, inside
   *  the block frame (the multiclass prereq amber note). Lives in the body hook
   *  so it unmounts with the rest when the band is collapsed. */
  pre?: (host: HTMLElement) => void;
}

const ABILITY_NAME: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

/** A feature's `choices` are typed `unknown[]` in the local ClassData cast;
 *  this narrows safely to "an authored subclass pick" (the runtime JSON shape
 *  `{ kind: "select-entity", entity_type: "subclass" }`). */
function isAuthoredSubclassChoice(c: unknown): boolean {
  return (
    typeof c === "object" && c !== null &&
    (c as { kind?: unknown }).kind === "select-entity" &&
    (c as { entity_type?: unknown }).entity_type === "subclass"
  );
}

/** Browse-side walker: every authored feature choice, plus recognizer-synthesized
 *  homebrew decisions (the recognizer returns Choice[] for those), skipping
 *  informational prose (it returns "informational") and plain features (null).
 *  The subclass pick is guaranteed a row off subclass_level even when the
 *  runtime JSON lacks the authored select-entity (the 2024 Bard gap). The
 *  guarantee fires on "no authored subclass choice was seen" — not on a name
 *  match — because `subclass_feature_name` ("Cleric Subclass") and the authored
 *  feature's own name ("Cleric Subclasses") come from different source fields
 *  and need not agree, which would otherwise synthesize a duplicate L3 row. */
export function collectBrowseDecisions(d: ClassData): BrowseDecision[] {
  const out: BrowseDecision[] = [];
  let sawAuthoredSubclass = false;
  for (const [lvl, feats] of Object.entries(d.features_by_level ?? {})) {
    for (const f of feats) {
      const authored = (f.choices?.length ?? 0) > 0;
      if (authored && f.choices!.some(isAuthoredSubclassChoice)) sawAuthoredSubclass = true;
      const recognized = !authored && recognizeDecision(f as unknown as Feature);
      if (authored || (recognized && recognized !== "informational")) {
        out.push({ level: Number(lvl), name: f.name });
      }
    }
  }
  if (d.subclass_level && !sawAuthoredSubclass) {
    out.push({ level: d.subclass_level, name: d.subclass_feature_name ?? "Subclass" });
  }
  return out.sort((a, b) => a.level - b.level);
}

/** The UNGATED union of a class's and its picked subclass's `features_by_level`,
 *  keyed by level (every level 1–20 that either grants a feature). Each entry is
 *  tagged `fromSubclass` so the card can dress subclass-granted features
 *  distinctly (crimson `.sub`).
 *
 *  This is a DIFFERENT projection from the resolver's level-gated merge
 *  (pc.resolver collectResolvedFeatures, which drops levels above the character
 *  level): the class card's timeline & progression deliberately show FUTURE
 *  levels (locked/ahead rows), so this union keeps all levels and lets the
 *  renderer scope by `level` for display. Pure over (classData, subclassData). */
export function mergedFeaturesByLevel(
  classData: ClassData,
  subclassData: SubclassData | undefined,
): Record<number, MergedFeature[]> {
  const out: Record<number, MergedFeature[]> = {};
  const add = (src: Record<number, ChronicleFeature[]> | undefined, fromSubclass: boolean): void => {
    for (const [lvlStr, feats] of Object.entries(src ?? {})) {
      const lvl = Number(lvlStr);
      const arr = (out[lvl] ??= []);
      for (const f of feats) arr.push({ f, fromSubclass });
    }
  };
  add(classData.features_by_level, false);
  add(subclassData?.features_by_level, true);
  return out;
}

/** Narrow a subclass RegisteredEntity to the fields the card consumes. The
 *  registry's `data` (Record<string, unknown>) structurally satisfies the
 *  all-optional SubclassData view, so no cast is needed. */
function subclassDataOf(opts: ClassChronicleOptions): SubclassData | undefined {
  return opts.subclassEntity?.data;
}

export function renderClassChronicle(host: HTMLElement, ctx: ComponentRenderContext, opts: ClassChronicleOptions): void {
  const d = opts.entity.data as ClassData;
  renderChronicleBlock(host, {
    name: opts.entity.name,
    // Chosen subclass tag next to the title: "Fighter · Champion" (smoke r7).
    nameSuffix: opts.subclassName
      ? (nameEl) => nameEl.createSpan({ cls: "pc-bccard-sub", text: ` · ${opts.subclassName}` })
      : undefined,
    sub: [
      "Class",
      d.hit_die ? `Hit Die ${d.hit_die}` : "",
      (d.primary_abilities ?? []).map((a) => ABILITY_NAME[a] ?? a.toUpperCase()).join(" & "),
      // "Level N of 20" is redundant with the owned card's inline LV control
      // sitting right there in the band (smoke r6) — keep it for browse only.
      opts.mode === "browse" ? `Level ${opts.level} of 20` : "",
    ].filter(Boolean).join(" · "),
    badge: [d.source, d.edition].filter(Boolean).join(" · ") || undefined,
    flavor: d.description?.trim() ? firstSentence(d.description.trim()) : undefined,
    tiles: classTiles(d),
    bandRight: opts.bandRight,
    collapsible: opts.collapsible,
    collapsed: opts.collapsed,
    onToggleCollapse: opts.onToggleCollapse,
    body: (block) => {
      opts.pre?.(block);                           // owned prereq note (unmounts on collapse)
      renderDecisions(block, ctx, d, opts);
      renderFolds(block, ctx, d, opts);            // Tasks 9–10 fill the bodies in
    },
  });
}

function classTiles(d: ClassData): Array<{ label: string; value: string; small?: string }> {
  // Skills ("2 of 9") and Subclass ("at L3") tiles were dropped (smoke r4): the
  // same facts live in the decision-strip rows below, so surfacing them atop the
  // block was redundant. Keep the static identity facts only.
  return [
    ...(d.hit_die ? [{ label: "Hit Die", value: d.hit_die }] : []),
    ...(d.saving_throws?.length ? [{ label: "Saves", value: d.saving_throws.map((s) => s.toUpperCase()).join(" · ") }] : []),
    ...(d.primary_abilities?.length
      ? [{ label: "Primary", value: d.primary_abilities.map((a) => ABILITY_NAME[a] ?? a.toUpperCase()).join(" · ") }] : []),
    ...(d.spellcasting
      ? [{ label: "Spellcasting", value: d.spellcasting.ability.toUpperCase(), small: d.spellcasting.preparation }] : []),
  ];
}

function renderDecisions(block: HTMLElement, ctx: ComponentRenderContext, d: ClassData, opts: ClassChronicleOptions): void {
  if (opts.mode === "browse") {
    const rows = collectBrowseDecisions(d);
    if (!rows.length) return;
    renderSectionRule(block, "What you decide", `${rows.length} ahead`);
    const root = block.createDiv({ cls: "pc-dstrip" });
    for (const r of rows) {
      const row = root.createDiv({ cls: `pc-dstrip-row${r.level <= opts.level ? " req" : ""}` });
      row.createSpan({ cls: "pc-dstrip-pill", text: `L${r.level}` });
      row.createSpan({ cls: "pc-dstrip-name", text: r.name });
      row.createSpan({ cls: "pc-dstrip-val", text: `at level ${r.level}` });
    }
    return;
  }
  // Owned: the live always-open strip with level pills; equipment picks are
  // the Equipment step's scope (keys synthesized as `equipment-{i}`).
  const items: DecisionItem[] = (opts.ledger?.classes.find((c) => c.classIndex === (opts.classIndex ?? 0))?.levels ?? [])
    .flatMap((l) => l.items)
    .filter((i) => !i.key.startsWith("equipment-"));
  if (!items.length) return;
  // The strip shows every gained feature (informational cards for plain flavor), but
  // the header counts only real DECISIONS — informational items need no player input.
  const decisions = items.filter((i) => i.status !== "informational");
  const done = decisions.filter((i) => i.status === "resolved").length;
  renderSectionRule(block, "Decisions", `${decisions.length} decision${decisions.length === 1 ? "" : "s"} · ${done} resolved · ${decisions.length - done} open`);
  renderDecisionStrip(block, ctx, {
    items, pill: (i) => `L${i.level}`, live: true, classIndex: opts.classIndex ?? 0, stateKey: `${opts.stateKey}.strip`,
  });
}

// ── folds ─────────────────────────────────────────────────────────────────
// Real fold mechanics (open-state in builderUiState). The Progression /
// Features / Equipment BODIES are one-line placeholders Tasks 9–10 replace.

interface FoldSpec { id: string; label: string; right?: string; defaultOpen: boolean; body: (host: HTMLElement) => void; }

function renderFold(parent: HTMLElement, ctx: ComponentRenderContext, stateKey: string, spec: FoldSpec): void {
  const bag = ctx.builderUiState;
  const key = `${stateKey}.folds`;
  const folds = (bag?.get(key) as Record<string, boolean> | undefined) ?? {};
  bag?.set(key, folds);
  const host = parent.createDiv();
  const draw = (): void => {
    host.empty();
    const open = folds[spec.id] ?? spec.defaultOpen;
    const fold = host.createDiv({ cls: "pc-cb-fold" });
    const h = fold.createDiv({ cls: "pc-cb-fold-h" });
    h.createSpan({ cls: "pc-cb-fold-chev", text: open ? "▾" : "▸" });
    h.createSpan({ cls: "pc-cb-sec-l", text: spec.label });
    if (spec.right) h.createSpan({ cls: "pc-cb-sec-r", text: spec.right });
    h.addEventListener("click", () => { folds[spec.id] = !open; draw(); });
    if (open) spec.body(fold.createDiv({ cls: "pc-cb-fold-body" }));
  };
  draw();
}

function renderFolds(block: HTMLElement, ctx: ComponentRenderContext, d: ClassData, opts: ClassChronicleOptions): void {
  const browse = opts.mode === "browse";
  // A quiet right-side count on the Features header so the (collapsed-by-default
  // in owned mode) fold reads as content-bearing — the subclass features live in
  // here, so the user needs to know it's worth opening.
  const featureCount = Object.values(mergedFeaturesByLevel(d, subclassDataOf(opts)))
    .reduce((n, arr) => n + arr.length, 0);
  const featRight = [
    featureCount ? `${featureCount} feature${featureCount === 1 ? "" : "s"}` : "",
    "filled = gained · hollow = ahead",
  ].filter(Boolean).join(" · ");
  renderFold(block, ctx, opts.stateKey, { id: "prog", label: "Progression · Levels 1–20", defaultOpen: false, body: (h) => renderProgression(h, d, opts.level, subclassDataOf(opts)) });
  renderFold(block, ctx, opts.stateKey, { id: "feats", label: "Features by level", right: featRight, defaultOpen: browse, body: (h) => renderFeatureTimeline(h, ctx, d, opts) });
  renderFold(block, ctx, opts.stateKey, { id: "equip", label: "Equipment & proficiencies", defaultOpen: false, body: (h) => renderProfsEquipment(h, d) });
}

// ── progression table (1–20, dynamic columns) ───────────────────────────────

const ORDINAL_RE = /^[1-9](?:st|nd|rd|th)$/;

/** Column census over all rows, first-seen order; ordinals split out and sorted. */
export function tableColumns(table: NonNullable<ClassData["table"]>): { scalars: string[]; slots: string[] } {
  const scalars: string[] = [];
  const slots: string[] = [];
  for (const row of Object.values(table)) {
    for (const k of Object.keys(row.columns ?? {})) {
      const bucket = ORDINAL_RE.test(k) ? slots : scalars;
      if (!bucket.includes(k)) bucket.push(k);
    }
  }
  slots.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return { scalars, slots };
}

function renderProgression(host: HTMLElement, d: ClassData, level: number, subclassData?: SubclassData): void {
  const table = d.table;
  if (!table || !Object.keys(table).length) {
    host.createDiv({ cls: "pc-dstrip-empty", text: "No progression table in this class's data." });
    return;
  }
  const { scalars, slots } = tableColumns(table);
  const tracks = ["30px", "34px", "minmax(0, 1.8fr)", ...scalars.map(() => "minmax(44px, max-content)"), ...(slots.length ? ["minmax(0, 2fr)"] : [])].join(" ");
  const pt = host.createDiv({ cls: "pc-cb-pt" });
  const head = pt.createDiv({ cls: "pc-cb-pt-h" });
  head.style.gridTemplateColumns = tracks;
  for (const t of ["Lv", "Prof", "Features", ...scalars]) head.createSpan({ text: t });
  if (slots.length) {
    const sh = head.createSpan({ cls: "pc-cb-pt-slots" });
    sh.createSpan({ cls: "pc-cb-pt-slots-t", text: "Spell Slots" });
    const row = sh.createDiv({ cls: "pc-cb-pt-slotrow" });
    for (const s of slots) row.createSpan({ cls: "pc-cb-pt-s", text: s.replace(/\D/g, "") });
  }
  const levels = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (const lvl of levels) {
    const r = table[lvl];
    const row = pt.createDiv({ cls: `pc-cb-pt-r${lvl === level ? " cur" : ""}` });
    row.style.gridTemplateColumns = tracks;
    row.createSpan({ cls: "pc-cb-pt-lvl", text: String(lvl) });
    row.createSpan({ cls: "pc-cb-pt-pb", text: `+${r.prof_bonus}` });
    renderFeatureNames(row.createSpan({ cls: "pc-cb-pt-feat" }), d, lvl, r.feature_ids, subclassData);
    for (const k of scalars) row.createSpan({ cls: "pc-cb-pt-n", text: String(r.columns?.[k] ?? "—") });
    if (slots.length) {
      const cell = row.createSpan({ cls: "pc-cb-pt-slotrow" });
      for (const s of slots) {
        const v = r.columns?.[s];
        // en-dash "–" = slot tier not yet available; scalars use em-dash "—" = no data
        cell.createSpan({ cls: `pc-cb-pt-s${v == null || v === 0 || v === "0" ? " z" : ""}`, text: v == null ? "–" : String(v) });
      }
    }
  }
}

function renderFeatureNames(
  cell: HTMLElement,
  d: ClassData,
  lvl: number,
  ids: string[],
  subclassData?: SubclassData,
): void {
  const subFeats = subclassData?.features_by_level?.[lvl] ?? [];
  if (!ids.length && !subFeats.length) { cell.setText("—"); return; }
  const feats = d.features_by_level?.[lvl] ?? [];
  let written = 0;
  ids.forEach((id) => {
    const f = feats.find((x) => x.id === id);
    const name = f?.name ?? humanizeSlug(id);
    // The class "subclass feature" placeholder (e.g. "Bard Subclass") wears the
    // crimson `.sub` dress too — it's where the subclass is chosen.
    const isSub = name === (d.subclass_feature_name ?? "");
    const isAsi = /ability score improvement|epic boon/i.test(name);
    cell.createSpan({ cls: isSub ? "sub" : isAsi ? "asi" : "", text: `${written++ ? ", " : ""}${name}` });
  });
  // Subclass-granted features (Fix A) append at their levels, crimson `.sub`.
  for (const f of subFeats) {
    cell.createSpan({ cls: "sub", text: `${written++ ? ", " : ""}${f.name}` });
  }
}

function renderFeatureTimeline(host: HTMLElement, ctx: ComponentRenderContext, d: ClassData, opts: ClassChronicleOptions): void {
  // Merged class + (owned) picked-subclass features, ungated; the scope filter
  // below applies the level window. Subclass features wear a crimson attribution.
  const subName = subclassDataOf(opts)?.name ?? opts.subclassEntity?.name;
  const merged = mergedFeaturesByLevel(d, subclassDataOf(opts));
  const all = Object.entries(merged)
    .flatMap(([lvl, entries]) => entries.map((m) => ({ lvl: Number(lvl), f: m.f, fromSubclass: m.fromSubclass })))
    .sort((a, b) => a.lvl - b.lvl);
  if (!all.length) {
    host.createDiv({ cls: "pc-dstrip-empty", text: "No feature data for this class." });
    return;
  }
  const bag = ctx.builderUiState;
  const key = `${opts.stateKey}.showall`;
  // Default = the Chronicle-mockup presentation: every level listed, hollow
  // medallions marking levels ahead. The ghost still scopes to gained-only,
  // and an explicit choice in the bag wins per card.
  const showAll = (bag?.get(key) as boolean | undefined) ?? true;
  const scoped = showAll ? all : all.filter((e) => e.lvl <= opts.level);
  const scope = host.createDiv({ cls: "pc-cb-scope" });
  scope.createSpan({ cls: "pc-cb-scope-l", text: showAll ? "All 20 levels" : `Through level ${opts.level}` });
  const ghost = scope.createSpan({ cls: "pc-cb-ghost", text: showAll ? `scope to level ${opts.level}` : "show all levels" });
  ghost.addEventListener("click", () => {
    bag?.set(key, !showAll);
    host.empty();
    renderFeatureTimeline(host, ctx, d, opts);
  });
  const tl = host.createDiv({ cls: "pc-cb-timeline" });
  for (const { lvl, f, fromSubclass } of scoped) {
    const state = lvl === opts.level ? "cur" : lvl < opts.level ? "have" : "locked";
    const e = tl.createDiv({ cls: `pc-cb-tle ${state}` });
    e.createSpan({ cls: "pc-cb-med", text: String(lvl) });
    const n = e.createDiv({ cls: "pc-cb-fn", text: f.name });
    // Subclass-granted features get a quiet crimson attribution suffix so they
    // read as "from <Subclass>", distinct from base-class features.
    if (fromSubclass) n.createSpan({ cls: "sub", text: subName ? ` · ${subName}` : " · Subclass" });
    if ((f.choices?.length ?? 0) > 0) n.createSpan({ cls: "pc-cb-fmeta", text: "▸ decision" });
    if (f.description) {
      const head = firstSentence(f.description);
      const desc = e.createDiv({ cls: "pc-cb-fd", text: head });
      // trimEnd so a description with only trailing whitespace past `head`
      // doesn't surface a "Read full" that reveals nothing but blanks.
      if (head.length < f.description.trimEnd().length) {
        const more = desc.createSpan({ cls: "pc-cb-more", text: " Read full ▸" });
        let open = false;
        more.addEventListener("click", () => {
          open = !open;
          desc.setText(open ? f.description! : head);
          desc.appendChild(more);
          more.setText(open ? " Show less ▴" : " Read full ▸");
        });
      }
    }
  }
}

export function renderProfsEquipment(host: HTMLElement, d: ClassData): void {
  if (d.saving_throws?.length) prop(host, "Saving Throws", d.saving_throws.map((s) => ABILITY_NAME[s] ?? s.toUpperCase()).join(", "));
  const w = d.proficiencies?.weapons;
  const weapons = [...(w?.categories ?? []), ...(w?.fixed ?? [])].map(humanizeSlug).join(", ");
  if (weapons) prop(host, "Weapons", weapons);
  if (d.proficiencies?.armor?.length) prop(host, "Armor", d.proficiencies.armor.map(humanizeSlug).join(", "));
  if (d.skill_choices) {
    const from = d.skill_choices.from.map(humanizeSlug);
    const shown = from.slice(0, 6).join(", ");
    prop(host, "Skills", `choose ${d.skill_choices.count} of: ${shown}${from.length > 6 ? ` +${from.length - 6} more` : ""}`);
  }
  for (const eq of d.starting_equipment ?? []) {
    if (eq.kind === "choice") {
      eq.options.forEach((opt, j) => {
        const row = host.createDiv({ cls: "pc-cb-eqopt" });
        row.createSpan({ cls: "pc-cb-eqltr", text: String.fromCharCode(97 + j) }); // a, b, c…
        row.createSpan({ cls: "pc-cb-eqtext", text: opt.label });
      });
    } else if (eq.kind === "fixed") {
      const text = eq.label ?? eq.grants.map(grantLabel).join(", ");
      if (text) prop(host, "Equipment", text);
    } else {
      prop(host, "Gold", `${eq.amount} GP`);
    }
  }
}

function prop(host: HTMLElement, label: string, value: string): void {
  const p = host.createDiv({ cls: "pc-cb-prop" });
  p.createSpan({ cls: "pc-cb-prop-l", text: label });
  p.createSpan({ text: value });
}
