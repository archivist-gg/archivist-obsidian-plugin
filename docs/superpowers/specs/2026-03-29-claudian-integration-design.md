# Claudian Chat Engine Integration into Archivist

## Goal

Replace the current Archivist Inquiry chat implementation with Claudian's mature chat engine (forked from [YishenTu/claudian](https://github.com/YishenTu/claudian) v1.3.72, MIT license), gaining all of Claudian's features: comprehensive slash commands (SDK skills), rich @ mentions (vault files, folders, MCP servers, agents, external contexts), MCP support, custom agents/subagents, plan mode, inline edit, security modes (YOLO/Safe/Plan), i18n (10 languages), session management with tabs, vision support, and auto-generated conversation titles. Then layer D&D-specific features on top.

## Scope

**Phase 1 (this spec):** Integrate Claudian chat engine, preserve all Archivist non-chat features, add D&D integration points.

**Phase 2 (future spec):** Dice system (3d-dice/dice-box), entity document format overhaul (code fence blocks), file naming convention changes, editor `[[` autocomplete.

---

## 0. Prerequisites

### GitHub CLI

`gh` CLI must be installed and authenticated (`brew install gh && gh auth login`). Used to clone and manage the Claudian fork.

### Claudian Source Acquisition

Clone the Claudian repo source (not the compiled plugin) into the Archivist project:

```bash
gh repo clone YishenTu/claudian /tmp/claudian-source
```

Copy `src/` contents into `src/inquiry/` within the Archivist project. Copy Claudian's test files into `tests/inquiry/`. Copy Claudian's build config files for reference.

---

## 1. Integration Architecture

### Directory Structure

```
src/
  main.ts                          # Archivist plugin entry (MODIFIED - initializes InquiryModule)
  inquiry/                         # Claudian's full src/ copied here
    core/
      agent/                       # ClaudianService, SessionManager, MessageChannel, QueryOptionsBuilder
      agents/                      # AgentManager, AgentStorage
      commands/                    # builtInCommands (/clear, /add-dir, /resume, /fork)
      hooks/                      # SecurityHooks, SubagentHooks
      mcp/                        # McpServerManager, McpTester
      plugins/                    # PluginManager (Claude Code plugin discovery)
      prompts/                    # mainAgent, inlineEdit, instructionRefine, titleGeneration
      sdk/                        # transformSDKMessage, typeGuards, toolResultContent
      security/                   # ApprovalManager, BashPathValidator, BlocklistChecker
      storage/                    # StorageService, SessionStorage, McpStorage, etc.
      tools/                      # toolNames, toolIcons, toolInput, todo
      types/                      # agent, chat, diff, mcp, models, plugins, sdk, settings, tools
    features/
      chat/                       # ClaudianView, controllers, rendering, services, state, tabs, ui
      inline-edit/                # InlineEditService, InlineEditModal
      settings/                   # ClaudianSettings, McpSettingsManager, AgentSettings, etc.
    shared/
      components/                 # SelectableDropdown, SlashCommandDropdown, ResumeSessionDropdown
      mention/                    # MentionDropdownController, VaultMentionCache, VaultMentionDataProvider
      modals/                     # ConfirmModal, ForkTargetModal, InstructionConfirmModal
      icons.ts
    i18n/                         # 10 locales (en, de, es, fr, ja, ko, pt, ru, zh-CN, zh-TW)
    style/                        # Modular CSS (~30 files)
    utils/                        # ~30 utility modules
  ai/                             # KEEP - Archivist D&D AI layer
    srd/srd-store.ts
    tools/                        # D&D generation tools (added to Claudian's tool system)
    schemas/
    validation/
    system-prompt.ts              # D&D system prompt additions
  entities/                       # KEEP - Entity persistence
    entity-registry.ts
    entity-vault-store.ts
    entity-importer.ts
  renderers/                      # KEEP - D&D stat block renderers
    monster-renderer.ts
    spell-renderer.ts
    item-renderer.ts
    renderer-utils.ts
  parsers/                        # KEEP - YAML parsers
    monster-parser.ts
    spell-parser.ts
    item-parser.ts
    inline-tag-parser.ts
    yaml-utils.ts
  types/                          # KEEP - D&D type definitions
    monster.ts, spell.ts, item.ts, encounter.ts, npc.ts, settings.ts
  modals/                         # KEEP - Monster/Spell/Item insertion modals
  extensions/                     # KEEP - CodeMirror inline tag extension
  settings/                       # MODIFIED - Merge Claudian settings as sub-section
  srd/data/                       # KEEP - Bundled SRD JSON (~2MB)
tests/
  inquiry/                        # Claudian's tests copied here
    unit/
    integration/
    __mocks__/
  srd-store.test.ts              # KEEP
  entity-vault-store.test.ts     # KEEP
  entity-registry.test.ts        # KEEP
```

