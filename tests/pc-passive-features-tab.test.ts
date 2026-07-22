/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { PassiveFeaturesTab } from "../packages/obsidian/src/modules/pc/components/passive-features-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type {
  ResolvedCharacter,
  ResolvedFeature,
  ResolvedPool,
  ResolvedPoolEntry,
} from "@archivist-gg/dnd5e/pc/pc.types";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { BackgroundEntity } from "@archivist-gg/dnd5e/background/background.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// Fixture reconciliation (spec §4.6). The passive tab renders the same
// `passive` economy slice the old single "Actions & Features" tab did, so this
// suite receives BOTH the relocated feature cases (from pc-actions-grouping) and
// the relocated boon cases (from pc-actions-boons). Their two source fixtures
// declared a `renderCtx` of different shape under the same name; here they are
// reconciled into ONE builder that accepts BOTH `features` and `pools` (the
// production `ResolvedCharacter` carries both), so feature rows and boon rows
// exercise from a single ctx.
// ─────────────────────────────────────────────────────────────

// A resolved feature carries a raw `feature` object plus a `source`; the economy
// bucket is derived from `feature.action` (absent → passive, "free" → passive,
// "action" → actions).
const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 }, ...extra }) as unknown as ResolvedFeature;

// A resolved boon pool entry (from pc-actions-boons.test.ts): the economy bucket
// is derived from the OptionalFeatureEntity's `action_cost` (free/special/absent
// → passive).
const entry = (slug: string, entity: Partial<OptionalFeatureEntity> = {}): ResolvedPoolEntry =>
  ({ slug, entity: { slug, name: slug, description: "", edition: "2014", source: "", feature_type: "boon", prerequisites: [], available_to: [], effects: [], ...entity } }) as unknown as ResolvedPoolEntry;

const pool = (over: Partial<ResolvedPool> = {}): ResolvedPool =>
  ({ id: "interdict-boons", label: "Interdict Boons", classIndex: 0, count: 2, anchorLevel: 3, selected: [], available: [], grants: [], ...over }) as ResolvedPool;

interface RenderOpts {
  featureUses?: Record<string, { used: number; max: number }>;
  classes?: object[];
  editState?: object | null;
  actionsDisabled?: boolean;
  pools?: ResolvedPool[];
  activeBuffs?: string[];
  race?: RaceEntity | null;
  background?: BackgroundEntity | null;
}

// The single reconciled ctx builder: feature-based cases pass `features`
// positionally; boon-based cases pass `[]` + `{ pools }`; both may set the
// shared opts (editState, activeBuffs, actionsDisabled, classes, featureUses).
function renderCtx(features: ResolvedFeature[], opts: RenderOpts = {}): ComponentRenderContext {
  return {
    resolved: {
      definition: { equipment: [], edition: "2014" },
      race: opts.race ?? null, classes: opts.classes ?? [], background: opts.background ?? null, feats: [],
      totalLevel: 5, features, pools: opts.pools ?? [],
      state: { feature_uses: opts.featureUses ?? {}, active_buffs: opts.activeBuffs ?? [] },
    } as unknown as ResolvedCharacter,
    derived: {
      attacks: [],
      attacksPerAction: 1,
      conditionEffects: opts.actionsDisabled ? { actions_disabled: true, sources: [] } : undefined,
    } as never,
    services: { entities: buildMockRegistry([]) } as never,
    app: {} as never,
    editState: (opts.editState ?? null) as never,
  };
}

const headings = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent ?? "");
const subGroupTitles = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-actions-section-head .pc-actions-section-title")].map((n) => n.textContent ?? "");
const rowNames = (root: HTMLElement): string[] =>
  [...root.querySelectorAll(".pc-feature-row .pc-action-row-name")].map((n) => n.textContent ?? "");
const rowByName = (root: HTMLElement, name: string): HTMLElement =>
  [...root.querySelectorAll<HTMLElement>(".pc-feature-row")].find(
    (r) => r.querySelector(".pc-action-row-name")?.textContent === name,
  )!;
const boonRows = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(".pc-boon-row")];
const boonNames = (root: HTMLElement): string[] =>
  boonRows(root).map((r) => r.querySelector(".pc-action-row-name")?.textContent ?? "");
