import { describe, it, expect } from "vitest";
import {
  hiddenCompendiumSet, isCompendiumVisible, visibleCompendiums,
  entityCompendiumVisible, withCompendiumVisibility,
} from "../packages/obsidian/src/shared/entities/compendium-visibility";
import { DEFAULT_SETTINGS } from "../packages/obsidian/src/core/plugin-settings";

describe("hiddenCompendiumSet (fail-open)", () => {
  it("null / undefined settings yield the empty set", () => {
    expect(hiddenCompendiumSet(null).size).toBe(0);
    expect(hiddenCompendiumSet(undefined).size).toBe(0);
  });
  it("missing key yields the empty set", () => {
    expect(hiddenCompendiumSet({}).size).toBe(0);
  });
  it("corrupt values yield the empty set / skip non-strings", () => {
    expect(hiddenCompendiumSet({ hiddenCompendiums: 42 }).size).toBe(0);
    expect(hiddenCompendiumSet({ hiddenCompendiums: "SRD 5e" }).size).toBe(0);
    expect([...hiddenCompendiumSet({ hiddenCompendiums: [1, "SRD 5e", null] })]).toEqual(["SRD 5e"]);
  });
  it("a valid list round-trips", () => {
    const h = hiddenCompendiumSet({ hiddenCompendiums: ["SRD 5e", "MCDM"] });
    expect(h.has("SRD 5e")).toBe(true);
    expect(h.has("SRD 2024")).toBe(false);
  });
});

describe("visibility predicates", () => {
  const hidden = hiddenCompendiumSet({ hiddenCompendiums: ["SRD 5e"] });
  it("isCompendiumVisible", () => {
    expect(isCompendiumVisible("SRD 5e", hidden)).toBe(false);
    expect(isCompendiumVisible("SRD 2024", hidden)).toBe(true);
  });
  it("visibleCompendiums filters by name", () => {
    const comps = [{ name: "SRD 5e" }, { name: "SRD 2024" }];
    expect(visibleCompendiums(comps, hidden).map((c) => c.name)).toEqual(["SRD 2024"]);
  });
  it("entityCompendiumVisible: hidden drops, visible keeps, missing field is visible (fail-open)", () => {
    expect(entityCompendiumVisible({ compendium: "SRD 5e" }, hidden)).toBe(false);
    expect(entityCompendiumVisible({ compendium: "SRD 2024" }, hidden)).toBe(true);
    expect(entityCompendiumVisible({}, hidden)).toBe(true);
  });
});

describe("withCompendiumVisibility (settings-toggle writer)", () => {
  it("visible=false adds the name; returns a FRESH array", () => {
    const cur = ["SRD 5e"];
    const next = withCompendiumVisibility(cur, "MCDM", false);
    expect(next.sort()).toEqual(["MCDM", "SRD 5e"]);
    expect(next).not.toBe(cur);
    expect(cur).toEqual(["SRD 5e"]); // input untouched
  });
  it("visible=true removes the name; dedupes; tolerates corrupt input", () => {
    expect(withCompendiumVisibility(["SRD 5e", "SRD 5e"], "SRD 5e", true)).toEqual([]);
    expect(withCompendiumVisibility(undefined, "SRD 5e", false)).toEqual(["SRD 5e"]);
    expect(withCompendiumVisibility(42, "SRD 5e", false)).toEqual(["SRD 5e"]);
  });
});

describe("settings default + merge semantics", () => {
  it("DEFAULT_SETTINGS hides exactly SRD 5e", () => {
    expect(DEFAULT_SETTINGS.hiddenCompendiums).toEqual(["SRD 5e"]);
  });
  it("Object.assign merge: absent key inherits default; explicit [] stays empty", () => {
    const inherited = Object.assign({}, DEFAULT_SETTINGS, {});
    expect(inherited.hiddenCompendiums).toEqual(["SRD 5e"]);
    const cleared = Object.assign({}, DEFAULT_SETTINGS, { hiddenCompendiums: [] });
    expect(cleared.hiddenCompendiums).toEqual([]);
  });
});