### InquiryModule Pattern

Claudian's `main.ts` exports a `ClaudianPlugin extends Plugin` class. We cannot have two Plugin classes. Instead:

1. Extract Claudian's initialization logic from `ClaudianPlugin.onload()` into an `InquiryModule` class
2. `InquiryModule` receives the Archivist plugin instance and uses it for all Obsidian API calls (registerView, addCommand, addRibbonIcon, etc.)
3. `InquiryModule` owns: StorageService, McpServerManager, PluginManager, AgentManager, ClaudeCliResolver, conversations, settings (Claudian-specific)
4. Archivist's `main.ts` creates and initializes `InquiryModule` alongside its own D&D features

```typescript
// src/inquiry/InquiryModule.ts (adapted from Claudian's main.ts)
export class InquiryModule {
  settings: ClaudianSettings;
  mcpManager: McpServerManager;
  pluginManager: PluginManager;
  agentManager: AgentManager;
  storage: StorageService;
  cliResolver: ClaudeCliResolver;

  constructor(private plugin: Plugin, private app: App) {}

  async init(): Promise<void> {
    // All of Claudian's onload() logic, but using this.plugin for Obsidian API
    await this.loadSettings();
    this.cliResolver = new ClaudeCliResolver();
    this.mcpManager = new McpServerManager(this.storage.mcp);
    await this.mcpManager.loadServers();
    // ... etc.
    this.plugin.registerView(VIEW_TYPE_INQUIRY, (leaf) => new ClaudianView(leaf, this));
    this.plugin.addCommand({ id: 'open-inquiry', name: 'Open Archivist Inquiry', ... });
    this.plugin.addCommand({ id: 'inline-edit', name: 'Inline edit', ... });
    // ... all other commands
  }

  async destroy(): Promise<void> {
    // Claudian's onunload() logic
  }

  // All public methods from ClaudianPlugin that ClaudianView and other components need
}
```

### Archivist main.ts Changes

```typescript
// src/main.ts
export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings;
  inquiry: InquiryModule;        // Claudian chat engine
  entityRegistry: EntityRegistry;
  private srdStore: SrdStore;

  async onload() {
    await this.loadSettings();

    // Initialize D&D features (SRD, entities, renderers)
    this.srdStore = new SrdStore();
    this.srdStore.loadFromBundledJson();
    this.entityRegistry = new EntityRegistry();
    // ... populate registry from SRD ...

    // Initialize Claudian chat engine
    this.inquiry = new InquiryModule(this, this.app);
    await this.inquiry.init();

    // Register D&D-specific views, commands, code block processors
    this.registerCodeBlockProcessors();
    this.registerDndCommands();
    this.registerMarkdownPostProcessor();
    this.registerEditorExtension([inlineTagPlugin]);
    this.addSettingTab(new ArchivistSettingTab(this.app, this));

    // First-load SRD import
    this.triggerSrdImport();
  }

  async onunload() {
    await this.inquiry.destroy();
  }
}
```

### View Type Renaming

