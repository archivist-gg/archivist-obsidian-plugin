import { EntityRegistry, type RegisteredEntity } from "../../../src/shared/entities/entity-registry";

export function buildMockRegistry(
  entries: Array<Partial<RegisteredEntity> & { slug: string; entityType: string; data: unknown }>,
): EntityRegistry {
  const reg = new EntityRegistry();
  for (const e of entries) {
    reg.register({
      slug: e.slug,
      name: e.name ?? e.slug,
      entityType: e.entityType,
      filePath: e.filePath ?? `mock/${e.slug}.md`,
      data: e.data as Record<string, unknown>,
      compendium: e.compendium ?? "Mock",
      readonly: e.readonly ?? false,
      homebrew: e.homebrew ?? false,
    });
  }
  return reg;
}