const boonRowByName = (root: HTMLElement, name: string): HTMLElement =>
  boonRows(root).find((r) => r.querySelector(".pc-action-row-name")?.textContent === name)!;
/** The economy `.pc-tab-heading` a given boon row files under. */
const economyForBoon = (root: HTMLElement, name: string): string => {
  const list = boonRowByName(root, name).closest(".pc-boons-list")!;
  let n: Element | null = list.previousElementSibling;
  while (n && !n.classList.contains("pc-tab-heading")) n = n.previousElementSibling;
  return n?.textContent ?? "";
};

// A passive feature (no action cost), a free-cost feature, and an action feature.
const passiveFeat = rf({ name: "Darkvision" });                 // no action → passive
const freeFeat = rf({ name: "Free Thing", action: "free" });    // free → passive section
const actionFeat = rf({ name: "Smite", action: "action" });     // action → Actions tab

// A race-sourced passive feature — `buildActionModel` files this under the
// passive "Race" sub-group, which the tab must PRE-SPLIT out (D2-2 / F8).
const raceFeat = rf({ name: "Dual Mind" }, { source: { kind: "race", slug: "kalashtar", level: 0 } });
const raceFixture = {
  slug: "kalashtar", name: "Kalashtar", edition: "2014", source: "", description: "",
  size: "medium", speed: { walk: 30 }, ability_score_increases: [], age: "", alignment: "",
  vision: {}, languages: { fixed: [] }, variant_label: "",
  traits: [{ name: "Dual Mind", description: "You have advantage on Wisdom saving throws." }],
} as unknown as RaceEntity;

// A 2024 (Soldier-like) background: the generator bakes a placeholder feature
// `{name:"Background Feature", description:"(No description provided.)"}` and all
// real grants live as fields (already applied elsewhere) → the Background block
// REFERENCES them, and the placeholder row is pre-split out of the passive model.
const bg2024 = {
  slug: "soldier", name: "Soldier", edition: "2024", source: "", description: "",
  skill_proficiencies: ["athletics", "intimidation"],
  tool_proficiencies: [{ kind: "fixed", items: ["gaming-set"] }],
  language_proficiencies: [],
  equipment: [{ kind: "gold", amount: 50 }],
  feature: { name: "Background Feature", description: "(No description provided.)" },
  ability_score_increases: { pool: ["str", "dex", "con"] },
  origin_feat: "[[SRD 2024/Feats/Savage Attacker]]",
  suggested_characteristics: null,
} as unknown as BackgroundEntity;

// The generator-baked placeholder feature, as it appears in `resolved.features`
// under the `background` sub-group (which the tab pre-splits out).
const bgPlaceholderFeat = rf(
  { name: "Background Feature", description: "(No description provided.)" },
  { source: { kind: "background", slug: "soldier" } },
);

// The origin feat once it flows through the feat pipeline (Task 3b) — a
// feat-sourced feature whose slug matches the background's `origin_feat` ref.
const savageAttackerFeat = rf(
  { name: "Savage Attacker" },
  { source: { kind: "feat", slug: "srd-2024_savage-attacker" } },
);

// A 2014 background: real `feature` prose, `origin_feat:null`. The block shows
// the genuine feature prose (NOT suppressed).
const bg2014 = {
  slug: "acolyte", name: "Acolyte", edition: "2014", source: "", description: "",
  skill_proficiencies: ["insight", "religion"],
  tool_proficiencies: [],
  language_proficiencies: [{ kind: "choice", count: 2, from: "any" }],
  equipment: [],
  feature: {
    name: "Shelter of the Faithful",
    description: "As an acolyte, you command the respect of those who share your faith.",
  },
  ability_score_increases: null,
  origin_feat: null,
  suggested_characteristics: null,
} as unknown as BackgroundEntity;

/** The Background section's chronicle card — the `.pc-cblock` inside the expand
 *  that follows the "Background" `.pc-tab-heading` (Task 5 rehoused the block into
 *  the section -> row -> expand idiom, so it is no longer a `.pc-background-block`
 *  standalone card; the chronicle block wears the shared `.pc-cblock` dress, carded
 *  by the `.pc-action-expand-inner > .pc-cblock` rule). */
