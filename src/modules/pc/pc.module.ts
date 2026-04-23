import type { App, TFile, WorkspaceLeaf } from "obsidian";
import type { ArchivistModule, CoreAPI, ParseResult } from "../../core/module-api";
import type { Character } from "./pc.types";
import { parsePC } from "./pc.parser";
import { PCResolver } from "./pc.resolver";
import { ComponentRegistry } from "./components/component-registry";
import { HeaderSection } from "./components/header-section";
import { AbilityRow } from "./components/ability-row";
import { CombatStatsRow } from "./components/combat-stats-row";
import { SavesPanel } from "./components/saves-panel";
import { SensesPanel } from "./components/senses-panel";
import { SkillsPanel } from "./components/skills-panel";
import { ProficienciesPanel } from "./components/proficiencies-panel";
import { ActionsTab } from "./components/actions-tab";
import { SpellsTab } from "./components/spells-tab";
import { InventoryTab } from "./components/inventory-tab";
import { FeaturesTab } from "./components/features-tab";
import { BackgroundTab } from "./components/background-tab";
import { NotesTab } from "./components/notes-tab";
import { TabsContainer } from "./components/tabs-container";
import { ClassBlock } from "./blocks/class-block";
import { SubclassBlock } from "./blocks/subclass-block";
import { RaceBlock } from "./blocks/race-block";
import { BackgroundBlock } from "./blocks/background-block";
import { FeatBlock } from "./blocks/feat-block";
import { PCSheetView, VIEW_TYPE_PC } from "./pc.view";

interface HostPlugin {
  registerView: (type: string, factory: (leaf: WorkspaceLeaf) => PCSheetView) => void;
  registerEvent: (ev: unknown) => void;
  app: App & {
    workspace: {
      on: (name: string, cb: (file: TFile | null) => void) => unknown;
      getLeaf: (f: TFile | null) => WorkspaceLeaf;
    };
    metadataCache: {
      getFileCache: (file: TFile) => { frontmatter?: Record<string, unknown> } | null;
    };
  };
  settings: { playerCharactersFolder?: string };
}

export class PCModule implements ArchivistModule {
  readonly id = "pc";
  readonly codeBlockType = "pc";
  readonly entityType = "pc";

  core: CoreAPI | null = null;
  registry: ComponentRegistry = new ComponentRegistry();
  resolver: PCResolver | null = null;

  register(core: CoreAPI): void {
    this.core = core;
    this.resolver = new PCResolver(core.entities);
    this.wireComponents();

    const plugin = core.plugin as HostPlugin | null;
    if (!plugin?.registerView || !plugin?.registerEvent) return;

    plugin.registerView(VIEW_TYPE_PC, (leaf) => new PCSheetView(leaf, this));

    plugin.registerEvent(
      plugin.app.workspace.on("file-open", (file) => {
        void this.handleFileOpen(file, plugin);
      }),
    );
  }

  parseYaml(source: string): ParseResult<Character> {
    return parsePC(source);
  }

  isInPCFolder(filePath: string, configured: string | undefined): boolean {
    const folder = (configured ?? "PlayerCharacters").replace(/^\/+|\/+$/g, "");
    if (!folder) return true;
    return filePath === folder || filePath.startsWith(`${folder}/`);
  }

  private async handleFileOpen(file: TFile | null, plugin: HostPlugin): Promise<void> {
    if (!file || file.extension !== "md") return;
    if (!this.isInPCFolder(file.path, plugin.settings?.playerCharactersFolder)) return;
    const cache = plugin.app.metadataCache.getFileCache(file);
    if (cache?.frontmatter?.["archivist-type"] !== "pc") return;
    const leaf = plugin.app.workspace.getLeaf(file);
    const view = (leaf as unknown as { view?: { getViewType: () => string } }).view;
    if (view?.getViewType?.() === VIEW_TYPE_PC) return;
    await leaf.setViewState({ type: VIEW_TYPE_PC, state: { file: file.path }, active: true });
  }

  private wireComponents(): void {
    const r = this.registry;
    r.register(new HeaderSection());
    r.register(new AbilityRow());
    r.register(new CombatStatsRow());
    r.register(new SavesPanel());
    r.register(new SensesPanel());
    r.register(new SkillsPanel());
    r.register(new ProficienciesPanel());
    r.register(new ClassBlock());
    r.register(new SubclassBlock());
    r.register(new RaceBlock());
    r.register(new BackgroundBlock());
    r.register(new FeatBlock());
    r.register(new ActionsTab());
    r.register(new SpellsTab());
    r.register(new InventoryTab());
    r.register(new FeaturesTab(r));
    r.register(new BackgroundTab(r));
    r.register(new NotesTab());
    r.register(new TabsContainer(r));
  }
}

export const pcModule: ArchivistModule = new PCModule();
