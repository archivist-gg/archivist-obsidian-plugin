import type { ComponentRenderContext } from "../component.types";
import type { StartingEquipmentEntry, EquipmentGrant, StartingGold } from "../../../../shared/types/equipment-grant";
import type { ChoiceValue } from "../../pc.types";
import type { DecisionItem, DecisionLedger } from "../../pc.decision-engine";
import { buildDecisionLedger, bareEntitySlug } from "../../pc.decision-engine";
import { renderSectionRule } from "./chronicle-block";
import { renderDecisionStrip } from "./decision-strip";
import { InventoryList } from "../inventory/inventory-list";
import { CurrencyStrip } from "../inventory/currency-strip";
import { BrowseMode } from "../inventory/browse-mode";
import { resolveGrants, type GrantedEntry, type SeedRegistry } from "../../builder/equipment-seed";

type Mode = "starting" | "gold" | "empty";

/** SP2 Equipment step (Task C2). Three modes via the `.pc-bmtab` pills
 *  (matching the Abilities step tab idiom): Starting Equipment (option rows +
 *  nested category pickers, seeded
 *  live into the inventory), Buy with Gold (placeholder until Task C3), and
 *  Start Empty (a quiet note). The Starting mode resolves the chosen options'
 *  grants on every render and reconciles them through `syncStartingEquipment`
 *  (no-op guarded, so it never loops), then renders the live inventory panel. */
export function renderEquipmentStep(body: HTMLElement, ctx: ComponentRenderContext): void {
  const def = ctx.resolved.definition;
  const mode: Mode = (def.builder_equipment_mode as Mode | undefined) ?? "starting";

  renderModeToggle(body, ctx, mode);

  if (mode === "empty") {
    body.createDiv({
      cls: "pc-bclass-orphan",
      text: "Starting with no equipment. Add gear anytime from the Inventory tab.",
    });
    return;
  }
  if (mode === "gold") {
    renderBuyWithGold(body, ctx);
    return;
  }

  renderStartingChoices(body, ctx);
  // Runs every render and may fire syncStartingEquipment→onChange→a synchronous
  // full re-render (re-entrant). Safe: syncStartingEquipment's no-op guard makes
  // the re-entrant pass a no-op, so recursion self-terminates at depth 2 and the
  // inner render produces the visible DOM.
  syncFromSelections(ctx);
  renderInventoryPanel(body, ctx);
}

// ── mode toggle ──────────────────────────────────────────────────────────────

function renderModeToggle(body: HTMLElement, ctx: ComponentRenderContext, mode: Mode): void {
  const seg = body.createDiv({ cls: "pc-bmethods" });
  const tab = (m: Mode, label: string): void => {
    const el = seg.createEl("button", { cls: `pc-bmtab${mode === m ? " on" : ""}`, text: label });
    el.addEventListener("click", () => {
      if (m !== mode) ctx.editState?.setBuilderEquipmentMode(m);
    });
  };
  tab("starting", "Starting Equipment");
  tab("gold", "Buy with Gold");
  tab("empty", "Start Empty");
}

// ── starting-equipment choices ───────────────────────────────────────────────

/** Per-source groups (class + background) of starting-equipment choice rows.
 *  The ledger is the source of truth for the nested category children — we read
 *  the `equipment-${i}` DecisionItem off it so a selected option's revealed
 *  `select-entity` children render through the SAME decision-strip picker the
 *  rest of the builder uses. */
