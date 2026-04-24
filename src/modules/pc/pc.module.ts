import { WorkspaceLeaf } from "obsidian";
import type { App, ViewState } from "obsidian";
import { around } from "monkey-around";
import type { ArchivistModule, CoreAPI, ParseResult } from "../../core/module-api";
import type { Character } from "./pc.types";
import { parsePC } from "./pc.parser";
import { PCResolver } from "./pc.resolver";
import { ComponentRegistry } from "./components/component-registry";
import { HeaderSection } from "./components/header-section";
import { AcShield } from "./components/ac-shield";
import { HpWidget } from "./components/hp-widget";
import { HitDiceWidget } from "./components/hit-dice-widget";
import { AbilityRow } from "./components/ability-row";
import { StatsTiles } from "./components/stats-tiles";
import { DefensesConditionsPanel } from "./components/defenses-conditions-panel";
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
  _loaded?: boolean;
  registerView: (type: string, factory: (leaf: WorkspaceLeaf) => PCSheetView) => void;
  register: (cb: () => void) => void;
  app: App & {
    metadataCache: {
      getCache: (path: string) => { frontmatter?: Record<string, unknown> } | null;
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

  // Per-leaf user override: lets "Edit as Markdown" in the PC view keep the leaf
  // on the markdown view type without the interceptor re-swapping it.
  // Keyed by `leaf.id || file.path`, matching the Kanban/Excalidraw pattern.
  fileModes: Record<string, string> = {};

  register(core: CoreAPI): void {
    this.core = core;
    this.resolver = new PCResolver(core.entities);
    this.wireComponents();

    const plugin = core.plugin as HostPlugin | null;
    if (!plugin?.registerView || !plugin?.register) return;

    plugin.registerView(VIEW_TYPE_PC, (leaf) => new PCSheetView(leaf, this));
    this.installViewSwapInterceptor(plugin);
  }

  parseYaml(source: string): ParseResult<Character> {
    return parsePC(source);
  }

  isInPCFolder(filePath: string, configured: string | undefined): boolean {
    const folder = (configured ?? "PlayerCharacters").replace(/^\/+|\/+$/g, "");
    if (!folder) return true;
    return filePath === folder || filePath.startsWith(`${folder}/`);
  }

  shouldRenderAsPC(path: string, plugin: HostPlugin): boolean {
    if (!path.endsWith(".md")) return false;
    if (!this.isInPCFolder(path, plugin.settings?.playerCharactersFolder)) return false;
    const cache = plugin.app.metadataCache.getCache(path);
    return cache?.frontmatter?.["archivist-type"] === "pc";
  }

  /**
   * Rewrite Obsidian's own `leaf.setViewState({ type: "markdown", ... })` call
   * to `{ type: "archivist-pc-sheet", ... }` synchronously, inside Obsidian's
   * openFile flow — so cold start, cmd+click-new-tab, and close+reopen all take
   * the same code path with no race. This is the pattern used by
   * obsidian-kanban and obsidian-excalidraw-plugin; a `file-open` listener +
   * post-hoc `setViewState` cannot work reliably because `file-open` fires
   * mid-flight and any subsequent swap races a variable-length promise chain.
   */
  private installViewSwapInterceptor(plugin: HostPlugin): void {
    // monkey-around factories return plain `function` expressions so they get
    // their own `this` bound by Obsidian to the WorkspaceLeaf; we need a stable
    // alias to the PCModule instance inside those bodies.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const mod = this;
    type SetViewStateFn = (this: WorkspaceLeaf, state: ViewState, ...rest: unknown[]) => Promise<void>;
    type DetachFn = (this: WorkspaceLeaf) => void;
    const uninstaller = around(WorkspaceLeaf.prototype, {
      setViewState(next: SetViewStateFn): SetViewStateFn {
        return function (this: WorkspaceLeaf, state: ViewState, ...rest: unknown[]): Promise<void> {
          const filePath = typeof state?.state?.file === "string" ? state.state.file : undefined;
          const leafId = (this as unknown as { id?: string }).id;
          const modeKey = leafId ?? filePath ?? "";
          // Auto-swap markdown → pc when the file has pc frontmatter, unless the
          // user has explicitly opted out for this leaf (fileModes[key] === "markdown"),
          // which the PC view's "Edit as Markdown" action sets before it calls us.
          if (
            plugin._loaded !== false &&
            state?.type === "markdown" &&
            filePath &&
            mod.fileModes[modeKey] !== "markdown" &&
            mod.shouldRenderAsPC(filePath, plugin)
          ) {
            mod.fileModes[modeKey] = VIEW_TYPE_PC;
            return (next.call(this, { ...state, type: VIEW_TYPE_PC }, ...rest)) as Promise<void>;
          }
          return (next.call(this, state, ...rest)) as Promise<void>;
        };
      },
      detach(next: DetachFn): DetachFn {
        return function (this: WorkspaceLeaf): void {
          const view = (this as unknown as { view?: { getState?: () => { file?: string } } }).view;
          const filePath = view?.getState?.()?.file;
          const leafId = (this as unknown as { id?: string }).id;
          const modeKey = leafId ?? filePath ?? "";
          if (modeKey && mod.fileModes[modeKey]) delete mod.fileModes[modeKey];
          next.call(this);
        };
      },
    });
    plugin.register(uninstaller);
  }

  private wireComponents(): void {
    const r = this.registry;

    // Hero right cluster widgets (HeaderSection delegates to these)
    r.register(new AcShield());
    r.register(new HpWidget());
    r.register(new HitDiceWidget());
    // Hero
    r.register(new HeaderSection(r));
    // Stats band
    r.register(new AbilityRow());
    r.register(new StatsTiles());
    r.register(new DefensesConditionsPanel());
    // Sidebar panels
    r.register(new SensesPanel());
    r.register(new SkillsPanel());
    r.register(new ProficienciesPanel());
    // Blocks
    r.register(new ClassBlock());
    r.register(new SubclassBlock());
    r.register(new RaceBlock());
    r.register(new BackgroundBlock());
    r.register(new FeatBlock());
    // Tabs
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