const bgBlock = (root: HTMLElement): HTMLElement | null => {
  const head = [...root.querySelectorAll<HTMLElement>(".pc-tab-heading")].find((h) => h.textContent === "Background");
  const list = head?.nextElementSibling as HTMLElement | null;
  return list?.querySelector<HTMLElement>(".pc-action-expand-inner > .pc-cblock") ?? null;
};
const bgHeading = (root: HTMLElement): HTMLElement | undefined =>
  [...root.querySelectorAll<HTMLElement>(".pc-tab-heading")].find((h) => h.textContent === "Background");
const propLabels = (block: HTMLElement): string[] =>
  [...block.querySelectorAll(".pc-cb-prop-l")].map((n) => n.textContent ?? "");

describe("PassiveFeaturesTab", () => {
  it("renders the Passive & Free Actions heading and passive/free rows, not the Actions heading", () => {
    const el = document.createElement("div");
    new PassiveFeaturesTab().render(el, renderCtx([passiveFeat, freeFeat, actionFeat]));
    const h = [...el.querySelectorAll(".pc-tab-heading")].map((n) => n.textContent);
    expect(h).toContain("Passive & Free Actions");
    expect(h).not.toContain("Actions");
    const names = [...el.querySelectorAll(".pc-action-row-name")].map((n) => n.textContent);
    expect(names).toContain("Darkvision"); // passive
    expect(names).toContain("Free Thing"); // free
    expect(names).not.toContain("Smite"); // action → stays on Actions tab
  });

  it("does not dim passive rows even when actions are disabled", () => {
    const el = document.createElement("div");
    new PassiveFeaturesTab().render(el, renderCtx([passiveFeat, freeFeat, actionFeat], { actionsDisabled: true }));
    const row = [...el.querySelectorAll(".pc-action-row")].find(
      (r) => r.querySelector(".pc-action-row-name")?.textContent === "Darkvision",
    )!;
    expect(row.classList.contains("pc-row-disabled")).toBe(false);
  });

  it("shows the empty-state line when there are no passive or free entries", () => {
    const el = document.createElement("div");
    new PassiveFeaturesTab().render(el, renderCtx([actionFeat])); // only an action feature
    expect(el.querySelector(".pc-empty-line")?.textContent).toBe("(No passive or free actions.)");
    expect(el.querySelectorAll(".pc-tab-heading").length).toBe(0);
  });

  // ── Race section (D2-2 pre-split, §3; D7.1 section -> row -> expand) ─────────
  describe("race block", () => {
    it("renders exactly ONE 'Race' section (heading + row) above the grouped sections when race is present", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([passiveFeat], { race: raceFixture }));
      // The bespoke chronicle card is retired: Race is now a section -> row -> expand.
      expect(c.querySelector(".pc-race-block")).toBeNull();
      const raceHeads = [...c.querySelectorAll<HTMLElement>(".pc-tab-heading")].filter((h) => h.textContent === "Race");
      expect(raceHeads.length).toBe(1);
      const raceRow = [...c.querySelectorAll(".pc-feature-row .pc-action-row-name")].find((n) => n.textContent === "Kalashtar");
      expect(raceRow).toBeTruthy();
      // Ordered above the grouped "Passive & Free Actions" section (Race heading precedes it).
      const passiveHead = [...c.querySelectorAll<HTMLElement>(".pc-tab-heading")].find((h) => h.textContent === "Passive & Free Actions")!;
      expect(raceHeads[0].compareDocumentPosition(passiveHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("pre-splits the passive 'Race' sub-group off the tab (block replaces scattered rows)", () => {
      const c = mountContainer();
      // A race-sourced passive feature alongside a class-sourced one: only the
      // Race sub-group is removed; Class features stays.
      new PassiveFeaturesTab().render(c, renderCtx([passiveFeat, raceFeat], { race: raceFixture }));
      expect(subGroupTitles(c)).toContain("Class features");
      expect(subGroupTitles(c)).not.toContain("Race");
      // "Dual Mind" is no longer a scattered .pc-feature-row (it lives in the block).
      expect(rowNames(c)).not.toContain("Dual Mind");
      expect(headings(c)).toContain("Passive & Free Actions");
    });

    it("drops the passive section left empty after the Race split (no bare heading)", () => {
      const c = mountContainer();
      // The ONLY passive content is the race sub-group → after the split the whole
      // "Passive & Free Actions" section is empty and must not render a bare <h4>.
      new PassiveFeaturesTab().render(c, renderCtx([raceFeat], { race: raceFixture }));
      // The Race section (heading + row) is present; the grouped passive section is not.
      expect([...c.querySelectorAll(".pc-tab-heading")].some((h) => h.textContent === "Race")).toBe(true);
      expect(c.querySelector(".pc-feature-row .pc-action-row-name")?.textContent).toBe("Kalashtar");
      expect(headings(c)).not.toContain("Passive & Free Actions");
      expect(c.querySelector(".pc-empty-line")).toBeNull(); // race section present → not empty-state
    });
  });

  // ── Background block (D2-3(i) pre-split, §4.1) ──────────────────────────────
  describe("background block", () => {
    it("suppresses the generator placeholder row and renders ONE reference block for a 2024 background", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([bgPlaceholderFeat], { background: bg2024 }));
      // The "Background Feature — (No description provided.)" placeholder is
      // pre-split out with the `background` sub-group → never a scattered row.
      expect(rowNames(c)).not.toContain("Background Feature");
      expect(subGroupTitles(c)).not.toContain("Background");
      // Exactly one Background section (heading + row + carded expand), showing name.
      const bgHeads = [...c.querySelectorAll<HTMLElement>(".pc-tab-heading")].filter((h) => h.textContent === "Background");
      expect(bgHeads.length).toBe(1);
      expect(bgBlock(c)!.textContent).toContain("Soldier");
    });

    it("defaults COLLAPSED and reveals the carded chronicle block on row click (section -> row -> expand)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([bgPlaceholderFeat], { background: bg2024 }));
      const row = rowByName(c, "Soldier");
      const expand = row.nextElementSibling as HTMLElement & { hidden: boolean };
      expect(expand.classList.contains("pc-action-expand")).toBe(true);
      expect(expand.hidden).toBe(true); // default collapsed, matching the Race block
      // The full chronicle block sits in the carded slot the container CSS targets.
      expect(expand.querySelector(".pc-action-expand-inner > .pc-cblock")).toBeTruthy();
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(expand.hidden).toBe(false);
    });

    it("renders the background description as markdown flavor at the top of the block", () => {
      const c = mountContainer();
      const bg = { ...bg2014, description: "A devout servant of a temple." } as unknown as BackgroundEntity;
      new PassiveFeaturesTab().render(c, renderCtx([], { background: bg }));
      const flavor = bgBlock(c)!.querySelector(".pc-bg-flavor");
      expect(flavor).toBeTruthy();
      expect(flavor!.textContent).toContain("devout servant");
    });

    it("shows ability-boost + proficiency reference lines (references applied grants, not re-lists)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([bgPlaceholderFeat], { background: bg2024 }));
      const block = bgBlock(c)!;
      const labels = propLabels(block);
      expect(labels).toContain("Ability Scores"); // the granted pool, referenced
      expect(labels).toContain("Skills");
      expect(block.textContent).toContain("Athletics");
      expect(block.textContent).toContain("Intimidation");
    });

    it("renders 'Origin Feat: <name>' WITHOUT 'see Feats' when no matching feat row is present (pre-3b)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([bgPlaceholderFeat], { background: bg2024 }));
      const line = bgBlock(c)!.querySelector(".pc-bg-origin")!;
      expect(line.textContent).toBe("Origin Feat: Savage Attacker");
    });

    it("auto-upgrades to 'Origin Feat: <name> · see Feats' once a matching feat feature is present (post-3b)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([bgPlaceholderFeat, savageAttackerFeat], { background: bg2024 }));
      const line = bgBlock(c)!.querySelector(".pc-bg-origin")!;
      expect(line.textContent).toBe("Origin Feat: Savage Attacker · see Feats");
    });

    it("shows the real feature prose (NOT suppressed) for a 2014 background with no origin feat", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], { background: bg2014 }));
      const block = bgBlock(c)!;
      expect(block.textContent).toContain("Shelter of the Faithful");
      expect(block.textContent).toContain("command the respect");
      // 2014 → no origin feat line.
      expect(block.querySelector(".pc-bg-origin")).toBeNull();
    });

    it("orders the Background section AFTER the Race section and BEFORE the grouped sections", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([passiveFeat], { race: raceFixture, background: bg2024 }));
      const raceHead = [...c.querySelectorAll<HTMLElement>(".pc-tab-heading")].find((h) => h.textContent === "Race")!;
      const bgHead = bgHeading(c)!;
      const passiveHead = [...c.querySelectorAll<HTMLElement>(".pc-tab-heading")].find((h) => h.textContent === "Passive & Free Actions")!;
      // Race section precedes Background…
      expect(raceHead.compareDocumentPosition(bgHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      // …and Background precedes the grouped-section heading.
      expect(passiveHead).toBeTruthy();
      expect(bgHead.compareDocumentPosition(passiveHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("renders no Background section when there is no background", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([passiveFeat]));
      expect(bgHeading(c)).toBeUndefined();
      expect(bgBlock(c)).toBeNull();
    });
  });

  // ── Relocated feature cases (from pc-actions-grouping.test.ts) ──────────────
  describe("relocated feature rows", () => {
    it("titles the class-named resource synthetic by its resource name, not the class name", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([
        rf({ name: "Illrigger", resources: [{ id: "ip", name: "Interdict Points", max_formula: "3", reset: "long-rest" }] }),
      ], {
        classes: [{ entity: { name: "Illrigger", slug: "illrigger" }, level: 5 }],
        featureUses: { ip: { used: 0, max: 3 } },
      }));
      expect(rowNames(c)).toContain("Interdict Points");
      expect(rowNames(c)).not.toContain("Illrigger");
    });

    it("titles a subclass-named resource synthetic by its resource name, not the subclass name", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([
        rf({ name: "Hellspeaker", resources: [{ id: "hp", name: "Hellspeaker Pool", max_formula: "2", reset: "long-rest" }] },
          { source: { kind: "subclass", slug: "hellspeaker", level: 1 } }),
      ], {
        classes: [{ subclass: { name: "Hellspeaker", slug: "hellspeaker" }, level: 5 }],
        featureUses: { hp: { used: 0, max: 2 } },
      }));
      expect(rowNames(c)).toContain("Hellspeaker Pool");
      expect(rowNames(c)).not.toContain("Hellspeaker");
    });

    it("clicking a passive feature row opens the shared .archivist-item-block card; an entries-only feature is non-empty", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([
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

    it("does not dim a free-cost feature when actions are disabled (exact-cost rule)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([rf({ name: "Free Thing", action: "free" })], { actionsDisabled: true }));
      expect(rowByName(c, "Free Thing").classList.contains("pc-row-disabled")).toBe(false);
    });

    it("drops the badge column (no badge div, 3-col grid) on passive rows", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([rf({ name: "Darkvision", passive: true })]));
      const row = rowByName(c, "Darkvision");
      // D3: passive rows drop the badge column entirely (3-col grid).
      expect(row.querySelector(".pc-feature-badge")).toBeNull();
      expect(row.childElementCount).toBe(3); // name · detail · caret
      expect(row.querySelector(".pc-passive-tag")).toBeNull();
      expect(row.querySelector(".pc-cost-badge")).toBeNull();
    });

    it("renders a free-cost feature with NO cost pill under Passive & Free Actions", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([rf({ name: "Free Thing", action: "free" })]));
      const row = rowByName(c, "Free Thing");
      // R3-P3 item C: the Passive tab renders NO cost pill; all passive costs are unmarked.
      expect(row.querySelector(".pc-feature-badge")).toBeNull();
      expect(row.querySelector(".pc-cost-badge")).toBeNull();
      expect(headings(c)).toContain("Passive & Free Actions");
      expect(headings(c)).not.toContain("Actions");
    });

    it("renders ZERO Passive tags across the whole tab (features, race, background, boons) and no FREE pill", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx(
        [passiveFeat, freeFeat],
        {
          race: raceFixture,
          background: bg2024,
          pools: [pool({ selected: [entry("stoic", { name: "Boon of Endurance", passive: true })] })],
        },
      ));
      // Task 6: not a single ".pc-passive-tag" survives anywhere on the tab:
      // feature rows, the Race row, the Background row, and boon rows are all clean.
      expect(c.querySelectorAll(".pc-passive-tag").length).toBe(0);
      // R3-P3 item C: the free-cost row renders with no pill either.
      expect(rowByName(c, "Free Thing").querySelector(".pc-cost-badge")).toBeNull();
    });

    it("renders the Passive & Free Actions heading for the passive half of a mixed feature set (split from grouping L59)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([
        rf({ name: "Charm", action: "bonus-action" }),
        rf({ name: "Second Wind", passive: true }),
      ]));
      const h = headings(c);
      expect(h).toContain("Passive & Free Actions");
      expect(h).not.toContain("Bonus Actions"); // the bonus half stays on the Actions tab
      expect(rowNames(c)).toContain("Second Wind");
      expect(rowNames(c)).not.toContain("Charm");
    });

    it("does not dim a passive row under actions_disabled in a mixed set (split from grouping L204)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([
        rf({ name: "Smite", action: "action" }),
        rf({ name: "Darkvision", passive: true }),
      ], { actionsDisabled: true }));
      expect(rowByName(c, "Darkvision").classList.contains("pc-row-disabled")).toBe(false);
      expect(rowNames(c)).not.toContain("Smite"); // action half stays on the Actions tab
    });
  });

  // ── Relocated boon cases (from pc-actions-boons.test.ts) ────────────────────
  describe("relocated boon rows", () => {
    it("files a free boon under Passive & Free Actions → Boons (NOT under an 'Interdict Boons' head)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("wrath", { name: "Boon of Wrath", action_cost: "free", description: "Deal extra damage." })] })],
      }));
      expect(boonNames(c)).toEqual(["Boon of Wrath"]);
      expect(economyForBoon(c, "Boon of Wrath")).toBe("Passive & Free Actions");
      expect(subGroupTitles(c)).toContain("Boons");
      expect(headings(c)).not.toContain("Interdict Boons");
    });

    it("files a passive boon under Passive & Free Actions → Boons", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("stoic", { name: "Boon of Endurance", passive: true, description: "Always on." })] })],
      }));
      expect(economyForBoon(c, "Boon of Endurance")).toBe("Passive & Free Actions");
      expect(headings(c)).not.toContain("Interdict Boons");
    });

    it("files a granted boon (no action_cost) under Passive → Boons", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ grants: [entry("sight", { name: "Boon of Sight", description: "See in the dark." })] })],
      }));
      expect(boonNames(c)).toEqual(["Boon of Sight"]);
      expect(economyForBoon(c, "Boon of Sight")).toBe("Passive & Free Actions");
    });

    it("shows an Active toggle wired to editState for an activatable selected boon", () => {
      const c = mountContainer();
      const toggleActiveBuff = vi.fn();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("wrath", { name: "Boon of Wrath", activatable: true })] })],
        editState: { toggleActiveBuff },
      }));
      const row = boonRowByName(c, "Boon of Wrath");
      const btn = row.querySelector<HTMLButtonElement>(".pc-pool-active");
      expect(btn).not.toBeNull();
      expect(btn!.textContent).toBe("Activate");
      btn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(toggleActiveBuff).toHaveBeenCalledWith("wrath");
    });

    it("reflects the on-state ('Active' + .on) when the boon's slug is an active buff", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("wrath", { name: "Boon of Wrath", activatable: true })] })],
        activeBuffs: ["wrath"],
      }));
      const btn = boonRowByName(c, "Boon of Wrath").querySelector<HTMLButtonElement>(".pc-pool-active")!;
      expect(btn.textContent).toBe("Active");
      expect(btn.classList.contains("on")).toBe(true);
    });

    it("drops the badge column (3-col grid) on a plain no-cost non-activatable selected boon", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("wrath", { name: "Boon of Wrath" })] })],
      }));
      const row = boonRowByName(c, "Boon of Wrath");
      // D3: passive rows drop the badge column entirely (3-col grid).
      expect(row.querySelector(".pc-feature-badge")).toBeNull();
      expect(row.childElementCount).toBe(3); // name · detail · caret
      expect(row.querySelector(".pc-passive-tag")).toBeNull();
      expect(row.querySelector(".pc-cost-badge")).toBeNull();
      expect(row.querySelector(".pc-pool-active")).toBeNull();
      expect(row.querySelector(".pc-boon-status")).toBeNull();
    });

    it("renders a granted free boon with NO cost pill + a quiet 'granted' marker", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ grants: [entry("red-cant", { name: "Red Cant", action_cost: "free" })] })],
      }));
      const row = boonRowByName(c, "Red Cant");
      // R3-P3 item C: no badge column AND no inline pill on the Passive tab.
      expect(row.querySelector(".pc-feature-badge")).toBeNull();
      expect(row.querySelector(".pc-cost-badge")).toBeNull();
      expect(row.querySelector(".pc-feature-detail .pc-boon-status")!.textContent).toBe("granted");
    });

    it("drops the badge column (3-col grid) for a special-cost plain selected boon", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("frenzy", { name: "Frenzy", action_cost: "special" })] })],
      }));
      const row = boonRowByName(c, "Frenzy");
      // D3: `special` cost → no badge column and no inline pill (only FREE renders
      // inline), matching the passive-feature row treatment.
      expect(row.querySelector(".pc-feature-badge")).toBeNull();
      expect(row.childElementCount).toBe(3); // name · detail · caret
      expect(row.querySelector(".pc-passive-tag")).toBeNull();
      expect(row.querySelector(".pc-cost-badge")).toBeNull();
      expect(row.querySelector(".pc-boon-status")).toBeNull();
    });

    it("shows a read-only 'granted' tag (no Active toggle, no select box) on a granted boon", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ grants: [entry("sight", { name: "Boon of Sight", activatable: true })] })],
      }));
      const row = boonRowByName(c, "Boon of Sight");
      expect(row.textContent).toContain("granted");
      expect(row.querySelector(".pc-pool-active")).toBeNull();
      // read-only: never the pool tab's pick/deselect toggle-box
      expect(row.querySelector(".archivist-toggle-box")).toBeNull();
    });

    it("clicking a boon row expands the shared .archivist-item-block card with its description", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("wrath", { name: "Boon of Wrath", description: "Deal thunderous extra damage." })] })],
      }));
      const row = boonRowByName(c, "Boon of Wrath");
      const card = row.nextElementSibling as HTMLElement & { hidden: boolean };
      expect(card.classList.contains("pc-action-expand")).toBe(true);
      expect(card.hidden).toBe(true);
      row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(card.hidden).toBe(false);
      const block = card.querySelector(".archivist-item-block");
      expect(block).toBeTruthy();
      expect(block?.textContent).toContain("Boon of Wrath");
      expect(block?.querySelector(".archivist-item-description")?.textContent).toContain("thunderous extra damage");
    });

    it("clicking the Active toggle does NOT expand the row's card", () => {
      const c = mountContainer();
      const toggleActiveBuff = vi.fn();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("wrath", { name: "Boon of Wrath", activatable: true, description: "x" })] })],
        editState: { toggleActiveBuff },
      }));
      const row = boonRowByName(c, "Boon of Wrath");
      const card = row.nextElementSibling as HTMLElement & { hidden: boolean };
      const btn = row.querySelector<HTMLButtonElement>(".pc-pool-active")!;
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(card.hidden).toBe(true);
      expect(toggleActiveBuff).toHaveBeenCalledWith("wrath");
    });

    it("does not dim a free boon when actions are disabled (split from boons L157)", () => {
      const c = mountContainer();
      new PassiveFeaturesTab().render(c, renderCtx([], {
        pools: [pool({ selected: [entry("f", { name: "Free Boon", action_cost: "free" })] })],
        actionsDisabled: true,
      }));
      expect(boonRowByName(c, "Free Boon").classList.contains("pc-row-disabled")).toBe(false);
    });
  });
});

