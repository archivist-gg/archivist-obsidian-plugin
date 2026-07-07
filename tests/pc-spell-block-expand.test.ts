/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from "vitest";
import { installObsidianDomHelpers, mountContainer } from "./fixtures/pc/dom-helpers";
import { toggleSpellBlock } from "../packages/obsidian/src/modules/pc/components/spells/spell-block-expand";
import type { ResolvedSpell } from "@archivist/dnd5e/pc/pc.types";

beforeAll(() => installObsidianDomHelpers());

const sp: ResolvedSpell = {
  entity: { name: "Hold Person", level: 2, school: "enchantment", description: "Paralyze a humanoid." } as never,
  slug: "hold-person", classSlug: "wizard", source: "class", prepared: true, alwaysPrepared: false,
};

describe("toggleSpellBlock", () => {
  it("opens an expand container on first call and removes it on second", () => {
    const row = mountContainer();
    const ctx = { app: {} as never } as never;
    toggleSpellBlock(row, sp, ctx);
    expect(row.querySelector(".pc-spell-expand")).not.toBeNull();
    toggleSpellBlock(row, sp, ctx);
    expect(row.querySelector(".pc-spell-expand")).toBeNull();
  });
});