function renderStartingChoices(body: HTMLElement, ctx: ComponentRenderContext): void {
  const ledger = buildDecisionLedger(ctx.resolved, { registry: ctx.core.entities });
  const def = ctx.resolved.definition;

  const classEntity = ctx.resolved.classes[0]?.entity ?? null;
  const classEquip = classEntity?.starting_equipment ?? [];
  if (hasChoice(classEquip)) {
    renderSectionRule(body, classEntity?.name ?? "Class", "Starting Equipment");
    renderSourceChoices(body, ctx, ledger, {
      entries: classEquip, scope: "class",
      readChoice: (key) => readClassChoice(ctx, key),
      writeChoice: (key, value) => ctx.editState?.setChoice(0, 1, key, value),
    });
  }

  const bg = ctx.resolved.background as { name?: string; starting_equipment?: StartingEquipmentEntry[] } | null;
  const bgEquip = bg?.starting_equipment ?? [];
  if (hasChoice(bgEquip)) {
    renderSectionRule(body, bg?.name ?? "Background", "Starting Equipment");
    renderSourceChoices(body, ctx, ledger, {
      entries: bgEquip, scope: "background",
      readChoice: (key) => readOriginChoice(ctx, key),
      writeChoice: (key, value) => ctx.editState?.setOriginChoice(`background:${key}`, value),
    });
  }
}

interface SourceChoiceWiring {
  entries: StartingEquipmentEntry[];
  scope: "class" | "background";
  readChoice: (key: string) => ChoiceValue | undefined;
  writeChoice: (key: string, value: unknown) => void;
}

function renderSourceChoices(
  body: HTMLElement,
  ctx: ComponentRenderContext,
  ledger: DecisionLedger,
  w: SourceChoiceWiring,
): void {
  w.entries.forEach((entry, i) => {
    if (entry.kind !== "choice") return;
    const key = `equipment-${i}`;
    const selected = w.readChoice(key);
    const selectedIdx = typeof selected === "string" ? optionIndex(selected) : null;

    const group = body.createDiv({ cls: "pc-cb-eqgroup" });
    entry.options.forEach((opt, j) => {
      const sel = selectedIdx === j;
      const row = group.createDiv({ cls: `pc-cb-eqopt interactive${sel ? " sel" : ""}` });
      row.createSpan({ cls: "pc-cb-eqltr", text: letter(j) });
      row.createSpan({ cls: "pc-cb-eqtext", text: opt.label });
      const gold = goldOf(opt.grants);
      if (gold > 0) row.createSpan({ cls: "pc-cb-eqgold", text: `+${gold} GP` });
      row.addEventListener("click", () => w.writeChoice(key, `option-${j}`));
    });

    // §GAP — nested category pickers. A selected option whose grants include a
    // `{category}` exposes nested select-entity children on the engine-built
    // DecisionItem (revealed-on-selection). Render those children through the
    // SAME decision-strip select-entity picker the rest of the builder uses, so
    // each pick writes under its category child key (equipment-${i}-opt-${j}-
    // cat-${k}) via the strip's writeValue → the path syncFromSelections reads.
    if (selectedIdx != null) {
      renderNestedCategoryPickers(group, ctx, ledger, w.scope, key);
    }
  });
}

/** Find the engine-built `equipment-${i}` DecisionItem in the right scope and
 *  feed its selected branch's nested `select-entity` children to the shared
 *  decision strip. The children are top-level rows of their own little strip;
 *  the strip's registry-backed picker (inline selection table for short lists,
 *  "Browse all N ▸" modal past 12) writes the concrete weapon/armor slug under
 *  the child key. */
function renderNestedCategoryPickers(
  group: HTMLElement,
  ctx: ComponentRenderContext,
  ledger: DecisionLedger,
  scope: "class" | "background",
  equipKey: string,
): void {
  const item = findEquipmentItem(ledger, scope, equipKey);
  const children = item?.children ?? [];
  if (!children.length) return;
  const nest = group.createDiv({ cls: "pc-cb-eqnest" });
  // classIndex 0: the engine gates equipment choices to the first class, and a
  // background child carries source.kind === "background" so the strip routes it
  // to setOriginChoice regardless of classIndex.
  renderDecisionStrip(nest, ctx, {
    items: children,
    pill: () => "Pick",
    live: true,
    classIndex: 0,
    stateKey: `builder.equip.${scope}.${equipKey}`,
  });
}