describe("D3 passive layout (badge column dropped, FREE inline)", () => {
  it("a passive feature row has 3 grid children and no badge div", () => {
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, renderCtx([rf({ name: "Darkvision", passive: true })]));
    const row = rowByName(c, "Darkvision");
    expect(row.querySelector(".pc-feature-badge")).toBeNull();
    expect(row.childElementCount).toBe(3);
  });
  it("a passive boon row has 3 grid children and no badge div", () => {
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, renderCtx([], {
      pools: [pool({ selected: [entry("stoic", { name: "Boon of Endurance", passive: true })] })],
    }));
    const row = boonRowByName(c, "Boon of Endurance");
    expect(row.querySelector(".pc-feature-badge")).toBeNull();
    expect(row.childElementCount).toBe(3);
  });
  it("race and background rows have 3 grid children (no badge div)", () => {
    const c = mountContainer();
    new PassiveFeaturesTab().render(c, renderCtx([], { race: raceFixture, background: bg2024 }));
    const raceRow = rowByName(c, "Kalashtar");
    const bgRow = rowByName(c, "Soldier");
    expect(raceRow.querySelector(".pc-feature-badge")).toBeNull();
    expect(raceRow.childElementCount).toBe(3);
    expect(bgRow.querySelector(".pc-feature-badge")).toBeNull();
    expect(bgRow.childElementCount).toBe(3);
  });
});

