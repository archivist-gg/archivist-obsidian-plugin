import type { ArchivistModule } from "./module-api";

export class ModuleRegistry {
  private modules = new Map<string, ArchivistModule>();

  register(module: ArchivistModule): void {
    this.modules.set(module.id, module);
  }

  getById(id: string): ArchivistModule | undefined {
    return this.modules.get(id);
  }

  getByEntityType(type: string): ArchivistModule | undefined {
    for (const mod of this.modules.values()) {
      if (mod.entityType === type) return mod;
    }
    return undefined;
  }

  getByCodeBlockType(type: string): ArchivistModule | undefined {
    for (const mod of this.modules.values()) {
      if (mod.codeBlockType === type) return mod;
    }
    return undefined;
  }

  getAll(): ArchivistModule[] {
    return Array.from(this.modules.values());
  }
}
