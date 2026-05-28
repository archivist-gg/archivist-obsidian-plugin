import type { SheetComponent } from "./component.types";

export class ComponentRegistry {
  private byType = new Map<string, SheetComponent>();

  register(component: SheetComponent): void {
    if (this.byType.has(component.type)) {
      throw new Error(`Duplicate component type: ${component.type}`);
    }
    this.byType.set(component.type, component);
  }

  get(type: string): SheetComponent | undefined {
    return this.byType.get(type);
  }

  has(type: string): boolean {
    return this.byType.has(type);
  }

  size(): number {
    return this.byType.size;
  }
}
