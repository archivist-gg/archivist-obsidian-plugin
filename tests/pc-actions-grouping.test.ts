/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 }, ...extra }) as unknown as ResolvedFeature;

// The pure §3.1 economy/source bucket map now lives in `action-model.ts` and is
// exercised by `pc-action-model.test.ts`; this file keeps only the ActionsTab
// integration coverage of the feature rows the tab still renders directly.

// ─────────────────────────────────────────────────────────────
// ActionsTab — grouped rows (integration)
// ─────────────────────────────────────────────────────────────
interface RenderOpts {
  attacks?: object[];
  attacksPerAction?: number;
  featureUses?: Record<string, { used: number; max: number }>;
  classes?: object[];
  totalLevel?: number;
  editState?: object | null;
  actionsDisabled?: boolean;
}

function renderCtx(features: ResolvedFeature[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [] },
      race: null, classes: opts.classes ?? [], background: null, feats: [],
      totalLevel: opts.totalLevel ?? 5, features,
      state: { feature_uses: opts.featureUses ?? {} },
    } as unknown as ResolvedCharacter,
    derived: {
      attacks: opts.attacks ?? [],
      attacksPerAction: opts.attacksPerAction ?? 1,
      conditionEffects: opts.actionsDisabled ? { actions_disabled: true, sources: [] } : undefined,
    } as never,
    services: { entities: { getBySlug: () => null } } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");
const rowNames = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-feature-row .pc-action-row-name")].map((n) => n.textContent ?? "");
const rowByName = (root: HTMLElement, name: string): HTMLElement =>
  [...root.querySelectorAll<HTMLElement>(".pc-feature-row")].find(
    (r) => r.querySelector(".pc-action-row-name")?.textContent === name,
  )!;