function findEquipmentItem(
  ledger: DecisionLedger,
  scope: "class" | "background",
  equipKey: string,
): DecisionItem | undefined {
  if (scope === "class") {
    const cls = ledger.classes.find((c) => c.classIndex === 0);
    for (const lvl of cls?.levels ?? []) {
      const hit = lvl.items.find((it) => it.key === equipKey);
      if (hit) return hit;
    }
    return undefined;
  }
  return ledger.origin.find((it) => it.source.kind === "background" && it.key === equipKey);
}

// ── live reconcile ───────────────────────────────────────────────────────────

/** Resolve the currently-chosen options' grants (+ their nested category picks)
 *  into seedable entries + total gold, then hand them to the no-op-guarded
 *  `syncStartingEquipment`. Safe to call on every render. */
function syncFromSelections(ctx: ComponentRenderContext): void {
  const reg = seedRegistry(ctx);
  const all: GrantedEntry[] = [];
  let totalGold = 0;

  const consume = (
    entries: StartingEquipmentEntry[],
    scope: "class" | "background",
    read: (key: string) => ChoiceValue | undefined,
  ): void => {
    entries.forEach((entry, i) => {
      if (entry.kind === "gold") { totalGold += entry.amount; return; }
      if (entry.kind === "fixed") {
        const { entries: e, gold } = resolveGrants(entry.grants, {}, reg);
        all.push(...e); totalGold += gold;
        return;
      }
      // choice
      const selected = read(`equipment-${i}`);
      const j = typeof selected === "string" ? optionIndex(selected) : null;
      if (j == null) return;
      const opt = entry.options[j];
      if (!opt) return;
      // categoryKeys in the SAME ORDER as the {category} grants on this option.
      const categoryKeys = opt.grants.flatMap((g, k) =>
        "category" in g && g.category ? [`equipment-${i}-opt-${j}-cat-${k}`] : []);
      const picks: Record<string, string> = {};
      for (const ck of categoryKeys) {
        const v = scope === "class" ? readClassChoice(ctx, ck) : readOriginChoice(ctx, ck);
        if (typeof v === "string" && v) picks[ck] = v;
      }
      const { entries: e, gold } = resolveGrants(opt.grants, picks, reg, categoryKeys);
      all.push(...e); totalGold += gold;
    });
  };

  const classEquip = ctx.resolved.classes[0]?.entity?.starting_equipment ?? [];
  consume(classEquip, "class", (key) => readClassChoice(ctx, key));

  const bg = ctx.resolved.background as { starting_equipment?: StartingEquipmentEntry[] } | null;
  consume(bg?.starting_equipment ?? [], "background", (key) => readOriginChoice(ctx, key));

  ctx.editState?.syncStartingEquipment(all, totalGold);
}

// ── inventory panel ──────────────────────────────────────────────────────────

function renderInventoryPanel(body: HTMLElement, ctx: ComponentRenderContext): void {
  const equipment = ctx.resolved.definition.equipment ?? [];
  const gp = ctx.resolved.definition.currency?.gp ?? 0;
  renderSectionRule(body, "Starting Inventory", `${equipment.length} item${equipment.length === 1 ? "" : "s"} · ${gp} gp`);
  new InventoryList().render(body, ctx);
  // Scoped wrapper gives the currency strip clear breathing room below the
  // inventory list (the shared CurrencyStrip carries no top margin of its own);
  // the Inventory tab does not render a CurrencyStrip, so this is local.
  const currency = body.createDiv({ cls: "pc-beq-currency" });
  new CurrencyStrip().render(currency, ctx);
}

// ── Buy with Gold ────────────────────────────────────────────────────────────