Claudian uses `VIEW_TYPE_CLAUDIAN = 'claudian-view'`. We rename this to `VIEW_TYPE_INQUIRY = 'archivist-inquiry'` to match the existing Archivist view type. This is a find-and-replace across all Claudian source files.

### CSS Namespace

Claudian uses `claudian-` CSS prefix throughout. We keep this prefix as-is to avoid massive find-and-replace and to make future upstream cherry-picks easier. Archivist's own styles use `archivist-` prefix. No conflicts.

---

## 2. D&D Integration Points

### 2.1 Entity Block Rendering in Chat

Claudian's `MessageRenderer` renders tool results as collapsible blocks showing the tool name, status, and raw result text. We extend this to detect D&D entity tool results and render styled stat blocks.

**Hook point:** `ToolCallRenderer.ts` -- when rendering a tool result for `generate_monster`, `generate_spell`, or `generate_item`, instead of showing raw text, parse the YAML result through the existing Archivist parsers and render using `renderMonsterBlock()`, `renderSpellBlock()`, or `renderItemBlock()`.

**Implementation:**
- Create `src/inquiry/features/chat/rendering/DndEntityRenderer.ts`
- Exports `renderDndEntityToolResult(containerEl, toolCall, callbacks)`
- Detects tool name (`generate_monster`, `generate_spell`, `generate_item`)
- Parses YAML result via `parseMonster()` / `parseSpell()` / `parseItem()`
- Calls existing renderer to create styled stat block DOM
- Adds source badge (top-right, absolute positioned): "AI" badge with sparkles icon
- Adds "Copy & Save" button below the block
- `ToolCallRenderer.ts` checks if tool name matches a D&D entity tool; if so, delegates to `DndEntityRenderer`