describe("D1 feature-row expand persistence", () => {
  it("re-applies a feature row's expanded state across a re-render with the same bag", () => {
    const bag = new Map<string, unknown>();
    const c1 = mountContainer();
    new PassiveFeaturesTab().render(c1, { ...renderCtx([passiveFeat]), builderUiState: bag });
    const row1 = rowByName(c1, "Darkvision");
    const expand1 = row1.nextElementSibling as HTMLElement & { hidden: boolean };
    expect(expand1.hidden).toBe(true);
    row1.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(expand1.hidden).toBe(false);

    // Simulated mutation re-render: fresh container, SAME bag → rebuilt expanded.
    const c2 = mountContainer();
    new PassiveFeaturesTab().render(c2, { ...renderCtx([passiveFeat]), builderUiState: bag });
    const row2 = rowByName(c2, "Darkvision");
    const expand2 = row2.nextElementSibling as HTMLElement & { hidden: boolean };
    expect(expand2.hidden).toBe(false);
    expect(row2.classList.contains("pc-row-open")).toBe(true);
  });

  it("keeps two distinct feature rows independently persisted", () => {
    const bag = new Map<string, unknown>();
    const feats = [passiveFeat, rf({ name: "Fey Ancestry" })];
    const c1 = mountContainer();
    new PassiveFeaturesTab().render(c1, { ...renderCtx(feats), builderUiState: bag });
    rowByName(c1, "Fey Ancestry").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const c2 = mountContainer();
    new PassiveFeaturesTab().render(c2, { ...renderCtx(feats), builderUiState: bag });
    const darkExpand = rowByName(c2, "Darkvision").nextElementSibling as HTMLElement & { hidden: boolean };
    const feyExpand = rowByName(c2, "Fey Ancestry").nextElementSibling as HTMLElement & { hidden: boolean };
    expect(feyExpand.hidden).toBe(false); // the one that was opened
    expect(darkExpand.hidden).toBe(true); // its sibling stays collapsed
  });
});

