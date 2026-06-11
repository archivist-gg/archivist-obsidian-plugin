import type { ComponentRenderContext } from "../component.types";
import type { RegisteredEntity } from "../../../../shared/entities/entity-registry";
import type { DecisionItem, DecisionLedger } from "../../pc.decision-engine";
import type { Feature } from "../../../../shared/types/feature";
import { recognizeDecision } from "../../decision-recognizer";
import { renderChronicleBlock, renderSectionRule, firstSentence } from "./chronicle-block";
import { renderDecisionStrip } from "./decision-strip";

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
  starting_equipment?: Array<
    { kind: "choice"; options: string[] } | { kind: "fixed"; items: string[] } | { kind: "gold"; amount: number }
  >;
  table?: Record<number, { prof_bonus: number; columns?: Record<string, string | number>; feature_ids: string[] }>;
  features_by_level?: Record<number, Array<{ id?: string; name: string; description?: string; choices?: unknown[] }>>;
  description?: string;
  source?: string;
  edition?: string;
}

export interface BrowseDecision { level: number; name: string }

export interface ClassChronicleOptions {
  entity: RegisteredEntity;
  /** Scoping level: owned → the class entry's level; browse → 1. */
  level: number;
  mode: "browse" | "owned";
  /** Owned only: index for setChoice/setSubclass writes. */
  classIndex?: number;
  /** Owned only: a prebuilt ledger (the card stack builds one for all cards). */
  ledger?: DecisionLedger;
  stateKey: string;
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

export function renderClassChronicle(host: HTMLElement, ctx: ComponentRenderContext, opts: ClassChronicleOptions): void {
  const d = opts.entity.data as ClassData;
  renderChronicleBlock(host, {
    name: opts.entity.name,
    sub: [
      "Class",
      d.hit_die ? `Hit Die ${d.hit_die}` : "",
      (d.primary_abilities ?? []).map((a) => ABILITY_NAME[a] ?? a.toUpperCase()).join(" & "),
      opts.mode === "owned" ? `Level ${opts.level} of 20` : "",
    ].filter(Boolean).join(" · "),
    badge: [d.source, d.edition].filter(Boolean).join(" · ") || undefined,
    flavor: d.description?.trim() ? firstSentence(d.description.trim()) : undefined,
    tiles: classTiles(d),
    body: (block) => {
      renderDecisions(block, ctx, d, opts);
      renderFolds(block, ctx, d, opts);            // Tasks 9–10 fill the bodies in
    },
  });
}

function classTiles(d: ClassData): Array<{ label: string; value: string; small?: string }> {
  return [
    ...(d.hit_die ? [{ label: "Hit Die", value: d.hit_die }] : []),
    ...(d.saving_throws?.length ? [{ label: "Saves", value: d.saving_throws.map((s) => s.toUpperCase()).join(" · ") }] : []),
    ...(d.primary_abilities?.length
      ? [{ label: "Primary", value: d.primary_abilities.map((a) => ABILITY_NAME[a] ?? a.toUpperCase()).join(" · ") }] : []),
    ...(d.skill_choices ? [{ label: "Skills", value: String(d.skill_choices.count), small: `of ${d.skill_choices.from.length}` }] : []),
    ...(d.subclass_level ? [{ label: "Subclass", value: `at L${d.subclass_level}` }] : []),
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
  const done = items.filter((i) => i.status === "resolved").length;
  renderSectionRule(block, "Decisions", `${items.length} total · ${done} resolved · ${items.length - done} open`);
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
  renderFold(block, ctx, opts.stateKey, { id: "prog", label: "Progression · Levels 1–20", defaultOpen: false, body: (h) => renderProgression(h, d, opts.level) });
  renderFold(block, ctx, opts.stateKey, { id: "feats", label: "Features by level", right: "filled = gained · hollow = ahead", defaultOpen: browse, body: (h) => renderFeatureTimeline(h, ctx, d, opts) });
  renderFold(block, ctx, opts.stateKey, { id: "equip", label: "Equipment & proficiencies", defaultOpen: false, body: (h) => renderProfsEquipment(h, d) });
}

// ── placeholder bodies (Tasks 9–10 replace) ─────────────────────────────────

function renderProgression(host: HTMLElement, _d: ClassData, _level: number): void {
  host.createDiv({ cls: "pc-dstrip-empty", text: "(see Progression task)" });
}

function renderFeatureTimeline(host: HTMLElement, _ctx: ComponentRenderContext, _d: ClassData, _opts: ClassChronicleOptions): void {
  host.createDiv({ cls: "pc-dstrip-empty", text: "(see Features task)" });
}

function renderProfsEquipment(host: HTMLElement, _d: ClassData): void {
  host.createDiv({ cls: "pc-dstrip-empty", text: "(see Equipment task)" });
}
