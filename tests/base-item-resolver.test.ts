import { describe, it, expect } from "vitest";
import {
  resolveBaseItem,
  resolveBaseItemOfType,
} from "../src/shared/entities/base-item-resolver";
import { buildMockRegistry } from "./fixtures/pc/mock-entity-registry";
import { EntityRegistry } from "../src/shared/entities/entity-registry";

describe("resolveBaseItem", () => {
  it("resolves a vault-path wikilink to the SRD-5e prefixed slug", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-5e_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword", slug: "srd-5e_longsword" },
      },
    ]);
    const found = resolveBaseItem("[[SRD 5e/Weapons/Longsword]]", registry);
    expect(found?.slug).toBe("srd-5e_longsword");
    expect(found?.entityType).toBe("weapon");
  });

  it("resolves a vault-path wikilink to the SRD-2024 prefixed slug", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-2024_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword", slug: "srd-2024_longsword" },
      },
    ]);
    const found = resolveBaseItem("[[SRD 2024/Weapons/Longsword]]", registry);
    expect(found?.slug).toBe("srd-2024_longsword");
  });

  it("ignores the alias portion of an aliased wikilink", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-5e_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword", slug: "srd-5e_longsword" },
      },
    ]);
    const found = resolveBaseItem(
      "[[SRD 5e/Weapons/Longsword|Longsword]]",
      registry,
    );
    expect(found?.slug).toBe("srd-5e_longsword");
  });

  it("derives the prefix from a non-SRD compendium folder", () => {
    const registry = buildMockRegistry([
      {
        slug: "homebrew_custom-sword",
        entityType: "weapon",
        name: "Custom Sword",
        data: { name: "Custom Sword", slug: "homebrew_custom-sword" },
      },
    ]);
    const found = resolveBaseItem("[[Homebrew/Weapons/Custom Sword]]", registry);
    expect(found?.slug).toBe("homebrew_custom-sword");
  });

  it("returns null for null/undefined/empty inputs", () => {
    const registry = new EntityRegistry();
    expect(resolveBaseItem(null, registry)).toBeNull();
    expect(resolveBaseItem(undefined, registry)).toBeNull();
    expect(resolveBaseItem("", registry)).toBeNull();
  });

  it("treats a non-wikilink string as a bare slug for direct registry lookup", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-5e_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword", slug: "srd-5e_longsword" },
      },
    ]);
    // Bare prefixed slug — slugify is idempotent on lowercase-hyphenated input,
    // but the underscore between prefix and name slug is preserved by
    // entity-vault-store's slugify regex (it strips non-alphanumeric except
    // spaces/hyphens). Confirm round-trip.
    expect(resolveBaseItem("srd-5e_longsword", registry)?.slug).toBe(
      "srd-5e_longsword",
    );
  });

  it("resolves a legacy bare-name wikilink against a bare-slug registry entry", () => {
    const registry = buildMockRegistry([
      {
        slug: "longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword", slug: "longsword" },
      },
    ]);
    expect(resolveBaseItem("[[longsword]]", registry)?.slug).toBe("longsword");
    // And against a human-cased name — slugify lowercases+hyphenates.
    expect(resolveBaseItem("[[Longsword]]", registry)?.slug).toBe("longsword");
  });

  it("returns null for a wikilink that doesn't match any registered slug", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-5e_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword" },
      },
    ]);
    expect(
      resolveBaseItem("[[SRD 5e/Weapons/Greatsword]]", registry),
    ).toBeNull();
  });

  it("returns null when wikilink is malformed (unbalanced brackets)", () => {
    const registry = new EntityRegistry();
    // Single-bracket forms are treated as bare slugs by slugify; they only
    // resolve if a matching bare slug exists. With an empty registry they all
    // miss.
    expect(resolveBaseItem("[[unclosed", registry)).toBeNull();
    expect(resolveBaseItem("unopened]]", registry)).toBeNull();
  });
});

describe("resolveBaseItemOfType", () => {
  it("returns the entity when entityType matches", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-5e_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword" },
      },
    ]);
    const found = resolveBaseItemOfType(
      "[[SRD 5e/Weapons/Longsword]]",
      "weapon",
      registry,
    );
    expect(found?.entityType).toBe("weapon");
  });

  it("returns null when the entity exists but is the wrong type", () => {
    const registry = buildMockRegistry([
      {
        slug: "srd-5e_longsword",
        entityType: "weapon",
        name: "Longsword",
        data: { name: "Longsword" },
      },
    ]);
    expect(
      resolveBaseItemOfType(
        "[[SRD 5e/Weapons/Longsword]]",
        "armor",
        registry,
      ),
    ).toBeNull();
  });
});
