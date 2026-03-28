interface SrdEntity {
  name: string;
  [key: string]: unknown;
}

type EntityType = "monster" | "spell" | "item";

export class SrdStore {
  private monsters: SrdEntity[] = [];
  private spells: SrdEntity[] = [];
  private items: SrdEntity[] = [];

  loadFromArrays(monsters: SrdEntity[], spells: SrdEntity[], items: SrdEntity[]): void {
    this.monsters = monsters;
    this.spells = spells;
    this.items = items;
  }

  async loadFromFiles(
    readFile: (path: string) => Promise<string>,
    basePath: string,
  ): Promise<void> {
    const [m, s, i] = await Promise.all([
      readFile(`${basePath}/srd-monsters.json`).then(JSON.parse),
      readFile(`${basePath}/srd-spells.json`).then(JSON.parse),
      readFile(`${basePath}/srd-items.json`).then(JSON.parse),
    ]);
    this.loadFromArrays(m, s, i);
  }

  search(query: string, entityType?: EntityType, limit = 5): SrdEntity[] {
    const q = query.toLowerCase();
    const collections: SrdEntity[] = [];

    if (!entityType || entityType === "monster") collections.push(...this.monsters);
    if (!entityType || entityType === "spell") collections.push(...this.spells);
    if (!entityType || entityType === "item") collections.push(...this.items);

    const matches = collections
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
        // Alphabetical otherwise
        return aName.localeCompare(bName);
      });

    return matches.slice(0, limit);
  }

  getByName(name: string, entityType: EntityType): SrdEntity | null {
    const q = name.toLowerCase();
    let collection: SrdEntity[];

    switch (entityType) {
      case "monster": collection = this.monsters; break;
      case "spell": collection = this.spells; break;
      case "item": collection = this.items; break;
    }

    return collection.find((e) => e.name.toLowerCase() === q) ?? null;
  }
}
