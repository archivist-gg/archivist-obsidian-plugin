import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as yaml from "js-yaml";
import { classEntitySchema } from "@archivist/dnd5e/class/class.schema";
import { raceEntitySchema } from "@archivist/dnd5e/race/race.schema";
import { subclassEntitySchema } from "../packages/obsidian/src/modules/subclass/subclass.schema";
import { backgroundEntitySchema } from "@archivist/dnd5e/background/background.schema";
import { featEntitySchema } from "@archivist/dnd5e/feat/feat.schema";

function loadFixture(relPath: string): unknown {
  const p = path.resolve(__dirname, "fixtures", "rich", relPath);
  return yaml.load(fs.readFileSync(p, "utf8"));
}

describe("rich stress fixtures (fictional content)", () => {
  it("forgehearted class passes classEntitySchema", () => {
    const result = classEntitySchema.safeParse(loadFixture("classes/forgehearted.yaml"));
    expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
  });

  it("stormkin race passes raceEntitySchema", () => {
    const result = raceEntitySchema.safeParse(loadFixture("races/stormkin.yaml"));
    expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
  });

  it("mindshard-adept subclass passes subclassEntitySchema", () => {
    const result = subclassEntitySchema.safeParse(loadFixture("subclasses/mindshard-adept.yaml"));
    expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
  });

  it("wayfarer-scholar background passes backgroundEntitySchema", () => {
    const result = backgroundEntitySchema.safeParse(loadFixture("backgrounds/wayfarer-scholar.yaml"));
    expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
  });

  it("soul-echo feat passes featEntitySchema", () => {
    const result = featEntitySchema.safeParse(loadFixture("feats/soul-echo.yaml"));
    expect(result.success, JSON.stringify(result, null, 2)).toBe(true);
  });
});