describe("D1 boon-row expand persistence", () => {
  it("re-applies a boon row's expanded state across a re-render with the same bag", () => {
    const bag = new Map<string, unknown>();
    const pools = [pool({ selected: [entry("wrath", { name: "Boon of Wrath", description: "x" })] })];
    const c1 = mountContainer();
    new PassiveFeaturesTab().render(c1, { ...renderCtx([], { pools }), builderUiState: bag });
    boonRowByName(c1, "Boon of Wrath").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const c2 = mountContainer();
    new PassiveFeaturesTab().render(c2, { ...renderCtx([], { pools }), builderUiState: bag });
    const expand = boonRowByName(c2, "Boon of Wrath").nextElementSibling as HTMLElement & { hidden: boolean };
    expect(expand.hidden).toBe(false);
  });
});

describe("D1 background-block expand persistence", () => {
  it("re-applies the Background block open state across a re-render with the same bag", () => {
    const bag = new Map<string, unknown>();
    const c1 = mountContainer();
    new PassiveFeaturesTab().render(c1, { ...renderCtx([], { background: bg2024 }), builderUiState: bag });
    rowByName(c1, "Soldier").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const c2 = mountContainer();
    new PassiveFeaturesTab().render(c2, { ...renderCtx([], { background: bg2024 }), builderUiState: bag });
    const expand = rowByName(c2, "Soldier").nextElementSibling as HTMLElement & { hidden: boolean };
    expect(expand.hidden).toBe(false);
  });
});
