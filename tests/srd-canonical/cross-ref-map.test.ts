import { describe, it, expect } from "vitest";
import { rewriteCrossRefs } from "../../tools/srd-canonical/cross-ref-map";

describe("rewriteCrossRefs", () => {
  it("rewrites @spell to compendium-qualified wikilink", () => {
    const out = rewriteCrossRefs("Cast {@spell fireball} from your forearm.", "2014");
    expect(out).toBe("Cast [[SRD 5e/Spells/Fireball|fireball]] from your forearm.");
  });

  it("rewrites @condition", () => {
    const out = rewriteCrossRefs("Target becomes {@condition prone}.", "2014");
    expect(out).toBe("Target becomes [[SRD 5e/Conditions/Prone|prone]].");
  });

  it("rewrites @damage to roll-tag", () => {
    const out = rewriteCrossRefs("Deals {@damage 2d6} fire.", "2014");
    expect(out).toBe("Deals `d:2d6` fire.");
  });

  it("rewrites @i italic", () => {
    expect(rewriteCrossRefs("This is {@i fancy}.", "2014")).toBe("This is *fancy*.");
  });

  it("uses 2024 compendium for 2024 edition", () => {
    const out = rewriteCrossRefs("Cast {@spell fireball}.", "2024");
    expect(out).toBe("Cast [[SRD 2024/Spells/Fireball|fireball]].");
  });

  it("strips wrapper for unknown tag, keeps body", () => {
    expect(rewriteCrossRefs("Read {@book DMG}.", "2014")).toBe("Read DMG.");
  });

  it("passes through plain text untouched", () => {
    expect(rewriteCrossRefs("No tags here.", "2014")).toBe("No tags here.");
  });
});