/** The starting-gold budget. `fixed` gp (2024) wins; else a 2014 `dice` roll
 *  uses its AVERAGE (×multiplier, e.g. "5d4" × 10 = 125; no Roll/Average toggle
 *  yet — deferred). If neither is set, fall back to the largest gold-only option
 *  in the class's starting_equipment (the 2024 "take gold instead" branch). */
function startingBudget(ctx: ComponentRenderContext): number {
  const cls = ctx.resolved.classes?.[0]?.entity as
    | { starting_gold?: StartingGold; starting_equipment?: StartingEquipmentEntry[] }
    | undefined;
  const sg = cls?.starting_gold;
  if (sg?.fixed != null) return sg.fixed;
  if (sg?.dice) {
    const m = sg.dice.match(/^(\d+)d(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      const d = Number(m[2]);
      return Math.floor(n * ((d + 1) / 2) * (sg.multiplier ?? 1));
    }
  }
  // Fallback: the largest gold-only option in starting_equipment.
  let max = 0;
  for (const eq of cls?.starting_equipment ?? []) {
    if (eq.kind !== "choice") continue;
    for (const opt of eq.options) {
      const g = goldOf(opt.grants);
      if (g > max) max = g;
    }
  }
  return max;
}

/** Read an item entity's gp price from the registry. The runtime gear data
 *  carries a `cost` field (number or numeric string like "50.00"); it is absent
 *  on virtually all entities today, so this returns 0 for most — the spent-sum
 *  degrades gracefully (the meter shows the full budget remaining). */
function itemCost(reg: { getBySlug?: (s: string) => { data?: { cost?: number | string } } | null } | undefined, slug: string): number {
  const raw = reg?.getBySlug?.(slug)?.data?.cost;
  const n = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** Buy-with-Gold mode: a starting-gold budget meter (real .pc-bctx idiom) over
 *  the live compendium browse table whose "+ Add" tags each item
 *  `builder:gold-buy`. Spent gp is the sum of those items' costs; the remaining
 *  budget is mirrored into `currency.gp` (equality-guarded so the
 *  setCurrency→onChange→re-render converges instead of looping). */
function renderBuyWithGold(body: HTMLElement, ctx: ComponentRenderContext): void {
  const def = ctx.resolved.definition;
  const budget = startingBudget(ctx);
  const reg = ctx.core?.entities as { getBySlug?: (s: string) => { data?: { cost?: number | string } } | null } | undefined;

  let spent = 0;
  for (const e of def.equipment ?? []) {
    if (e.granted_by !== "builder:gold-buy") continue;
    const slug = e.item.match(/^\[\[(.+)\]\]$/)?.[1];
    if (slug) spent += itemCost(reg, slug);
  }
  const remaining = Math.max(0, budget - spent);
  const over = spent > budget;

  const bar = body.createDiv({ cls: `pc-bctx${over ? " pc-bctx-over" : ""}` });
  bar.createSpan({ cls: "pc-bctx-l", text: "Starting Gold" });
  const meter = bar.createDiv({ cls: "pc-bmeter" });
  meter.createSpan({ cls: `pc-bmeter-t${over ? " over" : ""}`, text: `${spent} of ${budget} gp spent` });
  const track = meter.createDiv({ cls: "pc-bmeter-bar" });
  const fill = track.createDiv({ cls: "pc-bmeter-fill" });
  fill.style.width = `${budget ? Math.min(100, (spent / budget) * 100) : 0}%`;
  bar.createSpan({ cls: "pc-bleft-n", text: String(remaining) });
  bar.createSpan({ cls: `pc-bleft-l${over ? " over" : ""}`, text: "left" });

  // Keep currency.gp in sync with the remaining budget. Equality-guarded so the
  // setCurrency→onChange→full re-render converges (no loop), same pattern as the
  // starting-mode syncStartingEquipment no-op guard. setBuilderEquipmentMode
  // already cleared builder:starting gear on the switch into gold, so there is
  // no starting-mode/gold-mode gp conflict to reconcile here.
  if ((def.currency?.gp ?? 0) !== remaining) ctx.editState?.setCurrency("gp", remaining);

  // The live compendium browse table; its "+ Add" tags items builder:gold-buy.
  new BrowseMode({
    filters: { status: "all", types: new Set(), rarities: new Set(), search: "" },
    addProvenance: "builder:gold-buy",
  }).render(body, ctx);

  renderInventoryPanel(body, ctx);
}

// ── seed registry adapter ────────────────────────────────────────────────────

interface BareEntity { fullSlug: string; entityType: string; name: string; packContents?: string[]; }

/** Build the SeedRegistry the seeder needs over `ctx.core.entities`. Resolves a
 *  bare slug ("chain-mail") to its full edition slug + entityType via a
 *  bare→entity Map built ONCE per call (mirrors the `byBare` idiom in
 *  `pc.decision-engine.ts`): one bounded `search("", type, …)` per candidate
 *  type, keyed by `bareEntitySlug(e.slug)` so "{item:'chain-mail'}" resolves to
 *  "srd-2024_chain-mail". `lookup`/`isShield` are then O(1) per grant (the prior
 *  code re-scanned the full pools per lookup, twice per armor grant, every
 *  render). On a bare-slug collision across types the first insert wins, matching
 *  the prior search order (weapon, then armor, then item). Shields are detected
 *  by SLUG/NAME — NOT category: the real 2024 shield entity carries
 *  `category: "heavy"` (and 2014 has no shield entry), so a category check would
 *  never fire and would mis-slot a shield into the armor slot. Pack contents have
 *  no structured field in the runtime data, so `packContents` stays undefined
 *  (forward-compatible; a resolvable pack item seeds as-is). */
function seedRegistry(ctx: ComponentRenderContext): SeedRegistry {
  const reg = ctx.core.entities;
  const byBare = new Map<string, BareEntity>();
  for (const type of ["weapon", "armor", "item"]) {
    for (const e of reg.search("", type, Number.POSITIVE_INFINITY) as Array<{ slug: string; name: string; entityType?: string; data?: { packContents?: string[] } }>) {
      const bare = bareEntitySlug(e.slug);
      if (byBare.has(bare)) continue; // first-wins across types (weapon → armor → item)
      byBare.set(bare, { fullSlug: e.slug, entityType: e.entityType ?? type, name: e.name, packContents: e.data?.packContents });
    }
  }

  return {
    lookup: (bare) => {
      const e = byBare.get(bare);
      if (!e) return null;
      return { fullSlug: e.fullSlug, entityType: e.entityType, packContents: e.packContents };
    },
    isShield: (bare) => {
      if (bare === "shield") return true;
      const e = byBare.get(bare);
      if (!e) return false;
      return e.fullSlug.endsWith("_shield") || e.name === "Shield";
    },
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function hasChoice(entries: StartingEquipmentEntry[]): boolean {
  return entries.some((e) => e.kind === "choice");
}

function goldOf(grants: EquipmentGrant[]): number {
  return grants.reduce((sum, g) => sum + ("gold" in g ? g.gold : 0), 0);
}

/** "option-1" → 1; null on malformed. */
function optionIndex(value: string): number | null {
  const m = value.match(/^option-(\d+)$/);
  return m ? Number(m[1]) : null;
}

function letter(j: number): string {
  return String.fromCharCode(97 + j); // a, b, c, …
}

function readClassChoice(ctx: ComponentRenderContext, key: string): ChoiceValue | undefined {
  const cls = ctx.resolved.definition.class?.[0];
  const lvl = (cls?.choices as Record<number, Record<string, ChoiceValue>> | undefined)?.[1];
  return lvl?.[key];
}

function readOriginChoice(ctx: ComponentRenderContext, key: string): ChoiceValue | undefined {
  return ctx.resolved.definition.origin_choices?.[`background:${key}`];
}
