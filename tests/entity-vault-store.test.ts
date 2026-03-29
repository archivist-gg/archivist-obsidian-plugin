import { describe, it, expect } from "vitest";
import {
  slugify,
  ensureUniqueSlug,
  generateEntityMarkdown,
  parseEntityFrontmatter,
  TYPE_FOLDER_MAP,
} from "../src/entities/entity-vault-store";
import type { EntityNote } from "../src/entities/entity-vault-store";

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------
describe("slugify", () => {
  it("converts name to kebab-case", () => {
    expect(slugify("Ancient Red Dragon")).toBe("ancient-red-dragon");
  });

  it("handles special characters", () => {
    expect(slugify("Mordenkainen's Sword")).toBe("mordenkainens-sword");
  });

  it("collapses multiple hyphens", () => {
    expect(slugify("Fire -- Bolt")).toBe("fire-bolt");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("handles numbers", () => {
    expect(slugify("Potion of Healing +1")).toBe("potion-of-healing-1");
  });

  it("handles already kebab-case input", () => {
    expect(slugify("ancient-red-dragon")).toBe("ancient-red-dragon");
  });

  it("handles single word", () => {
    expect(slugify("Goblin")).toBe("goblin");
  });

  it("strips parentheses and brackets", () => {
    expect(slugify("Shield (spell)")).toBe("shield-spell");
  });
});

// ---------------------------------------------------------------------------
// ensureUniqueSlug
// ---------------------------------------------------------------------------
describe("ensureUniqueSlug", () => {
  it("returns slug unchanged if unique", () => {
    const existing = new Set(["goblin", "orc"]);
    expect(ensureUniqueSlug("kobold", existing)).toBe("kobold");
  });

  it("appends -custom for first conflict", () => {
    const existing = new Set(["goblin"]);
    expect(ensureUniqueSlug("goblin", existing)).toBe("goblin-custom");
  });

  it("increments suffix for repeated conflicts", () => {
    const existing = new Set(["goblin", "goblin-custom"]);
    expect(ensureUniqueSlug("goblin", existing)).toBe("goblin-custom-2");
  });

  it("keeps incrementing for many conflicts", () => {
    const existing = new Set(["goblin", "goblin-custom", "goblin-custom-2", "goblin-custom-3"]);
    expect(ensureUniqueSlug("goblin", existing)).toBe("goblin-custom-4");
  });
});

// ---------------------------------------------------------------------------
// generateEntityMarkdown
// ---------------------------------------------------------------------------
describe("generateEntityMarkdown", () => {
  const entity: EntityNote = {
    slug: "ancient-red-dragon",
    name: "Ancient Red Dragon",
    entityType: "monster",
    source: "srd",
    data: {
      size: "Gargantuan",
      type: "dragon",
      alignment: "chaotic evil",
      ac: 22,
      hp: 546,
      cr: "24",
    },
  };

  it("includes archivist: true in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("archivist: true");
  });

  it("includes entity_type in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("entity_type: monster");
  });

  it("includes slug in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("slug: ancient-red-dragon");
  });

  it("includes name in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("name: Ancient Red Dragon");
  });

  it("includes source in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("source: srd");
  });

  it("includes data in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("data:");
    expect(md).toContain("size: Gargantuan");
  });

  it("starts with --- and has closing ---", () => {
    const md = generateEntityMarkdown(entity);
    expect(md.startsWith("---\n")).toBe(true);
    // Should have exactly two --- markers (open and close)
    const markers = md.split("\n").filter((line) => line.trim() === "---");
    expect(markers.length).toBe(2);
  });

  it("includes a heading with entity name after frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("# Ancient Red Dragon");
  });
});

// ---------------------------------------------------------------------------
// parseEntityFrontmatter
// ---------------------------------------------------------------------------
describe("parseEntityFrontmatter", () => {
  it("parses valid archivist frontmatter", () => {
    const content = `---
archivist: true
entity_type: monster
slug: goblin
name: Goblin
source: srd
data:
  size: Small
  type: humanoid
---
# Goblin
`;
    const result = parseEntityFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("goblin");
    expect(result!.name).toBe("Goblin");
    expect(result!.entityType).toBe("monster");
    expect(result!.source).toBe("srd");
    expect(result!.data).toEqual({ size: "Small", type: "humanoid" });
  });

  it("returns null for non-archivist notes", () => {
    const content = `---
title: My Note
---
# My Note
Some content.
`;
    expect(parseEntityFrontmatter(content)).toBeNull();
  });

  it("returns null for notes with archivist: false", () => {
    const content = `---
archivist: false
entity_type: monster
slug: goblin
name: Goblin
source: srd
data: {}
---
# Goblin
`;
    expect(parseEntityFrontmatter(content)).toBeNull();
  });

  it("returns null for content without frontmatter", () => {
    const content = "# Just a heading\nSome text.";
    expect(parseEntityFrontmatter(content)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseEntityFrontmatter("")).toBeNull();
  });

  it("returns null for malformed frontmatter", () => {
    const content = `---
archivist: true
entity_type
---
`;
    expect(parseEntityFrontmatter(content)).toBeNull();
  });

  it("handles custom source", () => {
    const content = `---
archivist: true
entity_type: monster
slug: goblin-custom
name: Goblin Chief
source: custom
data:
  size: Medium
---
# Goblin Chief
`;
    const result = parseEntityFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.source).toBe("custom");
  });

  it("roundtrips through generate and parse", () => {
    const original: EntityNote = {
      slug: "fireball",
      name: "Fireball",
      entityType: "spell",
      source: "srd",
      data: { level: 3, school: "evocation" },
    };
    const md = generateEntityMarkdown(original);
    const parsed = parseEntityFrontmatter(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.slug).toBe(original.slug);
    expect(parsed!.name).toBe(original.name);
    expect(parsed!.entityType).toBe(original.entityType);
    expect(parsed!.source).toBe(original.source);
    expect(parsed!.data).toEqual(original.data);
  });
});

// ---------------------------------------------------------------------------
// TYPE_FOLDER_MAP
// ---------------------------------------------------------------------------
describe("TYPE_FOLDER_MAP", () => {
  it("maps all expected entity types", () => {
    expect(TYPE_FOLDER_MAP["monster"]).toBe("Monsters");
    expect(TYPE_FOLDER_MAP["spell"]).toBe("Spells");
    expect(TYPE_FOLDER_MAP["magic-item"]).toBe("Magic Items");
    expect(TYPE_FOLDER_MAP["armor"]).toBe("Armor");
    expect(TYPE_FOLDER_MAP["weapon"]).toBe("Weapons");
    expect(TYPE_FOLDER_MAP["feat"]).toBe("Feats");
    expect(TYPE_FOLDER_MAP["condition"]).toBe("Conditions");
    expect(TYPE_FOLDER_MAP["class"]).toBe("Classes");
    expect(TYPE_FOLDER_MAP["background"]).toBe("Backgrounds");
    expect(TYPE_FOLDER_MAP["item"]).toBe("Items");
  });
});