describe("ActionsTab — grouped structure", () => {
  it("emits Bonus Actions / Reactions / Passive headings only for non-empty buckets", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Charm", action: "bonus-action" }),
      rf({ name: "Second Wind", passive: true }),
    ]));
    const h = headings(c);
    expect(h).toContain("Bonus Actions");
    expect(h).toContain("Passive & Free Actions");
    expect(h).not.toContain("Reactions"); // empty bucket omitted
  });

  it("renders one row per ENTRY, including two same-named entries", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Extra Attack", action: "action" }),
      rf({ name: "Extra Attack", action: "action" }),
    ]));
    expect(rowNames(c).filter((n) => n === "Extra Attack").length).toBe(2);
  });

  it("does NOT render a renderSuppressed synthetic as its own row; its parent shows the chosen prose", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Turncoat", action: "action", description: "Betray your foes." },
        { chosenInline: [{ label: "Lies", description: "use Charisma for melee attack & damage" }] }),
      rf({ name: "Lies", action: "action", description: "should never surface as a row" },
        { renderSuppressed: true }),
    ]));
    // the synthetic is not a row
    expect(rowNames(c)).toEqual(["Turncoat"]);
    // the parent's card carries the chosen-pick prose
    const row = rowByName(c, "Turncoat");
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const card = row.nextElementSibling as HTMLElement;
    expect(card.textContent).toContain("Chose — Lies");
    expect(card.textContent).toContain("use Charisma");
  });

  it("puts the first resource tracker in-row and any extra resources in the expand card", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({
        name: "Reaver Seals", action: "bonus-action",
        resources: [
          { id: "r0", name: "Seals", max_formula: "3", reset: "long-rest" },
          { id: "r1", name: "Seal Damage", max_formula: "2", reset: "short-rest" },
        ],
      }),
    ], { featureUses: { r0: { used: 1, max: 3 }, r1: { used: 0, max: 2 } } }));
    const row = rowByName(c, "Reaver Seals");
    // in-row tracker for resource[0] (3 boxes, 1 checked)
    expect(row.querySelectorAll(".pc-feature-detail .archivist-toggle-box").length).toBe(3);
    // resource[1] renders only inside the expand card
    const card = row.nextElementSibling as HTMLElement;
    expect(card.querySelector(".archivist-item-block")).toBeTruthy();
    const extra = card.querySelector(".pc-card-resource");
    expect(extra?.textContent).toContain("Seal Damage");
    expect(card.querySelectorAll(".pc-card-resource .archivist-toggle-box").length).toBe(2);
  });

  it("titles the class-named resource synthetic by its resource name, not the class name", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Illrigger", resources: [{ id: "ip", name: "Interdict Points", max_formula: "3", reset: "long-rest" }] }),
    ], {
      classes: [{ entity: { name: "Illrigger", slug: "illrigger" }, level: 5 }],
      featureUses: { ip: { used: 0, max: 3 } },
    }));
    expect(rowNames(c)).toContain("Interdict Points");
    expect(rowNames(c)).not.toContain("Illrigger");
  });

  it("titles a subclass-named resource synthetic by its resource name, not the subclass name", () => {
    // The dnd5e resolver builds the identical `{ name, resources }`-only synthetic
    // for subclass entity-level pools (source.kind === "subclass"), so a subclass
    // pool must re-title from resources[0].name the same way the class case does.
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Hellspeaker", resources: [{ id: "hp", name: "Hellspeaker Pool", max_formula: "2", reset: "long-rest" }] },
        { source: { kind: "subclass", slug: "hellspeaker", level: 1 } }),
    ], {
      classes: [{ subclass: { name: "Hellspeaker", slug: "hellspeaker" }, level: 5 }],
      featureUses: { hp: { used: 0, max: 2 } },
    }));
    expect(rowNames(c)).toContain("Hellspeaker Pool");
    expect(rowNames(c)).not.toContain("Hellspeaker");
  });

  it("with BOTH a seeded resource[0] and attacks[], the tracker renders in-row AND the attack detail in the expand card", () => {
    // Finding B: the single in-row detail slot holds the tracker, and the attack
    // note (previously dropped entirely when a tracker won the slot) now moves to
    // the expand card so nothing is lost.
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({
        name: "Interdict Strike", action: "action",
        resources: [{ id: "is", name: "Interdict", max_formula: "3", reset: "long-rest" }],
        attacks: [{ name: "Strike", to_hit: "+7", damage: "d10" }],
      }),
    ], { featureUses: { is: { used: 1, max: 3 } } }));
    const row = rowByName(c, "Interdict Strike");
    // tracker still wins the single in-row slot
    expect(row.querySelectorAll(".pc-feature-detail .archivist-toggle-box").length).toBe(3);
    expect(row.querySelector(".pc-feature-detail .pc-feature-attack-note")).toBeNull();
    // the attack detail is now in the expand card (nothing dropped)
    const expand = row.nextElementSibling as HTMLElement; // the sibling .pc-action-expand
    expect(expand.querySelector(".pc-feature-card-attack")?.textContent).toContain("+7");
    expect(expand.querySelector(".pc-feature-card-attack")?.textContent).toContain("d10");
  });

  it("renders a feature's attack hit/damage in-row (no separate feature-attacks table)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({
        name: "Baleful Interdict", action: "action",
        resources: [{ id: "sd", name: "Seal Damage", max_formula: "1", reset: "long-rest", die: { base: "d6", scaling: { "5": "d8", "11": "d10" } } }],
        attacks: [{ name: "Seal", to_hit: "+7" }],
      }),
    ], { totalLevel: 11 }));
    // no feature-attacks <table>
    expect(c.querySelector(".pc-feature-attacks")).toBeNull();
    expect(c.querySelector("table")).toBeNull();
    const row = rowByName(c, "Baleful Interdict");
    const note = row.querySelector(".pc-feature-attack-note")?.textContent ?? "";
    expect(note).toContain("+7");
    expect(note).toContain("d10"); // scaling die at L11
  });

  it("clicking a feature row opens the shared .archivist-item-block card; an entries-only feature is non-empty", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Fey Ancestry", entries: ["You have advantage on saves against being charmed."] }),
    ]));
    const row = rowByName(c, "Fey Ancestry");
    const card = row.nextElementSibling as HTMLElement & { hidden: boolean };
    expect(card.classList.contains("pc-action-expand")).toBe(true);
    expect(card.hidden).toBe(true);
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(card.hidden).toBe(false);
    const block = card.querySelector(".archivist-item-block");
    expect(block).toBeTruthy();
    expect(block?.querySelector(".archivist-item-description")?.textContent).toContain("advantage on saves");
  });

  it("marks action-economy rows pc-row-disabled when actions are disabled, but not passive rows", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Smite", action: "action" }),
      rf({ name: "Darkvision", passive: true }),
    ], { actionsDisabled: true }));
    expect(rowByName(c, "Smite").classList.contains("pc-row-disabled")).toBe(true);
    expect(rowByName(c, "Darkvision").classList.contains("pc-row-disabled")).toBe(false);
  });

  it("does not dim a free-cost feature when actions are disabled (exact-cost rule)", () => {
    // free → sections into Passive & Free Actions, but a free action is not disabled by
    // Incapacitated. Dimming keys off the EXACT cost, matching weapons/items/boons.
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([rf({ name: "Free Thing", action: "free" })], { actionsDisabled: true }));
    expect(rowByName(c, "Free Thing").classList.contains("pc-row-disabled")).toBe(false);
  });

  it("shows a passive tag (not a cost badge) on passive rows", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([rf({ name: "Darkvision", passive: true })]));
    const row = rowByName(c, "Darkvision");
    expect(row.querySelector(".pc-passive-tag")).toBeTruthy();
    expect(row.querySelector(".pc-cost-badge")).toBeNull();
  });

  it("wires the activatable buff toggle on an action-feature via editState", () => {
    const c = mountContainer();
    const toggleActiveBuff = vi.fn();
    new ActionsTab().render(c, renderCtx([
      rf({ id: "majesty", name: "Infernal Majesty", action: "bonus-action", activatable: true, duration: { amount: 1, unit: "minute" } }),
    ], { editState: { toggleActiveBuff } }));
    const toggle = c.querySelector<HTMLInputElement>(".pc-action-buff-toggle");
    expect(toggle).not.toBeNull();
    toggle!.checked = true;
    toggle!.dispatchEvent(new Event("change"));
    expect(toggleActiveBuff).toHaveBeenCalledWith("majesty");
  });

  it("gives a free-cost feature a FREE pill (not a Passive tag) under Passive & Free Actions", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([rf({ name: "Free Thing", action: "free" })]));
    const row = rowByName(c, "Free Thing");
    // Badge is read from the raw cost, so free keeps its filled FREE pill even
    // though the row now files under the passive section.
    expect(row.querySelector(".pc-cost-badge.cost-free")).toBeTruthy();
    expect(row.querySelector(".pc-feature-badge .pc-passive-tag")).toBeNull();
    // And it files under the renamed passive section (no Actions section at all).
    expect(headings(c)).toContain("Passive & Free Actions");
    expect(headings(c)).not.toContain("Actions");
  });
});
