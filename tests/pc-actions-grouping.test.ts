/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { groupFeatures } from "../packages/obsidian/src/modules/pc/components/actions/feature-groups";
import { ActionsTab } from "../packages/obsidian/src/modules/pc/components/actions-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 }, ...extra }) as unknown as ResolvedFeature;

const groupedChar = (features: ResolvedFeature[]): ResolvedCharacter =>
  ({ features }) as unknown as ResolvedCharacter;

// ─────────────────────────────────────────────────────────────
// groupFeatures — pure §3.1 bucket map
// ─────────────────────────────────────────────────────────────
describe("groupFeatures — §3.1 bucket map", () => {
  it("buckets action/free → Actions, bonus-action → Bonus, reaction → Reactions", () => {
    const g = groupFeatures(groupedChar([
      rf({ name: "A", action: "action" }),
      rf({ name: "F", action: "free" }),
      rf({ name: "B", action: "bonus-action" }),
      rf({ name: "R", action: "reaction" }),
    ]));
    expect(g.actions.map((x) => x.feature.name)).toEqual(["A", "F"]);
    expect(g.bonus.map((x) => x.feature.name)).toEqual(["B"]);
    expect(g.reactions.map((x) => x.feature.name)).toEqual(["R"]);
    expect(g.passive.length).toBe(0);
  });

  it("buckets special / passive:true / action-absent → Passive", () => {
    const g = groupFeatures(groupedChar([
      rf({ name: "S", action: "special" }),
      rf({ name: "P", passive: true }),
      rf({ name: "N" }),
    ]));
    expect(g.passive.map((x) => x.feature.name)).toEqual(["S", "P", "N"]);
    expect(g.actions.length + g.bonus.length + g.reactions.length).toBe(0);
  });

  it("an authored non-special action beats passive:true (goes to its action group)", () => {
    const g = groupFeatures(groupedChar([rf({ name: "Both", action: "action", passive: true })]));
    expect(g.actions.map((x) => x.feature.name)).toEqual(["Both"]);
    expect(g.passive.length).toBe(0);
  });

  it("skips renderSuppressed synthetics from every bucket", () => {
    const g = groupFeatures(groupedChar([
      rf({ name: "Lies", action: "action" }, { renderSuppressed: true }),
      rf({ name: "Keep", action: "action" }),
    ]));
    expect(g.actions.map((x) => x.feature.name)).toEqual(["Keep"]);
  });

  it("keeps two same-named entries (multiclass) — never dedups by name", () => {
    const g = groupFeatures(groupedChar([
      rf({ name: "Extra Attack", action: "action" }),
      rf({ name: "Extra Attack", action: "action" }),
    ]));
    expect(g.actions.length).toBe(2);
  });
});

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
  it("preserves the #7 'Attacks' heading in the Actions group", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([], { attacks: [{ id: "x", name: "Longsword", toHit: 5, damageDice: "1d8", damageType: "s", properties: [], proficient: true, breakdown: { toHit: [], damage: [] } }] }));
    expect(headings(c)).toContain("Attacks");
  });

  it("shows the multiplier '(×N)' on the Actions-group heading (#7 non-regression)", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([], { attacksPerAction: 2 }));
    expect(headings(c)).toContain("Attacks (×2)");
  });

  it("emits Bonus Actions / Reactions / Passive headings only for non-empty buckets", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Charm", action: "bonus-action" }),
      rf({ name: "Second Wind", passive: true }),
    ]));
    const h = headings(c);
    expect(h).toContain("Bonus Actions");
    expect(h).toContain("Passive & Always-Active");
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
});
