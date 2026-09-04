/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll, vi } from "vitest";
import { renderRaceBlock } from "../packages/obsidian/src/modules/pc/components/passive/race-block";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { ResolvedCharacter } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

/** The resource id the SRD 2024 Goliath's "Giant Ancestry" seeds into
 *  `state.feature_uses` (spec §11.1: one of the two carriers present on every
 *  install, and unspendable before this tracker). */
const GIANT_ANCESTRY_ID = "goliath:giant-ancestry";

/**
 * A Goliath-shaped race with exactly two traits: one carrying a `resources[]`
 * entry (the tracker's subject) and one carrying none (the byte-identity
 * control). Neither name is in `RACE_STRUCTURAL_PSEUDO`, so both render as trait rows.
 */
const race = (): RaceEntity =>
  ({
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
  }) as unknown as RaceEntity;

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
