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
  activeBuffs?: string[];
}

function renderCtx(features: ResolvedFeature[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [] },
      race: null, classes: opts.classes ?? [], background: null, feats: [],
      totalLevel: opts.totalLevel ?? 5, features,
      state: { feature_uses: opts.featureUses ?? {}, active_buffs: opts.activeBuffs ?? [] },
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
  it("emits Bonus Actions headings only for non-empty buckets (passive split to the Passive & Features tab)", () => {
    // SPLIT from the old single-tab test: the passive half (Second Wind → the
    // "Passive & Free Actions" heading) now lives in pc-passive-features-tab.test.ts.
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Charm", action: "bonus-action" }),
      rf({ name: "Second Wind", passive: true }),
    ]));
    const h = headings(c);
    expect(h).toContain("Bonus Actions");
    expect(h).not.toContain("Reactions"); // empty bucket omitted
    expect(h).not.toContain("Passive & Free Actions"); // passive filtered off the Actions tab
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
    expect(card.textContent).toContain("Chose · Lies");
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

  // The two resource-only synthetics ("Interdict Points", "Hellspeaker Pool")
  // carry no action cost → they file under the passive bucket. Their re-titling
  // coverage moved to pc-passive-features-tab.test.ts.

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

  it("R4-G4 §6.2.4: the card attack note's scaling die reads at the OWNER's class level (Bard 4 / Fighter 6 reads d6, not d10)", async () => {
    const { resolveFeatureResources } = await import("@archivist-gg/dnd5e/pc/pc.resources");
    const bard = rf({
      name: "Bardic Strike", action: "action",
      resources: [{ id: "bard:bardic-inspiration", name: "Bardic Inspiration", max_formula: "{cha_mod}",
        die: { base: "d6", scaling: { "5": "d8", "10": "d10" } }, reset: "short-rest" }],
      attacks: [{ name: "Strike", to_hit: "+5" }],   // no static damage: the scaling die is the damage
    }, { source: { kind: "class", slug: "bard", level: 1 } });
    const ctx = renderCtx([bard], {
      classes: [{ entity: { slug: "bard" }, level: 4 }, { entity: { slug: "fighter" }, level: 6 }], totalLevel: 10,
      featureUses: { "bard:bardic-inspiration": { used: 0, max: 3 } },
    });
    (ctx.resolved as { resources?: unknown }).resources = resolveFeatureResources([bard]);   // row 38's contract: entry + class by slug + totalLevel 10
    const c = mountContainer();
    new ActionsTab().render(c, ctx);
    const expand = rowByName(c, "Bardic Strike").nextElementSibling as HTMLElement;
    expect(expand.querySelector(".pc-feature-card-attack")?.textContent).toBe("Attack: +5 · d6");   // RED today: d10
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

  // "Fey Ancestry" (entries-only, no action cost → passive) and its shared-card
  // expand coverage moved to pc-passive-features-tab.test.ts.

  it("marks action-economy rows pc-row-disabled when actions are disabled (passive split off)", () => {
    // SPLIT from the old single-tab test: the passive half (Darkvision NOT dimmed)
    // now lives in pc-passive-features-tab.test.ts. Darkvision is filtered off the
    // Actions tab, so only the Smite (action) dimming assertion stays here.
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ name: "Smite", action: "action" }),
      rf({ name: "Darkvision", passive: true }),
    ], { actionsDisabled: true }));
    expect(rowByName(c, "Smite").classList.contains("pc-row-disabled")).toBe(true);
    expect(rowNames(c)).not.toContain("Darkvision"); // passive filtered off the Actions tab
  });

  // "Free Thing" free-dim, the "Darkvision" passive-tag, and the "Free Thing"
  // FREE-pill cases (all no-cost/free → passive) moved to
  // pc-passive-features-tab.test.ts.

  // R4 {G5, G6} live rider V-6 / N-3-14 / N-3-15. The live run read `Active1 minute` on the
  // Barbarian's Rage and `Activate10 minute` on the Paladin's Holy Nimbus: `createSpan` inserts no
  // whitespace between the label and the duration, and the unit was printed as the datum spells it
  // whatever the amount. Both states and both amounts are pinned here.
  it("separates the buff label from its duration and counts the unit, in both toggle states", () => {
    const c = mountContainer();
    new ActionsTab().render(c, renderCtx([
      rf({ id: "rage", name: "Rage", action: "bonus-action", activatable: true, duration: { amount: 1, unit: "minute" } }),
      rf({ id: "nimbus", name: "Holy Nimbus", action: "bonus-action", activatable: true, duration: { amount: 10, unit: "minute" } }),
    ], { activeBuffs: ["rage"] }));
    expect(rowByName(c, "Rage").querySelector(".pc-action-buff")!.textContent).toBe("Active · 1 minute");
    expect(rowByName(c, "Holy Nimbus").querySelector(".pc-action-buff")!.textContent).toBe("Activate · 10 minutes");
  });

  it("wires the activation button on an action-feature via editState", () => {
    const c = mountContainer();
    const toggleActiveBuff = vi.fn();
    new ActionsTab().render(c, renderCtx([
      rf({ id: "majesty", name: "Infernal Majesty", action: "bonus-action", activatable: true, duration: { amount: 1, unit: "minute" } }),
    ], { editState: { toggleActiveBuff } }));
    const toggle = c.querySelector<HTMLButtonElement>(".pc-feature-activate-btn");
    expect(toggle?.getAttribute("aria-pressed")).toBe("false");
    toggle!.click();
    expect(toggleActiveBuff).toHaveBeenCalledWith("majesty");
    expect(rowByName(c, "Infernal Majesty").querySelector(".pc-action-buff-toggle")).toBeNull();
  });

  it("places every feature activation beside its duration and aligns its rest tracker with other resource rows", () => {
    const c = mountContainer();
    const toggleActiveBuff = vi.fn();
    const features = [
      rf({ id: "spellsight", name: "Spellsight", action: "action", resources: [{ id: "spellsight-use", name: "Spellsight", reset: "either" }] }),
      rf({ id: "blade-dance", name: "Blade Dance", action: "bonus-action", activatable: true,
        duration: { amount: 1, unit: "minute" }, resources: [{ id: "blade-dance-use", name: "Blade Dance", reset: "either" }] }),
    ];
    const opts = { featureUses: { "spellsight-use": { used: 0, max: 1 }, "blade-dance-use": { used: 0, max: 1 } }, editState: { toggleActiveBuff } };
    new ActionsTab().render(c, renderCtx(features, opts));

    const blade = rowByName(c, "Blade Dance");
    const spellsight = rowByName(c, "Spellsight");
    expect(blade.classList.contains("pc-resource-aligned-row")).toBe(true);
    expect(spellsight.classList.contains("pc-resource-aligned-row")).toBe(true);
    const detail = blade.querySelector(".pc-activation-detail")!;
    expect([...detail.children].map((el) => el.classList.contains("pc-feature-track"))).toEqual([false, true]);
    expect(detail.querySelector(".pc-feature-activation")?.textContent).toBe("Activate · 1 minute");
    expect(blade.querySelector(".pc-action-buff-toggle")).toBeNull();
    const button = detail.querySelector<HTMLButtonElement>(".pc-feature-activate-btn")!;
    expect(button.getAttribute("aria-pressed")).toBe("false");
    button.click();
    expect(toggleActiveBuff).toHaveBeenCalledWith("blade-dance");
    expect((blade.nextElementSibling as HTMLElement).hidden).toBe(true);

    const active = mountContainer();
    new ActionsTab().render(active, renderCtx(features, { ...opts, activeBuffs: ["blade-dance"] }));
    const activeButton = rowByName(active, "Blade Dance").querySelector<HTMLButtonElement>(".pc-feature-activate-btn")!;
    expect(activeButton.textContent).toBe("Active");
    expect(activeButton.classList.contains("is-active-filled")).toBe(true);
    expect(activeButton.getAttribute("aria-pressed")).toBe("true");
  });
});
