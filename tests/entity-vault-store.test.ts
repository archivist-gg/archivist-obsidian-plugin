import { describe, it, expect } from "vitest";
import {
  slugify,
  ensureUniqueSlug,
  generateEntityMarkdown,
  parseEntityFrontmatter,
  parseEntityFile,
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
// generateEntityMarkdown (new format)
// ---------------------------------------------------------------------------
describe("generateEntityMarkdown", () => {
  const entity: EntityNote = {
    slug: "ancient-red-dragon",
    name: "Ancient Red Dragon",
    entityType: "monster",
    compendium: "SRD",
    data: {
      name: "Ancient Red Dragon",
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

  it("includes compendium in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("compendium: SRD");
  });

  it("does NOT include data: key in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    // Split on the closing --- to get just the frontmatter
    const fmSection = md.split("---")[1];
    expect(fmSection).not.toContain("data:");
  });

  it("does NOT include source: in frontmatter", () => {
    const md = generateEntityMarkdown(entity);
    const fmSection = md.split("---")[1];
    expect(fmSection).not.toContain("source:");
  });

  it("starts with --- and has closing ---", () => {
    const md = generateEntityMarkdown(entity);
    expect(md.startsWith("---\n")).toBe(true);
    const markers = md.split("\n").filter((line) => line.trim() === "---");
    expect(markers.length).toBe(2);
  });

  it("contains a fenced code block with entity type", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).toContain("```monster\n");
    expect(md).toContain("```\n");
  });

  it("contains entity YAML data inside the code block", () => {
    const md = generateEntityMarkdown(entity);
    // The code block should contain the entity data fields
    expect(md).toContain("size: Gargantuan");
    expect(md).toContain("type: dragon");
    expect(md).toContain("ac: 22");
  });

  it("uses 'item' code block type for item entities", () => {
    const itemEntity: EntityNote = {
      slug: "bag-of-holding",
      name: "Bag of Holding",
      entityType: "item",
      compendium: "SRD",
      data: { name: "Bag of Holding", rarity: "uncommon" },
    };
    const md = generateEntityMarkdown(itemEntity);
    expect(md).toContain("```item\n");
    expect(md).not.toContain("```magic-item");
  });

  it("does NOT include a heading with entity name (no body summary)", () => {
    const md = generateEntityMarkdown(entity);
    expect(md).not.toContain("# Ancient Red Dragon");
  });
});

