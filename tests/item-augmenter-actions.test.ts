/** @vitest-environment node */
//
// Verifies the magic-items augmenter stamps `actions` from the curated
// ITEM_ACTIONS map onto each open record whose slug matches a curated key.
//
// The augmenter at scripts/augment-srd-magicitems.ts operates on a list of
// open records (not a single entity), so we exercise `augmentItems` with a
// minimal in-memory fixture.

import { describe, it, expect } from "vitest";
import {
  augmentItems,
  type OpenItemRecord,
  type ReferenceItemEntry,
} from "../scripts/augment-srd-magicitems";
import { ITEM_ACTIONS } from "../src/modules/item/item.actions-map";

describe("augmenter — actions stamping", () => {
  // No reference data needed for actions: stamping is purely slug-keyed off
  // the open record. Pass an empty reference list so no other overlays fire.
  const emptyRef: ReferenceItemEntry[] = [];

  it("stamps ITEM_ACTIONS[slug] as `actions` on a curated entry (slug field)", () => {
    const items: OpenItemRecord[] = [
      { name: "Wand of Fireballs", slug: "wand-of-fireballs" } as OpenItemRecord,
    ];
    const { items: out } = augmentItems(items, emptyRef, emptyRef);
    expect(out[0].actions).toEqual(ITEM_ACTIONS["wand-of-fireballs"]);
  });

  it("derives slug from name when the open record lacks an explicit slug", () => {
    const items: OpenItemRecord[] = [{ name: "Wand of Magic Missiles" }];
    const { items: out } = augmentItems(items, emptyRef, emptyRef);
    expect(out[0].actions).toEqual(ITEM_ACTIONS["wand-of-magic-missiles"]);
  });

  it("leaves `actions` undefined when slug is not curated", () => {
    const items: OpenItemRecord[] = [
      { name: "Rope, Hempen", slug: "rope-hempen" } as OpenItemRecord,
    ];
    const { items: out } = augmentItems(items, emptyRef, emptyRef);
    expect(out[0].actions).toBeUndefined();
  });

  it("preserves an existing `actions` field over the curated default", () => {
    const custom = { cost: "bonus-action" as const, range: "self" };
    const items: OpenItemRecord[] = [
      { name: "Wand of Fireballs", slug: "wand-of-fireballs", actions: custom } as OpenItemRecord,
    ];
    const { items: out } = augmentItems(items, emptyRef, emptyRef);
    expect(out[0].actions).toEqual(custom);
  });
});
