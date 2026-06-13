import type { ComponentRenderContext } from "../component.types";
import type { StartingEquipmentEntry, EquipmentGrant } from "../../../../shared/types/equipment-grant";
import type { ChoiceValue } from "../../pc.types";
import type { DecisionItem, DecisionLedger } from "../../pc.decision-engine";
import { buildDecisionLedger, bareEntitySlug } from "../../pc.decision-engine";
import { renderSectionRule } from "./chronicle-block";
import { renderDecisionStrip } from "./decision-strip";
import { InventoryList } from "../inventory/inventory-list";
import { CurrencyStrip } from "../inventory/currency-strip";
import { resolveGrants, type GrantedEntry, type SeedRegistry } from "../../builder/equipment-seed";

type Mode = "starting" | "gold" | "empty";

/** SP2 Equipment step (Task C2). Three modes via the `.pc-bseg` segmented
 *  control: Starting Equipment (option rows + nested category pickers, seeded
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
      text: "Starting with no equipment — add gear anytime from the Inventory tab.",
    });
    return;
  }
  if (mode === "gold") {
    renderBuyWithGold(body, ctx);
    return;
  }

  renderStartingChoices(body, ctx);
  syncFromSelections(ctx);
  renderInventoryPanel(body, ctx);
}

// ── mode toggle ──────────────────────────────────────────────────────────────

function renderModeToggle(body: HTMLElement, ctx: ComponentRenderContext, mode: Mode): void {
  const seg = body.createDiv({ cls: "pc-bseg" });
  const tab = (m: Mode, label: string): void => {
    const el = seg.createEl("button", { cls: `pc-bseg-opt${mode === m ? " on" : ""}`, text: label });
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
      const row = group.createDiv({ cls: `pc-cb-eqopt${sel ? " sel" : ""}` });
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
  new CurrencyStrip().render(body, ctx);
}

// ── Buy with Gold (placeholder — Task C3 replaces) ───────────────────────────

function renderBuyWithGold(body: HTMLElement, ctx: ComponentRenderContext): void {
  void ctx;
  body.createDiv({ cls: "pc-bclass-orphan", text: "Buy with Gold — arriving in the next task." });
}

// ── seed registry adapter ────────────────────────────────────────────────────

/** Build the SeedRegistry the seeder needs over `ctx.core.entities`. Resolves a
 *  bare slug ("chain-mail") to its full edition slug + entityType by exact-bare
 *  match across the registry (the registry keys on full slugs like
 *  "srd-2024_chain-mail"). Shields are detected by SLUG/NAME — NOT category: the
 *  real 2024 shield entity carries `category: "heavy"` (and 2014 has no shield
 *  entry), so a category check would never fire and would mis-slot a shield into
 *  the armor slot. Pack contents have no structured field in the runtime data,
 *  so `packContents` is omitted (a resolvable pack item seeds as-is). */
function seedRegistry(ctx: ComponentRenderContext): SeedRegistry {
  const reg = ctx.core.entities;
  const resolve = (bare: string): { entity: { slug: string; name: string; data?: unknown }; entityType: string } | null => {
    // Direct hit (already a full slug, or a registry that keys bare).
    const direct = reg.getBySlug(bare) as { slug: string; name: string; entityType?: string; data?: unknown } | undefined;
    if (direct) return { entity: direct, entityType: direct.entityType ?? "item" };
    // Scan each candidate type for an exact bare-slug match.
    for (const type of ["weapon", "armor", "item"]) {
      for (const e of reg.search("", type, Number.POSITIVE_INFINITY) as Array<{ slug: string; name: string; entityType?: string; data?: unknown }>) {
        if (bareEntitySlug(e.slug) === bare) return { entity: e, entityType: e.entityType ?? type };
      }
    }
    return null;
  };

  return {
    lookup: (bare) => {
      const r = resolve(bare);
      if (!r) return null;
      return { fullSlug: r.entity.slug, entityType: r.entityType };
    },
    isShield: (bare) => {
      if (bare === "shield") return true;
      const r = resolve(bare);
      if (!r) return false;
      return r.entity.slug.endsWith("_shield") || r.entity.name === "Shield";
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
