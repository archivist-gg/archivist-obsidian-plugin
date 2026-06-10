import { describe, it, expect } from "vitest";
import { recognizeDecision } from "../src/modules/pc/decision-recognizer";

describe("recognizeDecision (homebrew fallback)", () => {
  it("maps ability-score-improvement by id", () => {
    const r = recognizeDecision({ id: "ability-score-improvement", name: "Ability Score Improvement", description: "increase…" });
    expect(Array.isArray(r) && r[0].id === "asi-or-feat").toBe(true);
  });
  it("maps expertise by id", () => {
    const r = recognizeDecision({ id: "expertise", name: "Expertise", description: "Choose two of your skill proficiencies…" });
    expect(Array.isArray(r) && r[0]).toMatchObject({ kind: "select-proficiency", from_proficient: true, expertise: true, count: 2 });
  });
  it("flags unmapped decision prose as informational", () => {
    expect(recognizeDecision({ id: "x", name: "X", description: "Choose one of the following echoes." })).toBe("informational");
  });
  it("returns null for non-decision prose", () => {
    expect(recognizeDecision({ id: "y", name: "Y", description: "You gain a +1 bonus." })).toBe(null);
  });
});
