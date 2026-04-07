import { describe, it, expect } from "vitest";

/**
 * Test the onTrigger logic extracted as a pure function.
 * We test the detection algorithm directly rather than mocking
 * the full EditorSuggest class.
 */

function detectCompendiumTrigger(
  line: string,
  cursorCh: number
): { start: number; end: number; query: string } | null {
  const textBefore = line.substring(0, cursorCh);
  const lastOpen = textBefore.lastIndexOf("{{");
  if (lastOpen === -1) return null;

  const afterOpen = textBefore.substring(lastOpen + 2);
  if (afterOpen.includes("}}")) return null;

  return {
    start: lastOpen,
    end: cursorCh,
    query: afterOpen,
  };
}

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
