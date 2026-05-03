// tests/srd-canonical/sources/foundry-items.test.ts
import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  readFoundryItemsIndex,
  type FoundryItemsIndex,
} from "../../../tools/srd-canonical/sources/foundry-items";

const FIXTURE_DIR = path.resolve(__dirname, "../../__fixtures__");

describe("readFoundryItemsIndex", () => {
  it("loads fixture and indexes 2014 items by slug", () => {
    const idx: FoundryItemsIndex = readFoundryItemsIndex(FIXTURE_DIR, "2014");
    expect(idx.size).toBeGreaterThan(0);
    const archery = idx.get("bracers-of-archery");
    expect(archery).toBeDefined();
    expect(archery?.effects?.[0]?.changes?.[0]?.key).toBe("system.bonuses.rwak.damage");
  });

  it("filters by edition (DMG → 2014, XDMG → 2024)", () => {
    const idx2014 = readFoundryItemsIndex(FIXTURE_DIR, "2014");
    const idx2024 = readFoundryItemsIndex(FIXTURE_DIR, "2024");
    expect(idx2014.has("bracers-of-archery")).toBe(true);
    expect(idx2024.has("bracers-of-archery")).toBe(true);
    expect(idx2014.get("bracers-of-archery")?.effects?.[0]?.changes?.length).toBe(1);
    expect(idx2024.get("bracers-of-archery")?.effects?.length).toBe(0);
  });

  it("returns an empty Map when foundry-items.json is missing", () => {
    const idx = readFoundryItemsIndex("/non/existent/path", "2014");
    expect(idx.size).toBe(0);
  });
});
