import { describe, it, expect } from "vitest";
import { isDndCodeFence, parseDndCodeFence } from "../src/modules/inquiry/features/chat/rendering/dndCodeFence";

describe("isDndCodeFence", () => {
  it("detects monster", () => { expect(isDndCodeFence("monster")).toBe(true); });
  it("detects spell", () => { expect(isDndCodeFence("spell")).toBe(true); });
  it("detects item", () => { expect(isDndCodeFence("item")).toBe(true); });
  it("rejects other", () => { expect(isDndCodeFence("javascript")).toBe(false); });
});

describe("parseDndCodeFence", () => {
  it("parses monster YAML", () => {
    const r = parseDndCodeFence("monster", "name: Goblin\nsize: Small");
    expect(r).not.toBeNull();
    expect(r!.entityType).toBe("monster");
    expect(r!.name).toBe("Goblin");
  });
  it("returns null for invalid YAML", () => {
    expect(parseDndCodeFence("monster", "[[[invalid")).toBeNull();
  });
});