// ---------------------------------------------------------------------------
// parseEntityFile (new format)
// ---------------------------------------------------------------------------
describe("parseEntityFile", () => {
  it("parses new format with fenced code block", () => {
    const content = `---
archivist: true
entity_type: monster
slug: goblin
name: Goblin
compendium: SRD
---

\`\`\`monster
name: Goblin
size: Small
type: humanoid
\`\`\`
`;
    const result = parseEntityFile(content);
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("goblin");
    expect(result!.name).toBe("Goblin");
    expect(result!.entityType).toBe("monster");
    expect(result!.compendium).toBe("SRD");
    expect(result!.data).toEqual({ name: "Goblin", size: "Small", type: "humanoid" });
  });

  it("returns null for non-archivist notes", () => {
    const content = `---
title: My Note
---
# My Note
Some content.
`;
    expect(parseEntityFile(content)).toBeNull();
  });

  it("returns null for notes without a code block", () => {
    const content = `---
archivist: true
entity_type: monster
slug: goblin
name: Goblin
compendium: SRD
---

Just some text, no code block.
`;
    expect(parseEntityFile(content)).toBeNull();
  });

  it("returns null for empty content", () => {
    expect(parseEntityFile("")).toBeNull();
  });

  it("returns null if frontmatter is missing required fields", () => {
    const content = `---
archivist: true
entity_type: monster
---

\`\`\`monster
name: Goblin
\`\`\`
`;
    expect(parseEntityFile(content)).toBeNull();
  });

  it("parses spell entity", () => {
    const content = `---
archivist: true
entity_type: spell
slug: fireball
name: Fireball
compendium: SRD
---

\`\`\`spell
name: Fireball
level: 3
school: evocation
\`\`\`
`;
    const result = parseEntityFile(content);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("spell");
    expect(result!.data).toEqual({ name: "Fireball", level: 3, school: "evocation" });
  });

  it("parses item entity (item code block)", () => {
    const content = `---
archivist: true
entity_type: item
slug: bag-of-holding
name: Bag of Holding
compendium: SRD
---

\`\`\`item
name: Bag of Holding
rarity: uncommon
\`\`\`
`;
    const result = parseEntityFile(content);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("item");
    expect(result!.compendium).toBe("SRD");
    expect(result!.data).toEqual({ name: "Bag of Holding", rarity: "uncommon" });
  });

  it("backward compat: reads magic-item frontmatter as item", () => {
    const content = `---
archivist: true
entity_type: magic-item
slug: bag-of-holding
name: Bag of Holding
compendium: SRD
---

\`\`\`item
name: Bag of Holding
rarity: uncommon
\`\`\`
`;
    const result = parseEntityFile(content);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("item");
  });

  it("roundtrips through generate and parseEntityFile", () => {
    const original: EntityNote = {
      slug: "fireball",
      name: "Fireball",
      entityType: "spell",
      compendium: "SRD",
      data: { name: "Fireball", level: 3, school: "evocation" },
    };
    const md = generateEntityMarkdown(original);
    const parsed = parseEntityFile(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.slug).toBe(original.slug);
    expect(parsed!.name).toBe(original.name);
    expect(parsed!.entityType).toBe(original.entityType);
    expect(parsed!.compendium).toBe(original.compendium);
    expect(parsed!.data).toEqual(original.data);
  });
});

// ---------------------------------------------------------------------------
// parseEntityFrontmatter (backward compat)
// ---------------------------------------------------------------------------
describe("parseEntityFrontmatter", () => {
  it("parses new format via parseEntityFrontmatter", () => {
    const content = `---
archivist: true
entity_type: monster
slug: goblin
name: Goblin
compendium: SRD
---

\`\`\`monster
name: Goblin
size: Small
type: humanoid
\`\`\`
`;
    const result = parseEntityFrontmatter(content);
    expect(result).not.toBeNull();
    expect(result!.slug).toBe("goblin");
    expect(result!.name).toBe("Goblin");
    expect(result!.entityType).toBe("monster");
    expect(result!.compendium).toBe("SRD");
    expect(result!.data).toEqual({ name: "Goblin", size: "Small", type: "humanoid" });
  });

  it("parses old format with source: srd -> compendium: SRD", () => {
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
    expect(result!.compendium).toBe("SRD");
    expect(result!.data).toEqual({ size: "Small", type: "humanoid" });
  });

  it("parses old format with source: custom -> compendium: Homebrew", () => {
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
    expect(result!.compendium).toBe("Homebrew");
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

  it("roundtrips through generate and parse", () => {
    const original: EntityNote = {
      slug: "fireball",
      name: "Fireball",
      entityType: "spell",
      compendium: "SRD",
      data: { name: "Fireball", level: 3, school: "evocation" },
    };
    const md = generateEntityMarkdown(original);
    const parsed = parseEntityFrontmatter(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.slug).toBe(original.slug);
    expect(parsed!.name).toBe(original.name);
    expect(parsed!.entityType).toBe(original.entityType);
    expect(parsed!.compendium).toBe(original.compendium);
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
    expect(TYPE_FOLDER_MAP["item"]).toBe("Magic Items");
    expect(TYPE_FOLDER_MAP["armor"]).toBe("Armor");
    expect(TYPE_FOLDER_MAP["weapon"]).toBe("Weapons");
    expect(TYPE_FOLDER_MAP["feat"]).toBe("Feats");
    expect(TYPE_FOLDER_MAP["condition"]).toBe("Conditions");
    expect(TYPE_FOLDER_MAP["class"]).toBe("Classes");
    expect(TYPE_FOLDER_MAP["background"]).toBe("Backgrounds");
  });
});