**Source Badge Positioning** (matching Claudian's original Archivist app):
```css
.archivist-entity-source-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  color: rgba(0, 0, 0, 0.4);
  background: transparent;
  border: none;
}
```

Badge types:
- "SRD" with book-open icon (for SRD entities)
- "Custom" with pen-tool icon (for user-saved entities)
- "AI" with sparkles icon (for freshly generated, unsaved entities)

Badges appear on entity blocks everywhere: in chat, in vault note preview (via code block processor), in autocomplete preview.

### 2.2 D&D System Prompt Extension

Claudian's system prompt is built in `core/prompts/mainAgent.ts`. We extend it with D&D context.

**Hook point:** The `mainAgent.ts` prompt builder accepts context parameters. We add a D&D context section that includes:
- D&D persona instructions (scholarly owl assistant for D&D 5e)
- Available D&D tools description
- Entity context from `[[type:name]]` references (YAML in `<entity-context>` tags)
- Current note context (if TTRPG-relevant)

**Implementation:**
- Create `src/inquiry/core/prompts/dndContext.ts`
- Exports `buildDndSystemPromptSection(ctx: DndPromptContext): string`
- Called from `mainAgent.ts` prompt builder, appended after the base prompt
- `DndPromptContext` includes: ttrpgRootDir, entityContext, currentNoteContent, selectedText

### 2.3 D&D Tools Registration

Claudian's tool system works through the Claude Agent SDK -- tools are defined by the Claude CLI/SDK, not by the plugin. The plugin doesn't register tools directly; instead, the system prompt instructs the AI about available capabilities, and the SDK provides the tools.

For D&D tools, we add them to the system prompt as available capabilities:
- `generate_monster` -- Generate a D&D 5e monster stat block (output as YAML in a ```monster code fence)
- `generate_spell` -- Generate a D&D 5e spell (output as YAML in a ```spell code fence)
- `generate_item` -- Generate a D&D 5e magic item (output as YAML in a ```item code fence)
- `generate_encounter` -- Generate a combat encounter
- `generate_npc` -- Generate an NPC profile
- `search_srd` -- Search SRD content by name and type

The AI outputs entity data as YAML code fences (```monster, ```spell, ```item). The message renderer detects these code fences in assistant text responses and renders them as styled stat blocks.

### 2.4 `[[` Entity Autocomplete in Chat

Port the existing entity autocomplete concept into Claudian's chat input system.

**Hook point:** Claudian's `InputController` manages the textarea and instantiates `MentionDropdownController` (for `@`) and `SlashCommandDropdown` (for `/`). We add an `EntityAutocomplete` dropdown (for `[[`).

**Implementation:**
- Create `src/inquiry/shared/components/EntityAutocompleteDropdown.ts`
- Same pattern as `MentionDropdownController` but triggered by `[[` instead of `@`
- Type prefix filtering via PREFIX_MAP: `monster:`, `spell:`, `item:`, `doc:`, `feat:`, `condition:`, `class:`, `background:`
- No prefix shows all entities + vault files
- Results show: type icon + name + source badge (SRD/Custom/Doc)
- On selection: inserts `[[type:Name]]` into textarea, tracks entity for context injection
- Max 20 results, 200ms debounce, keyboard navigation (arrows, Enter/Tab, Escape)
- Positioned above textarea (same as `@` and `/` dropdowns)

**Entity Context Injection:**
When a message containing `[[type:name]]` references is sent:
1. Regex scans for `[[type:name]]` patterns
2. Each match is resolved via EntityRegistry
3. Entity data serialized as YAML, wrapped in `<entity-context>` tags
4. Appended to the D&D system prompt section

### 2.5 D&D Slash Commands

Add D&D-specific commands to Claudian's slash command system. Claudian has two types of slash commands:

1. **Built-in commands** (`core/commands/builtInCommands.ts`) -- perform actions like /clear, /add-dir
2. **SDK skills** -- fetched from the Claude CLI SDK, shown in dropdown

We add D&D commands as built-in commands:

| Command | Description | Action |
|---------|------------|--------|
| `/generate` | Generate a D&D entity (monster, spell, item, encounter, NPC) | Inserts prompt template |
| `/search-srd` | Search SRD content | Opens inline search with results |
| `/roll` | Roll dice notation (text-based, 3D in Phase 2) | Parses notation, shows result |

These are added to `BUILT_IN_COMMANDS` array in `builtInCommands.ts`.

### 2.6 @ Mention Extension for Entities

Claudian's `MentionDropdownController` already supports multiple mention types: vault files, vault folders, MCP servers, agents, external context files. We add entity mentions.

**Implementation:**
- Add `'entity'` to the `MentionItem` type union in `shared/mention/types.ts`
- In `MentionDropdownController.showMentionDropdown()`, after vault files, append matching entities from EntityRegistry
- Entity items show: entity type icon + name + source badge
- On selection: inserts `@EntityName` which attaches entity data as context (same as file attachment but with entity data)

### 2.7 Copy & Save

On D&D entity blocks rendered in chat (Section 2.1), add a "Copy & Save" button:

1. Copies entity YAML to clipboard
2. Saves as vault note at `{compendiumRoot}/{userEntityFolder}/{TypeFolder}/{Name}.md`
3. Generates slug, ensures uniqueness
4. Registers in EntityRegistry
5. Shows Obsidian Notice with file path
6. Button changes to "Saved!" confirmation state for 2 seconds

### 2.8 Code Fence Detection in Assistant Messages

When the AI generates entity data, it outputs YAML in code fences (```monster, ```spell, ```item). Claudian's `MessageRenderer.renderContent()` uses Obsidian's `MarkdownRenderer.renderMarkdown()` which renders code fences as `<pre><code>` blocks.

**Hook point:** After `renderMarkdown()` in `MessageRenderer.renderContent()`, scan rendered `<pre><code>` blocks for D&D code fence languages. If found, replace the raw code block with a styled stat block.

**Implementation:**
- In `MessageRenderer.renderContent()`, after the existing `pre` element wrapping logic, check for `code.language-monster`, `code.language-spell`, `code.language-item`
- For each match: extract YAML text, parse via Archivist parsers, replace `<pre>` with rendered stat block
- Add source badge ("AI") and Copy & Save button
- This reuses the same rendering pipeline as Archivist's existing code block processors

---

## 3. Settings Merge

### Archivist Settings (preserved)

| Setting | Default | Location |
|---------|---------|----------|
| Compendium Root Folder | `Compendium` | Archivist settings section |
| User Entity Folder | `me` | Archivist settings section |
| SRD Imported | `false` | Internal |
| TTRPG Root Directory | `/` | Archivist settings section |

### Claudian Settings (new, from Claudian)

All of Claudian's settings are preserved as-is. Key ones:

| Setting | Default | Location |
|---------|---------|----------|
| Model | `sonnet` | Inquiry settings section |
| Permission Mode | `normal` | Inquiry settings section |
| Max Tabs | `3` | Inquiry settings section |
| Tab Bar Position | `input` | Inquiry settings section |
| Locale | `en` | Inquiry settings section |
| Thinking Budget | `0` | Inquiry settings section |
| Open in Main Tab | `false` | Inquiry settings section |
| Media Folder | (empty) | Inquiry settings section |
| Hidden Slash Commands | `[]` | Inquiry settings section |
| Environment Variables | (empty) | Inquiry settings section |

### Settings Tab Structure

```
Archivist Settings Tab
  D&D Content
    - Compendium Root Folder
    - User Entity Folder
    - TTRPG Root Directory
  Inquiry (Chat)
    - Model selection
    - Permission mode
    - Thinking budget
    - Max tabs
    - Tab bar position
    - Open in main tab vs sidebar
    - Locale
    - Media folder
    - Environment variables
  MCP Servers (Claudian's MCP settings UI)
  Custom Agents (Claudian's agent settings UI)
  Slash Commands (Claudian's command settings UI)
  Plugins (Claudian's plugin settings UI)
```

Claudian has its own `ClaudianSettingTab` with sub-managers (McpSettingsManager, AgentSettings, SlashCommandSettings, PluginSettingsManager). These are instantiated as sections within Archivist's single settings tab.

---

## 4. Build System Changes

### Dependencies

Add Claudian's runtime dependencies to Archivist's `package.json`:

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.76",
    "@modelcontextprotocol/sdk": "~1.25.3",
    "tslib": "^2.8.1"
  }
}
```

Archivist already uses `@anthropic-ai/claude-agent-sdk`. The `@modelcontextprotocol/sdk` and `tslib` are new additions.

### CSS Build

Claudian uses a CSS build script (`scripts/build-css.mjs`) that concatenates its modular CSS files into a single `styles.css`. We adopt this approach:

- Claudian's modular CSS files (~30 files in `src/inquiry/style/`) are concatenated into a single block
- Archivist's D&D-specific CSS (entity blocks, inline tags, modals) is concatenated separately
- Both are combined into the final `styles.css`
- Adopt Claudian's `build-css.mjs` script, modified to include both sources

### esbuild Config

Merge Claudian's esbuild config with Archivist's. Key considerations:
- Entry point remains `src/main.ts` (Archivist's)
- External: `obsidian`, `electron`, `@anthropic-ai/claude-agent-sdk`, `@modelcontextprotocol/sdk`
- SRD JSON files bundled as before (imported in source, included by esbuild)
- Claudian's i18n JSON files bundled the same way

---

## 5. What Gets Deleted

### Files Removed (current Archivist Inquiry implementation)

| File | Reason |
|------|--------|
| `src/ui/inquiry-view.ts` | Replaced by Claudian's ClaudianView |
| `src/ui/components/chat-input.ts` | Replaced by Claudian's InputController |
| `src/ui/components/chat-messages.ts` | Replaced by Claudian's MessageRenderer |
| `src/ui/components/chat-header.ts` | Replaced by Claudian's header in ClaudianView |
| `src/ui/components/chat-tabs.ts` | Replaced by Claudian's TabManager/TabBar |
| `src/ui/components/message-renderer.ts` | Replaced by Claudian's MessageRenderer + DndEntityRenderer |
| `src/ui/components/mention-dropdown.ts` | Replaced by Claudian's MentionDropdownController |
| `src/ui/components/slash-commands.ts` | Replaced by Claudian's SlashCommandDropdown |
| `src/ui/components/entity-autocomplete.ts` | Replaced by EntityAutocompleteDropdown in Claudian |
| `src/ai/agent-service.ts` | Replaced by Claudian's ClaudianService |
| `src/ai/conversation-manager.ts` | Replaced by Claudian's SessionStorage + ConversationController |

### CSS Classes Removed

All `archivist-inquiry-*` CSS classes related to the old chat UI. Replaced by Claudian's `claudian-*` classes.

---

## 6. What Gets Preserved (Archivist D&D Features)

These files remain unchanged or receive minor modifications:

| Feature Area | Files | Status |
|---|---|---|
| Monster block renderer | `src/renderers/monster-renderer.ts` | Unchanged |
| Spell block renderer | `src/renderers/spell-renderer.ts` | Unchanged |
| Item block renderer | `src/renderers/item-renderer.ts` | Unchanged |
| Renderer utilities | `src/renderers/renderer-utils.ts` | Unchanged |
| Monster parser | `src/parsers/monster-parser.ts` | Unchanged |
| Spell parser | `src/parsers/spell-parser.ts` | Unchanged |
| Item parser | `src/parsers/item-parser.ts` | Unchanged |
| Inline tag parser | `src/parsers/inline-tag-parser.ts` | Unchanged |
| YAML utilities | `src/parsers/yaml-utils.ts` | Unchanged |
| SRD store | `src/ai/srd/srd-store.ts` | Unchanged |
| SRD JSON data | `src/srd/data/*.json` | Unchanged |
| Entity registry | `src/entities/entity-registry.ts` | Unchanged |
| Entity vault store | `src/entities/entity-vault-store.ts` | Unchanged |
| Entity importer | `src/entities/entity-importer.ts` | Unchanged |
| D&D type definitions | `src/types/monster.ts`, `spell.ts`, etc. | Unchanged |
| Monster modal | `src/modals/monster-modal.ts` | Unchanged |
| Spell modal | `src/modals/spell-modal.ts` | Unchanged |
| Item modal | `src/modals/item-modal.ts` | Unchanged |
| Inline tag extension | `src/extensions/inline-tag-extension.ts` | Unchanged |
| Inline tag renderer | `src/renderers/inline-tag-renderer.ts` | Unchanged |
| D&D system prompt | `src/ai/system-prompt.ts` | Modified (integrated into Claudian's prompt builder) |
| Entity validation | `src/ai/validation/*` | Unchanged |
| Entity schemas | `src/ai/schemas/*` | Unchanged |

---

## 7. Import Path Updates

All Claudian source files use relative imports within the Claudian directory structure. Since we're copying `src/` to `src/inquiry/`, internal imports within `src/inquiry/` remain valid.

Cross-boundary imports (Claudian code referencing Archivist D&D code):
- `DndEntityRenderer` imports from `../../../renderers/` and `../../../parsers/`
- `EntityAutocompleteDropdown` imports from `../../../entities/entity-registry`
- `dndContext.ts` imports from `../../../ai/system-prompt`
- `InquiryModule` receives EntityRegistry and SrdStore as constructor parameters (dependency injection, no direct imports)

---

## 8. File Map Summary

### New Files (D&D integration layer)

| File | Responsibility |
|------|---------------|
| `src/inquiry/InquiryModule.ts` | Adapted Claudian plugin class as module |
| `src/inquiry/features/chat/rendering/DndEntityRenderer.ts` | D&D entity stat block rendering in chat |
| `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` | `[[` autocomplete for entities |
| `src/inquiry/core/prompts/dndContext.ts` | D&D system prompt section builder |

### Modified Files (Claudian files with D&D additions)

| File | Changes |
|------|---------|
| `src/inquiry/core/commands/builtInCommands.ts` | Add /generate, /search-srd, /roll |
| `src/inquiry/core/prompts/mainAgent.ts` | Import and append dndContext |
| `src/inquiry/features/chat/rendering/ToolCallRenderer.ts` | Delegate D&D tool results to DndEntityRenderer |
| `src/inquiry/features/chat/rendering/MessageRenderer.ts` | Detect D&D code fences after markdown rendering |
| `src/inquiry/features/chat/controllers/InputController.ts` | Instantiate EntityAutocompleteDropdown |
| `src/inquiry/shared/mention/types.ts` | Add entity MentionItem type |
| `src/inquiry/shared/mention/MentionDropdownController.ts` | Add entity search results |
| `src/inquiry/core/types/settings.ts` | Rename VIEW_TYPE constant |

### Modified Files (Archivist core)

| File | Changes |
|------|---------|
| `src/main.ts` | Replace old Inquiry init with InquiryModule |
| `src/settings/settings-tab.ts` | Merge Claudian settings as sub-sections |
| `src/types/settings.ts` | Add Claudian settings reference |
| `styles.css` | Merge Claudian CSS + D&D entity styles |
| `package.json` | Add @modelcontextprotocol/sdk, tslib dependencies |
| `esbuild.config.mjs` | Update for new source structure |
| `tsconfig.json` | Update include paths |

### Deleted Files

| File | Replaced By |
|------|------------|
| `src/ui/inquiry-view.ts` | `src/inquiry/features/chat/ClaudianView.ts` |
| `src/ui/components/chat-input.ts` | `src/inquiry/features/chat/controllers/InputController.ts` |
| `src/ui/components/chat-messages.ts` | `src/inquiry/features/chat/rendering/MessageRenderer.ts` |
| `src/ui/components/chat-header.ts` | ClaudianView header |
| `src/ui/components/chat-tabs.ts` | `src/inquiry/features/chat/tabs/TabManager.ts` |
| `src/ui/components/message-renderer.ts` | `src/inquiry/features/chat/rendering/MessageRenderer.ts` |
| `src/ui/components/mention-dropdown.ts` | `src/inquiry/shared/mention/MentionDropdownController.ts` |
| `src/ui/components/slash-commands.ts` | `src/inquiry/shared/components/SlashCommandDropdown.ts` |
| `src/ui/components/entity-autocomplete.ts` | `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` |
| `src/ai/agent-service.ts` | `src/inquiry/core/agent/ClaudianService.ts` |
| `src/ai/conversation-manager.ts` | `src/inquiry/core/storage/SessionStorage.ts` |

---

## 9. Branding Changes

### View and Display Text

| Claudian Original | Archivist Replacement |
|---|---|
| `VIEW_TYPE_CLAUDIAN = 'claudian-view'` | `VIEW_TYPE_INQUIRY = 'archivist-inquiry'` |
| `getDisplayText() = 'Claudian'` | `getDisplayText() = 'Archivist Inquiry'` |
| Ribbon icon tooltip: "Open Claudian" | "Open Archivist Inquiry" |
| Settings tab name: "Claudian" | Part of "Archivist" settings tab |
| Welcome greeting references to "Claudian" | References to "Archivist" |

### CSS Prefix

Keep `claudian-` prefix in all CSS classes. This avoids a massive find-and-replace and makes future upstream cherry-picks easier. Archivist's own D&D styles use `archivist-` prefix. No conflicts.

---

## 10. Migration

### Existing Conversations

Users of the current Archivist plugin will lose their existing chat history since the conversation storage format changes completely (Claudian uses SDK sessions, not the custom ConversationManager). This is acceptable for a major version bump.

### Settings

Existing Archivist settings (compendiumRoot, userEntityFolder, srdImported, ttrpgRootDir) are preserved. New Claudian settings get their defaults. No migration needed for D&D settings.

### SRD Data

Already imported SRD vault notes are preserved. The `srdImported` flag prevents re-import.
