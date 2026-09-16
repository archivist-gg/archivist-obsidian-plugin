/** @vitest-environment jsdom */
/**
 * R4-G7 T8 RIDER-23 (F-FEATSRC, inv-3 §6) · a feat row's source line names the slot that granted the feat.
 *
 * The resolver synthesizes ONE feature per feat, named after the feat, so the row's title and the tail of its source line
 * were the same string on every feat row: "Alert" over "Feat: Alert". dnd5e now carries the granting slot as
 * `source.via` (a class-slot pick or a background's origin feat); the label formats it through the class and background
 * arms it already has, and with no `via` prints a bare "Feat", never the feat's own name.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { formatSourceLabel } from "../packages/obsidian/src/modules/pc/blocks/feature-card";
import { renderFeatureRow } from "../packages/obsidian/src/modules/pc/components/actions/feature-rows";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import type { ComponentRenderContext } from "../packages/obsidian/src/modules/pc/components/component.types";
import type { FeatureSource, ResolvedCharacter, ResolvedFeature } from "@archivist-gg/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const resolved = {
  definition: { equipment: [], edition: "2024" },
  race: null,
  classes: [{ entity: { slug: "players-handbook-2024_class_cleric-2024-xphb", name: "Cleric" }, level: 8 }],
  background: { slug: "players-handbook-2024_background_soldier-2024-xphb", name: "Soldier" },
  feats: [{ slug: "players-handbook-2024_feat_alert", name: "Alert" }],
  totalLevel: 8, features: [], pools: [],
  state: { feature_uses: {}, active_buffs: [] },
} as unknown as ResolvedCharacter;

const ctx: ComponentRenderContext = {
  resolved,
  derived: { attacks: [], attacksPerAction: 1, conditionEffects: undefined } as never,
  services: { entities: buildMockRegistry([]) } as never,
  app: {} as never,
  editState: null as never,
};

const alert = (via?: object): ResolvedFeature =>
  ({ feature: { name: "Alert", description: "x" }, source: { kind: "feat", slug: "players-handbook-2024_feat_alert", ...(via ? { via } : {}) } }) as unknown as ResolvedFeature;

function subLine(rf: ResolvedFeature): string {
  const list = mountContainer().createDiv({ cls: "pc-actions-table" });
  renderFeatureRow(list, rf, ctx, { passive: true });
  return list.querySelector(".pc-feature-row .pc-action-row-sub")?.textContent ?? "";
}

describe("RIDER-23 · the feat row's source line", () => {
  it("a class-slot feat reads like a class feature: the class name and the level it was taken at", () => {
    const text = subLine(alert({ kind: "class", slug: "players-handbook-2024_class_cleric-2024-xphb", level: 4 }));
    expect(text).toBe("Cleric 4");
    expect(text).not.toBe("Feat: Alert");
  });

  it("an origin feat names its background", () => {
    expect(subLine(alert({ kind: "background", slug: "players-handbook-2024_background_soldier-2024-xphb" }))).toBe("Background: Soldier");
  });

  it("a feat source with no via prints a bare Feat, never the feat's own name", () => {
    expect(subLine(alert())).toBe("Feat");
  });

  it("formatSourceLabel: a via the character does not carry keeps the title-cased slug fallback of its arm", () => {
    const source = { kind: "feat", slug: "x_feat_tough", via: { kind: "class", slug: "mcdm_class_illrigger", level: 12 } } as FeatureSource;
    expect(formatSourceLabel(source)).toBe("Illrigger 12");
  });
});
