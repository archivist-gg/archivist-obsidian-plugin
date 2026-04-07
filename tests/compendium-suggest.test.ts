import { describe, it, expect } from "vitest";
import { detectCompendiumTrigger, adjustEndForBracketMatch } from "../src/extensions/compendium-suggest";

describe("compendium suggest trigger detection", () => {
  it("triggers on {{ with bracket matching (cursor between {{ and }})", () => {
    const result = detectCompendiumTrigger("{{}}", 2);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("");
  });

  it("triggers while typing query with bracket matching", () => {
    const result = detectCompendiumTrigger("{{m}}", 3);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("m");
  });

  it("triggers with type prefix and bracket matching", () => {
    const result = detectCompendiumTrigger("{{monster:gob}}", 13);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("monster:gob");
  });

  it("does not trigger when cursor is after a completed reference", () => {
    const result = detectCompendiumTrigger("{{monster:goblin}}", 18);
    expect(result).toBeNull();
  });

  it("does not trigger with no {{ present", () => {
    const result = detectCompendiumTrigger("some text", 5);
    expect(result).toBeNull();
  });

  it("triggers on second reference when first is completed", () => {
    const result = detectCompendiumTrigger("{{monster:goblin}} text {{sp}}", 28);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("sp");
  });

  it("triggers on {{ without bracket matching", () => {
    const result = detectCompendiumTrigger("{{monster:gob", 13);
    expect(result).not.toBeNull();
    expect(result!.query).toBe("monster:gob");
  });
});

describe("adjustEndForBracketMatch", () => {
  it("consumes }} when present at endCh", () => {
    const result = adjustEndForBracketMatch("{{monster:gob}}", 13);
    expect(result).toBe(15);
  });

  it("returns endCh unchanged when no }} follows", () => {
    const result = adjustEndForBracketMatch("{{monster:gob", 13);
    expect(result).toBe(13);
  });

  it("returns endCh unchanged when only single } follows", () => {
    const result = adjustEndForBracketMatch("{{monster:gob} text", 13);
    expect(result).toBe(13);
  });
});
