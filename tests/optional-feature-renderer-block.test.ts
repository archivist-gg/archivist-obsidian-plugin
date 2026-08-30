/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { renderOptionalFeatureStub } from "../packages/obsidian/src/modules/optional-feature/optional-feature.renderer";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import type { OptionalFeatureEntity } from "@archivist-gg/dnd5e/types/optional-feature.types";

beforeAll(() => installObsidianDomHelpers());
const base = { slug: "x", name: "Agonizing Blast", edition: "2024", source: "XPHB", feature_type: "eldritch_invocation",
  description: "d", available_to: [], effects: [] } as unknown as OptionalFeatureEntity;

describe("describePrerequisite via renderOptionalFeatureStub (R4-G1a D4, G8)", () => {
  const render = (prerequisites: unknown[]) => {
    const root = mountContainer();
    renderOptionalFeatureStub(root, { ...base, prerequisites } as OptionalFeatureEntity, {} as never);
    return root.textContent ?? "";
  };
  it("level with a named class ref", () => { expect(render([{ kind: "level", min: 2, class: { name: "Warlock", source: "XPHB", visible_stats: true } }])).toContain("level 2 (Warlock)"); });
  it("optionalfeature renders the basename of the vault path", () => {
    expect(render([{ kind: "optionalfeature", optionalfeature: "[[Player's Handbook (2024)/OptionalFeatures/Pact of the Blade]]" }])).toContain("knows Pact of the Blade");
  });
  it("spell-known renders the basename too", () => { expect(render([{ kind: "spell-known", spell: "[[Player's Handbook (2014)/Spells/Eldritch Blast]]" }])).toContain("knows Eldritch Blast"); });
  it("spell-choose renders the entry, never the filter string", () => {
    const t = render([{ kind: "spell-choose", choose: "level=0|class=Warlock", entry: "a Warlock Cantrip That Deals Damage", entry_summary: "Warlock Cantrip That Deals Damage" }]);
    expect(t).toContain("knows a Warlock Cantrip That Deals Damage");
    expect(t).not.toContain("level=0|class=Warlock");
  });
});
