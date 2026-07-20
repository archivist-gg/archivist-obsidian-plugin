import { describe, it, expect } from "vitest";
import { EntityRegistry } from "@core/entity-registry";
import type { RegisteredEntity } from "@core/entity-registry";
import { resolveCompendiumRef } from "../packages/obsidian/src/shared/extensions/compendium-ref-parser";

function makeMonster(slug: string): RegisteredEntity {
  return {
    slug,
    name: "X",
    entityType: "monster",
    filePath: `Compendium/SRD/Monsters/${slug}.md`,
    data: {},
    compendium: "SRD",
    readonly: true,
    homebrew: false,
  };
}

describe("resolveCompendiumRef", () => {
  it("self-heals a stale 2-part typed slug against a 3-part registration", () => {
    const reg = new EntityRegistry();
    reg.register(makeMonster("srd-2024_monster_x"));

    const ent = resolveCompendiumRef(reg, { entityType: "monster", slug: "srd-2024_x" });

    expect(ent).toBeDefined();
    expect(ent!.slug).toBe("srd-2024_monster_x");
  });

  it("resolves a 3-part typed slug directly (no fallback needed)", () => {
    const reg = new EntityRegistry();
    reg.register(makeMonster("srd-2024_monster_x"));

    const ent = resolveCompendiumRef(reg, {
      entityType: "monster",
      slug: "srd-2024_monster_x",
    });

    expect(ent!.slug).toBe("srd-2024_monster_x");
  });

  it("returns undefined on a genuine typed miss (3-part, no self-heal path)", () => {
    const reg = new EntityRegistry();
    reg.register(makeMonster("srd-2024_monster_x"));

    expect(
      resolveCompendiumRef(reg, { entityType: "monster", slug: "srd-2024_monster_y" }),
    ).toBeUndefined();
  });

  it("untyped branch resolves by exact slug and never self-heals", () => {
    const reg = new EntityRegistry();
    reg.register(makeMonster("srd-2024_monster_x"));

    expect(
      resolveCompendiumRef(reg, { entityType: null, slug: "srd-2024_monster_x" }),
    ).toBeDefined();
    // A 2-part slug in the untyped branch must NOT be rewritten -> stays a miss.
    expect(
      resolveCompendiumRef(reg, { entityType: null, slug: "srd-2024_x" }),
    ).toBeUndefined();
  });

  it("untyped branch calls getBySlug only (never getByTypeAndSlug)", () => {
    const calls: string[] = [];
    const spy = {
      getBySlug: (s: string) => {
        calls.push(`bySlug:${s}`);
        return { slug: s };
      },
      getByTypeAndSlug: (t: string, s: string) => {
        calls.push(`byType:${t}:${s}`);
        return undefined;
      },
    };

    resolveCompendiumRef(spy, { slug: "goblin" });

    expect(calls).toEqual(["bySlug:goblin"]);
  });

  it("typed self-heal retries getByTypeAndSlug with the rewritten 3-part slug", () => {
    const calls: string[] = [];
    const spy = {
      getBySlug: (s: string) => {
        calls.push(`bySlug:${s}`);
        return undefined;
      },
      getByTypeAndSlug: (t: string, s: string) => {
        calls.push(`byType:${t}:${s}`);
        return s === "srd-2024_monster_x" ? { slug: s } : undefined;
      },
    };

    const ent = resolveCompendiumRef(spy, { entityType: "monster", slug: "srd-2024_x" });

    expect(ent).toEqual({ slug: "srd-2024_monster_x" });
    expect(calls).toEqual([
      "byType:monster:srd-2024_x",
      "byType:monster:srd-2024_monster_x",
    ]);
  });
});
