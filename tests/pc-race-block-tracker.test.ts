/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderRaceBlock } from "../packages/obsidian/src/modules/pc/components/passive/race-block";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";
import type { Feature } from "@archivist-gg/dnd5e/types/feature";

beforeAll(() => installObsidianDomHelpers());

/** The resource id the SRD 2024 Goliath's "Giant Ancestry" seeds into
 *  `state.feature_uses` (spec §11.1: one of the two carriers present on every
 *  install, and unspendable before this tracker). */
const GIANT_ANCESTRY_ID = "goliath:giant-ancestry";

/**
 * A Goliath-shaped race whose DEFAULT traits are exactly two: one carrying a
 * `resources[]` entry (the tracker's subject) and one carrying none (the
 * byte-identity control). Neither name is in `RACE_STRUCTURAL_PSEUDO`, so both
 * render as trait rows.
 */
const BASE = {
  slug: "goliath", name: "Goliath", edition: "2024", source: "SRD 2024", description: "",
  size: "medium", speed: { walk: 35 }, ability_score_increases: [], age: "", alignment: "",
  vision: {}, languages: { fixed: [] }, variant_label: "",
  traits: [
    {
      name: "Giant Ancestry",
      description: "You are descended from Giants.",
      resources: [
        { id: GIANT_ANCESTRY_ID, name: "Giant Ancestry", max_formula: "prof", reset: "long-rest" },
      ],
    },
    {
      name: "Powerful Build",
      description: "You have Advantage on any ability check you make to end the Grappled condition.",
    },
  ],
};

/** `race()` with no argument is the two-trait Goliath above, unchanged for every
 *  case that already used it (the "leaves a trait WITHOUT resources byte-identical
 *  to the pre-tracker render" control needs both traits); `over` REPLACES whole
 *  top-level keys, which is how the §11 gate cases supply their own `traits`. */
const race = (over?: Partial<RaceEntity>): RaceEntity => ({ ...BASE, ...over }) as unknown as RaceEntity;

interface Spies {
  expendFeatureUse: ReturnType<typeof vi.fn>;
  restoreFeatureUse: ReturnType<typeof vi.fn>;
}

/** The ctx the race block already receives: `resolved` (race + state) plus the
 *  `editState` the tracker spends through. `feature_uses` seeds Giant Ancestry
 *  at 0 of 2 used. */
const ctxWith = (spies: Spies): ComponentRenderContext =>
  ({
    resolved: {
      race: race(),
      state: { feature_uses: { [GIANT_ANCESTRY_ID]: { used: 0, max: 2 } } },
    } as unknown as ResolvedCharacter,
    editState: spies,
  }) as unknown as ComponentRenderContext;

const spies = (): Spies => ({ expendFeatureUse: vi.fn(), restoreFeatureUse: vi.fn() });

/** The `.pc-cb-trait` row whose `.pc-cb-trait-n` reads `name`. Throws rather
 *  than returning undefined so a fixture drift fails loudly. */
const traitRow = (root: HTMLElement, name: string): HTMLElement => {
  const rows = Array.from(root.querySelectorAll<HTMLElement>(".pc-cb-trait"));
  const hit = rows.find((r) => r.querySelector(".pc-cb-trait-n")?.textContent === name);
  if (!hit) throw new Error(`no .pc-cb-trait row named "${name}"`);
  return hit;
};

/**
 * The resource-less trait row's `innerHTML`, CAPTURED (never hand-typed) from
 * the real `renderRaceBlock` render of the fixture above on the pre-tracker
 * tree (plugin HEAD `dcf0f93e`, 2026-09-02) by a throwaway harness whose output
 * is kept at
 * `.superpowers/sdd/2026-09-02-r4-g3-engine-semantics/evidence/g3a-t8-byte-identity-capture.txt`.
 * It is the §14 row 18 control: dropping the `resources` check in `race-block.ts`
 * appends an empty `.pc-cb-trait-track` host here and this string stops matching.
 */
const POWERFUL_BUILD_HTML =
  "<div class=\"pc-cb-trait-n\">Powerful Build</div>"
  + "<div class=\"pc-cb-trait-d\">You have Advantage on any ability check you make to end the Grappled condition.</div>";

