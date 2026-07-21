import type { App, WorkspaceLeaf } from "obsidian";
import type { EntityRegistry } from "@archivist-gg/core";
import type { CompendiumManager } from "../../shared/entities/compendium-manager";
import type { PCSheetView } from "./pc.view";

export interface HostPlugin {
  _loaded?: boolean;
  registerView: (type: string, factory: (leaf: WorkspaceLeaf) => PCSheetView) => void;
  register: (cb: () => void) => void;
  addCommand?: (cmd: { id: string; name: string; callback: () => void | Promise<void> }) => void;
  addRibbonIcon?: (icon: string, title: string, callback: () => void | Promise<void>) => void;
  app: App & {
    metadataCache: {
      getCache: (path: string) => { frontmatter?: Record<string, unknown> } | null;
    };
  };
  settings: { playerCharactersFolder?: string; portraitsFolder?: string };
}

/** The typed service bundle pc receives from the composition root (0f) —
 *  the narrow replacement for the legacy core-API bundle pc used to consume. */
export interface PCServices {
  plugin: HostPlugin;
  entities: EntityRegistry;
  compendiums: CompendiumManager;
}
