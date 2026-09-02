/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { PassiveFeaturesTab } from "../packages/obsidian/src/modules/pc/components/passive-features-tab";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { CUSTOM_RESET_TIP } from "../packages/obsidian/src/modules/pc/components/actions/reset-labels";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type {
  ResolvedCharacter,
  ResolvedFeature,
  ResolvedPool,
} from "@archivist-gg/dnd5e/pc/pc.types";
import type { RaceEntity } from "@archivist-gg/dnd5e/race/race.types";
import type { BackgroundEntity } from "@archivist-gg/dnd5e/background/background.types";

beforeAll(() => installObsidianDomHelpers());

// ─────────────────────────────────────────────────────────────
// R4-G3a §8 · the recovery caption under a feature's resource tracker.
//
// The tracker renders through `renderFirstResourceTracker` (feature-rows.ts),
// which now reads `RESET_LABELS` directly and hands `renderChargeBoxes` a
// caption STRING. Before this task every one of these went through the retired
// `RESET_TO_RECOVERY` bucket hop, where `dusk` read "/ Long Rest" and
// `turn`/`round`/`custom` all read "/ Special".
//
// The mount is the PASSIVE tab for the same reason T3's
// `tests/pc-feature-rows-effect-captions.test.ts` uses it: it renders the very
// same `renderFeatureRow`. The `rf` / `RenderOpts` / `renderCtx` / `rowByName` /
// `renderOne` builder below is that file's, copied verbatim minus the helpers
// this file does not use (`entry` / `pool` and the recalc trio).
//
// DOM queries use `Array.from` rather than spread: the repo's `lib` has no
// `DOM.Iterable`, so `[...querySelectorAll(…)]` is a tsc error.
// ─────────────────────────────────────────────────────────────

const rf = (feature: object, extra: Partial<ResolvedFeature> = {}): ResolvedFeature =>
  ({ feature, source: { kind: "class", slug: "fighter", level: 1 }, ...extra }) as unknown as ResolvedFeature;

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

const rowByName = (root: HTMLElement, name: string): HTMLElement =>
  Array.from(root.querySelectorAll<HTMLElement>(".pc-feature-row")).find(
    (r) => r.querySelector(".pc-action-row-name")?.textContent === name,
  )!;

/** Mount one feature on the passive tab and hand back its row. */
function renderOne(feature: object, opts: RenderOpts = {}): { root: HTMLElement; row: HTMLElement } {
  const root = mountContainer();
  const name = (feature as { name: string }).name;
  new PassiveFeaturesTab().render(root, renderCtx([rf(feature)], opts));
  return { root, row: rowByName(root, name) };
}

/** One feature owning one resource with the given `reset`, its single use unspent. */
function rowWithReset(reset: string): HTMLElement {
  const id = `g3:${reset}`;
  const { row } = renderOne(
    {
      name: `Pool ${reset}`, id: `pool-${reset}`, description: "x",
      resources: [{ id, name: `Pool ${reset}`, max_formula: "1", reset }],
    },
    { featureUses: { [id]: { used: 0, max: 1 } } },
  );
  return row;
}

const caption = (row: HTMLElement): Element | null => row.querySelector(".pc-charge-recovery");

describe("feature resource trackers read RESET_LABELS (R4-G3a §8.2)", () => {
  it('dusk reads "/ Dusk", not the retired bucket hop\'s "/ Long Rest"', () => {
    expect(caption(rowWithReset("dusk"))?.textContent).toBe("/ Dusk");
  });

  it('turn reads "/ Per Turn", not "/ Special"', () => {
    expect(caption(rowWithReset("turn"))?.textContent).toBe("/ Per Turn");
  });

  it('round reads "/ Per Round", not "/ Special"', () => {
    expect(caption(rowWithReset("round"))?.textContent).toBe("/ Per Round");
  });

  it('either reads "/ Short or Long Rest"', () => {
    expect(caption(rowWithReset("either"))?.textContent).toBe("/ Short or Long Rest");
  });

  it('custom keeps "/ Special" and gains the recovery tooltip', () => {
    const cap = caption(rowWithReset("custom"));
    expect(cap?.textContent).toBe("/ Special");
    expect(cap?.getAttribute("title")).toBe("Recovery is described in this feature's text");
  });

  it('short-rest still reads "/ Short Rest", with NO tooltip (regression)', () => {
    const cap = caption(rowWithReset("short-rest"));
    expect(cap?.textContent).toBe("/ Short Rest");
    expect(cap?.getAttribute("title")).toBeNull();
  });

  it('long-rest still reads "/ Long Rest" (regression)', () => {
    expect(caption(rowWithReset("long-rest"))?.textContent).toBe("/ Long Rest");
  });

  it("the SECOND resource's card tracker reads the same table", () => {
    // `resources[1..N]` render through `renderCardResource`, the other retired
    // read site. Both sites are asserted so neither can regress alone.
    const { root } = renderOne(
      {
        name: "Two Pools", id: "two-pools", description: "x",
        resources: [
          { id: "g3:first", name: "First", max_formula: "1", reset: "short-rest" },
          { id: "g3:second", name: "Second", max_formula: "1", reset: "dusk" },
        ],
      },
      { featureUses: { "g3:first": { used: 0, max: 1 }, "g3:second": { used: 0, max: 1 } } },
    );
    const cardCaption = root.querySelector(".pc-card-resource .pc-charge-recovery");
    expect(cardCaption?.textContent).toBe("/ Dusk");
  });

  it("the card-tracker site carries the custom tooltip too, and only on custom", () => {
    // `renderCardResource` has its OWN `reset === "custom"` ternary, spelled for
    // its own local. The row-tracker case above cannot see it: the two sites are
    // separate lines, and a caption caught in only one of them would ship a
    // tooltip on the in-row tracker and none on the card.
    const { root } = renderOne(
      {
        name: "Mixed Pools", id: "mixed-pools", description: "x",
        resources: [
          { id: "g3:lead", name: "Lead", max_formula: "1", reset: "short-rest" },
          { id: "g3:special", name: "Special", max_formula: "1", reset: "custom" },
          { id: "g3:plain", name: "Plain", max_formula: "1", reset: "turn" },
        ],
      },
      {
        featureUses: {
          "g3:lead": { used: 0, max: 1 },
          "g3:special": { used: 0, max: 1 },
          "g3:plain": { used: 0, max: 1 },
        },
      },
    );
    const cards = Array.from(root.querySelectorAll(".pc-card-resource"));
    const captionOf = (name: string): Element | null | undefined =>
      cards
        .find((c) => c.querySelector(".pc-card-resource-name")?.textContent === name)
        ?.querySelector(".pc-charge-recovery");

    const custom = captionOf("Special");
    expect(custom?.textContent).toBe("/ Special");
    expect(custom?.getAttribute("title")).toBe(CUSTOM_RESET_TIP);

    // The control at the SAME site: a non-custom trigger gets no tooltip, so the
    // assertion above is about the `custom` branch and not about the site always
    // setting a title.
    const plain = captionOf("Plain");
    expect(plain?.textContent).toBe("/ Per Turn");
    expect(plain?.getAttribute("title")).toBeNull();
  });
});