describe("renderRaceBlock · costless race-trait resource trackers (§11)", () => {
  it("renders a 2-box track captioned '/ Long Rest' beside the name of a trait carrying resources", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(spies()));

    const host = traitRow(c, "Giant Ancestry").querySelector<HTMLElement>(".pc-cb-trait-track");
    expect(host).toBeTruthy();
    const track = host!.querySelector<HTMLElement>(".pc-feature-track");
    expect(track).toBeTruthy();
    // max 2 (the seeded `feature_uses` max), none used → two unchecked pips.
    const boxes = Array.from(track!.querySelectorAll<HTMLElement>(".archivist-toggle-box"));
    expect(boxes.length).toBe(2);
    expect(boxes.filter((b) => b.classList.contains("archivist-toggle-box-checked")).length).toBe(0);
    // The caption comes from the ONE recovery-label table (`RESET_LABELS`), so a
    // `long-rest` reset reads "Long Rest" and never the item vocabulary's twin.
    expect(track!.querySelector(".pc-charge-recovery")?.textContent).toBe("/ Long Rest");
  });

  it("spends through ctx.editState.expendFeatureUse with the resource id when the first box is clicked", () => {
    const c = mountContainer();
    const s = spies();
    renderRaceBlock(c, ctxWith(s));

    const box = traitRow(c, "Giant Ancestry")
      .querySelector<HTMLElement>(".pc-cb-trait-track .archivist-toggle-box");
    expect(box).toBeTruthy();
    box!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Asserting the SPY, not "no throw": jsdom swallows a listener's throw, so a
    // broken wiring would otherwise pass silently.
    expect(s.expendFeatureUse).toHaveBeenCalledTimes(1);
    expect(s.expendFeatureUse).toHaveBeenCalledWith(GIANT_ANCESTRY_ID);
    expect(s.restoreFeatureUse).not.toHaveBeenCalled();
  });

  it("leaves a trait WITHOUT resources byte-identical to the pre-tracker render", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxWith(spies()));
    expect(traitRow(c, "Powerful Build").innerHTML).toBe(POWERFUL_BUILD_HTML);
  });
});

/** The ctx the §11 gate cases render with: the same `resolved` shape `ctxWith`
 *  builds, plus no-op spend handlers and a `feature_uses` map supplied per case.
 *  `builderUiState` is absent here exactly as it is in `ctxWith`: `isRowExpanded`
 *  reads an absent bag as collapsed, and the chronicle block fills its body either
 *  way, so the trait rows render. */
const ctxTrack = (r: RaceEntity, featureUses: Record<string, { used: number; max: number }>): ComponentRenderContext =>
  ({
    resolved: { race: r, state: { feature_uses: featureUses } } as unknown as ResolvedCharacter,
    editState: { expendFeatureUse: () => {}, restoreFeatureUse: () => {} },
  }) as unknown as ComponentRenderContext;

/** A RAW registry trait carrying one resource, plus whichever routing-cost key the
 *  caller spells: the SRD bundle writes `action_cost` and the converter writes
 *  `action`, and the gate under test has to read both. The `Feature` return is what
 *  keeps `reset` a `ResetTrigger` literal rather than widening it to `string`
 *  against the typed `race(over)` parameter. */
const resTrait = (name: string, cost: Record<string, string>): Feature => ({
  name, description: "x", id: name.toLowerCase(), ...cost,
  resources: [{ id: `r:${name.toLowerCase()}`, name, max_formula: "1", reset: "long-rest" }],
});

/** Every trait PRE-SEEDS its `feature_uses` entry, because
 *  `renderFirstResourceTracker` renders nothing at all when the key is absent: the
 *  POSITIVE case would otherwise pass for the wrong reason. The NEGATIVE cases
 *  assert on the `.pc-cb-trait-track` HOST, which the race block creates BEFORE it
 *  calls the tracker, so those two discriminate with or without the seed. */
const uses = { "r:breath": { used: 0, max: 1 }, "r:stone": { used: 0, max: 1 }, "r:giant": { used: 0, max: 1 } };

describe("race-block tracker gate (R4-G3b §11 · user ruling 1)", () => {
  it("a ROUTED trait spelled action_cost (the bundle) renders NO race-block tracker", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxTrack(race({ traits: [resTrait("Breath", { action_cost: "action" })] }), uses));
    // RED FIRST before Task 9 (e29169ff): a track rendered here, the gate being
    // `t.resources?.length` alone. It is also the G3a T11 trap: a gate reading only
    // the converter's `action` key stays blind, because the bundle carriers spell
    // `action_cost` and carry no `action` key at all.
    expect(c.querySelector(".pc-cb-trait-track")).toBeNull();
  });

  it("a ROUTED trait spelled action (the converter) renders none either", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxTrack(race({ traits: [resTrait("Stone", { action: "bonus-action" })] }), uses));
    // RED FIRST before Task 9 (e29169ff): a track rendered here too.
    expect(c.querySelector(".pc-cb-trait-track")).toBeNull();
  });

  it("a COSTLESS trait keeps its tracker (Giant Ancestry / Relentless Endurance shape)", () => {
    const c = mountContainer();
    renderRaceBlock(c, ctxTrack(
      race({ traits: [resTrait("Giant", {}), resTrait("Special", { action_cost: "special" })] }),
      { ...uses, "r:special": { used: 0, max: 1 } },
    ));
    // Both survive the gate: no cost key at all, and `special`, which the one
    // economy map files as passive.
    expect(c.querySelectorAll(".pc-cb-trait-track")).toHaveLength(2);
    // Real pips inside the hosts, not two empty divs: the seed is load-bearing HERE.
    expect(c.querySelectorAll(".pc-cb-trait-track .archivist-toggle-box").length).toBeGreaterThan(0);
  });
});
