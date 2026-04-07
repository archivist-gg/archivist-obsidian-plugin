// ---------------------------------------------------------------------------
// RegisteredEntity
// ---------------------------------------------------------------------------

export interface RegisteredEntity {
  slug: string;
  name: string;
  entityType: string;
  filePath: string; // vault-relative path
  data: Record<string, unknown>;
  compendium: string; // e.g., "SRD", "Homebrew"
  readonly: boolean; // from compendium metadata
  homebrew: boolean; // from compendium metadata
}

// ---------------------------------------------------------------------------
// EntityRegistry
// ---------------------------------------------------------------------------

/**
 * Unified registry that merges SRD and user-saved entities into a single
 * searchable collection. Backed by two maps for O(1) slug lookup and
 * efficient type-scoped operations.
 */
export class EntityRegistry {
  private bySlug = new Map<string, RegisteredEntity>();
  private byType = new Map<string, RegisteredEntity[]>();

  /**
   * Register (or replace) an entity. If an entity with the same slug
   * already exists it is replaced in both maps.
   */
  register(entity: RegisteredEntity): void {
    const existing = this.bySlug.get(entity.slug);

    // Remove from old type bucket if replacing and type changed
    if (existing && existing.entityType !== entity.entityType) {
      const oldBucket = this.byType.get(existing.entityType);
      if (oldBucket) {
        const idx = oldBucket.findIndex((e) => e.slug === entity.slug);
        if (idx !== -1) oldBucket.splice(idx, 1);
        if (oldBucket.length === 0) this.byType.delete(existing.entityType);
      }
    }

    this.bySlug.set(entity.slug, entity);

    // Upsert into type bucket
    const bucket = this.byType.get(entity.entityType);
    if (bucket) {
      const idx = bucket.findIndex((e) => e.slug === entity.slug);
      if (idx !== -1) {
        bucket[idx] = entity;
      } else {
        bucket.push(entity);
      }
    } else {
      this.byType.set(entity.entityType, [entity]);
    }
  }

  /**
   * Remove an entity by slug. No-op if slug is not registered.
   */
  unregister(slug: string): void {
    const existing = this.bySlug.get(slug);
    if (!existing) return;

    this.bySlug.delete(slug);

    const bucket = this.byType.get(existing.entityType);
    if (bucket) {
      const idx = bucket.findIndex((e) => e.slug === slug);
      if (idx !== -1) bucket.splice(idx, 1);
      if (bucket.length === 0) this.byType.delete(existing.entityType);
    }
  }

  /**
   * O(1) lookup by slug.
   */
  getBySlug(slug: string): RegisteredEntity | undefined {
    return this.bySlug.get(slug);
  }

  /**
   * Ranked search: exact name match > starts-with > contains.
   * Case-insensitive. Optionally filtered by entityType.
   */
  search(
    query: string,
    entityType?: string,
    limit = 20,
  ): RegisteredEntity[] {
    const q = query.toLowerCase();
    const pool = entityType
      ? (this.byType.get(entityType) ?? [])
      : Array.from(this.bySlug.values());

    const matches = pool
      .filter((e) => e.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        // Exact matches first
        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;

        // Prefix matches second
        if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
        if (bName.startsWith(q) && !aName.startsWith(q)) return 1;

        // Alphabetical tiebreak
        return aName.localeCompare(bName);
      });

    return matches.slice(0, limit);
  }

  /**
   * Return all registered entity type strings.
   */
  getTypes(): string[] {
    return Array.from(this.byType.keys());
  }

  /**
   * Return all registered slugs.
   */
  getAllSlugs(): Set<string> {
    return new Set(this.bySlug.keys());
  }

  /**
   * Total number of registered entities.
   */
  count(): number {
    return this.bySlug.size;
  }

  /**
   * Remove all entries from the registry.
   */
  clear(): void {
    this.bySlug.clear();
    this.byType.clear();
  }
}
