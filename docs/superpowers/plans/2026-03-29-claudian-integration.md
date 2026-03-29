# Claudian Chat Engine Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Archivist's custom chat implementation with Claudian's mature chat engine, preserving all D&D features and adding D&D integration points on top.

**Architecture:** Clone Claudian v1.3.72 source into `src/inquiry/`, adapt its Plugin class into an InquiryModule that Archivist's main.ts initializes alongside D&D features. New D&D integration files (DndEntityRenderer, EntityAutocompleteDropdown, dndContext) bridge Claudian's chat with Archivist's entity system.

**Tech Stack:** TypeScript, Obsidian API, @anthropic-ai/claude-agent-sdk, @modelcontextprotocol/sdk, esbuild, vitest/jest

**Spec:** `docs/superpowers/specs/2026-03-29-claudian-integration-design.md`

---

### Task 1: Clone Claudian Source and Copy Into Project

**Files:**
- Create: `src/inquiry/` (entire Claudian src/ tree, ~130 files)
- Create: `tests/inquiry/` (Claudian tests, ~140 files)
- Create: `scripts/build-css.mjs` (from Claudian)

This task copies Claudian's source code into the Archivist project. No tests -- this is a file copy operation.

- [ ] **Step 1: Clone Claudian repo to temp directory**

```bash
gh repo clone YishenTu/claudian /tmp/claudian-source -- --depth 1 --branch main
```

- [ ] **Step 2: Copy Claudian src/ into src/inquiry/**

```bash
mkdir -p src/inquiry
cp -R /tmp/claudian-source/src/* src/inquiry/
```

This copies all of Claudian's source: `core/`, `features/`, `shared/`, `i18n/`, `style/`, `utils/`, and `main.ts`.

- [ ] **Step 3: Copy Claudian tests into tests/inquiry/**

```bash
mkdir -p tests/inquiry
cp -R /tmp/claudian-source/tests/* tests/inquiry/
```

- [ ] **Step 4: Copy Claudian build scripts for reference**

```bash
cp /tmp/claudian-source/scripts/build-css.mjs scripts/build-css.mjs
cp /tmp/claudian-source/esbuild.config.mjs scripts/claudian-esbuild-reference.mjs
cp /tmp/claudian-source/jest.config.js scripts/claudian-jest-reference.js
```

- [ ] **Step 5: Verify file structure**

```bash
ls src/inquiry/core/ src/inquiry/features/ src/inquiry/shared/ src/inquiry/i18n/ src/inquiry/style/ src/inquiry/utils/
```

Expected: All Claudian directories present with their contents.

- [ ] **Step 6: Commit**

```bash
git add src/inquiry/ tests/inquiry/ scripts/build-css.mjs scripts/claudian-esbuild-reference.mjs scripts/claudian-jest-reference.js
git commit -m "chore: copy Claudian v1.3.72 source into src/inquiry/"
```

---

### Task 2: Delete Old Archivist Chat Implementation

**Files:**
- Delete: `src/ui/inquiry-view.ts`
- Delete: `src/ui/components/chat-input.ts`
- Delete: `src/ui/components/chat-messages.ts`
- Delete: `src/ui/components/chat-header.ts`
- Delete: `src/ui/components/chat-tabs.ts`
- Delete: `src/ui/components/message-renderer.ts`
- Delete: `src/ui/components/mention-dropdown.ts`
- Delete: `src/ui/components/slash-commands.ts`
- Delete: `src/ui/components/entity-autocomplete.ts`
- Delete: `src/ui/components/chat-history.ts`
- Delete: `src/ai/agent-service.ts`
- Delete: `src/ai/conversation-manager.ts`

Keeping `src/ui/components/code-block-enhancer.ts` and `src/ui/components/owl-icon.ts` (D&D-specific).

- [ ] **Step 1: Remove old chat UI files**

```bash
rm src/ui/inquiry-view.ts
rm src/ui/components/chat-input.ts src/ui/components/chat-messages.ts src/ui/components/chat-header.ts
rm src/ui/components/chat-tabs.ts src/ui/components/message-renderer.ts src/ui/components/mention-dropdown.ts
rm src/ui/components/slash-commands.ts src/ui/components/entity-autocomplete.ts src/ui/components/chat-history.ts
rm src/ai/agent-service.ts src/ai/conversation-manager.ts
```

- [ ] **Step 2: Verify remaining D&D files still exist**

```bash
ls src/ui/components/code-block-enhancer.ts src/ui/components/owl-icon.ts
ls src/renderers/ src/parsers/ src/entities/ src/modals/ src/extensions/
ls src/ai/srd/ src/ai/system-prompt.ts src/ai/schemas/ src/ai/validation/ src/ai/tools/ src/ai/mcp-server.ts
```

Expected: All D&D files still present.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old Archivist chat implementation (replaced by Claudian)"
```

---

### Task 3: Update Build System

**Files:**
- Modify: `package.json`
- Modify: `esbuild.config.mjs`
- Modify: `tsconfig.json`
- Create: `src/styles/archivist-dnd.css`
- Modify: `scripts/build-css.mjs`

- [ ] **Step 1: Update package.json**

Add `@modelcontextprotocol/sdk` to dependencies. Update scripts. Add jest devDependencies for Claudian tests.

Update `dependencies`:
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.2.76",
    "@modelcontextprotocol/sdk": "~1.25.3",
    "js-yaml": "^4.1.0",
    "tslib": "^2.8.1",
    "zod": "^4.3.6"
  }
}
```

Update `devDependencies` -- add:
```json
{
  "@types/jest": "^30.0.0",
  "jest": "^30.2.0",
  "jest-environment-jsdom": "^30.2.0",
  "ts-jest": "^29.4.6",
  "esbuild": "^0.27.1"
}
```

Update `scripts`:
```json
{
  "scripts": {
    "dev": "npm run build:css && node esbuild.config.mjs",
    "build": "npm run build:css && node esbuild.config.mjs production",
    "build:css": "node scripts/build-css.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install new dependencies**

```bash
npm install
```

Expected: Clean install.

- [ ] **Step 3: Update esbuild.config.mjs**

Replace the current esbuild config with one that includes Claudian's externals and the copy-to-Obsidian plugin from Claudian's config. The key additions are:
- `.env.local` loading for OBSIDIAN_VAULT auto-deploy
- `@lezer/*` externals
- `node:*` built-in prefixes
- Copy-to-Obsidian plugin

Read the Claudian esbuild reference at `scripts/claudian-esbuild-reference.mjs` and merge its features into the existing `esbuild.config.mjs`. Keep the entry point as `src/main.ts` and output as `main.js`. Update the plugin folder name to `archivist-ttrpg-blocks`.

- [ ] **Step 4: Extract D&D CSS from current styles.css into src/styles/archivist-dnd.css**

Create `src/styles/archivist-dnd.css`. Move all non-inquiry CSS from `styles.css` into this file -- everything with `archivist-monster-`, `archivist-spell-`, `archivist-item-`, `archivist-inline-tag-`, `archivist-modal-` prefixes, plus the entity source badge styles and dark mode overrides for these. This is the D&D-specific CSS that Claudian doesn't provide.

- [ ] **Step 5: Modify scripts/build-css.mjs to merge both CSS sources**

Read the Claudian build-css.mjs. It concatenates CSS files listed in `src/inquiry/style/index.css`. Extend it to also read and append `src/styles/archivist-dnd.css` after the Claudian CSS. The output should be a single `styles.css` at the project root.

- [ ] **Step 6: Verify CSS build**

```bash
npm run build:css
```

Expected: `styles.css` created with both Claudian and D&D styles.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json esbuild.config.mjs tsconfig.json scripts/build-css.mjs src/styles/
git commit -m "chore: update build system for Claudian integration"
```

---

### Task 4: Branding -- Rename VIEW_TYPE and Display Text

**Files:**
- Modify: Files in `src/inquiry/` containing VIEW_TYPE value and display text

- [ ] **Step 1: Change VIEW_TYPE constant value**

Find the file in `src/inquiry/core/types/` that defines `VIEW_TYPE_CLAUDIAN`. Change its value from `'claudian-view'` to `'archivist-inquiry'`. Keep the constant name to avoid changing imports.

```bash
grep -r "VIEW_TYPE_CLAUDIAN" src/inquiry/core/types/
```

In the found file, change:
```typescript
export const VIEW_TYPE_CLAUDIAN = 'archivist-inquiry';
```

- [ ] **Step 2: Update display text in ClaudianView.ts**

In `src/inquiry/features/chat/ClaudianView.ts`, change:
```typescript
getDisplayText(): string {
  return 'Archivist Inquiry';
}
```

- [ ] **Step 3: Update user-facing "Claudian" text in i18n**

```bash
grep -r '"Claudian"' src/inquiry/i18n/locales/en.json
```

Replace user-facing "Claudian" with "Archivist" in the English locale. Other locales can be updated later.

- [ ] **Step 4: Commit**

```bash
git add src/inquiry/
git commit -m "chore: rebrand Claudian references to Archivist Inquiry"
```

---

### Task 5: Create InquiryModule (Adapt Claudian's main.ts)

**Files:**
- Create: `src/inquiry/InquiryModule.ts`
- Modify: Multiple files in `src/inquiry/` that import from `../../main`

This is the core adaptation task. Claudian's `ClaudianPlugin extends Plugin` becomes `InquiryModule` that receives a Plugin instance.

- [ ] **Step 1: Create InquiryModule.ts**

Create `src/inquiry/InquiryModule.ts`. Read `src/inquiry/main.ts` (the copied Claudian main.ts) completely. Create a new class `InquiryModule` that:

1. Does NOT extend `Plugin`
2. Takes `Plugin`, `App`, optional `EntityRegistry`, optional `SrdStore` in constructor
3. Has an `async init()` method containing all of Claudian's `onload()` logic
4. Has an `async destroy()` method containing all of Claudian's `onunload()` logic
5. Delegates all Obsidian API calls to the plugin instance:
   - `this.loadData()` becomes `this.plugin.loadData()`
   - `this.saveData(d)` becomes `this.plugin.saveData(d)`
   - `this.registerView(...)` becomes `this.plugin.registerView(...)`
   - `this.addCommand(...)` becomes `this.plugin.addCommand(...)`
   - `this.addRibbonIcon(...)` becomes `this.plugin.addRibbonIcon(...)`
   - `this.registerEvent(...)` becomes `this.plugin.registerEvent(...)`
   - `this.registerDomEvent(...)` becomes `this.plugin.registerDomEvent(...)`
   - `this.addSettingTab(...)` becomes `this.plugin.addSettingTab(...)`
6. Exposes all public fields and methods that ClaudianView and controllers need: `settings`, `mcpManager`, `pluginManager`, `agentManager`, `storage`, `cliResolver`, `app`, plus all conversation management methods
7. Adds D&D fields: `entityRegistry`, `srdStore`
8. Adds a `saveEntityToVault(entityType, data)` method for Copy & Save
9. Changes ribbon tooltip from "Open Claudian" to "Open Archivist Inquiry"

- [ ] **Step 2: Update all files importing ClaudianPlugin from main.ts**

Find all files that import from `../../main`, `../../../main`, etc.:

```bash
grep -rl "from.*['\"].*main['\"]" src/inquiry/ | grep -v node_modules | grep -v main.reference
```

For each file:
- Change `import ... from '../../main'` to `import ... from '../../InquiryModule'`
- Change `ClaudianPlugin` type references to `InquiryModule`
- If the file uses `import type ClaudianPlugin from ...`, change to `import type { InquiryModule } from ...`

Key files to update:
- `src/inquiry/features/chat/ClaudianView.ts`
- `src/inquiry/features/chat/controllers/InputController.ts`
- `src/inquiry/features/chat/tabs/Tab.ts`
- `src/inquiry/features/chat/tabs/TabManager.ts`
- `src/inquiry/features/settings/ClaudianSettings.ts`
- `src/inquiry/features/inline-edit/ui/InlineEditModal.ts`
- `src/inquiry/features/chat/rendering/MessageRenderer.ts`
- Any other file importing from main

- [ ] **Step 3: Rename Claudian's main.ts to avoid conflict**

```bash
mv src/inquiry/main.ts src/inquiry/main.reference.ts
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -50
```

Fix any remaining import/type errors iteratively.

- [ ] **Step 5: Commit**

```bash
git add src/inquiry/
git commit -m "feat: create InquiryModule adapting Claudian plugin as module"
```

---

### Task 6: Update Archivist main.ts to Use InquiryModule

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Rewrite src/main.ts**

Replace the current `src/main.ts`. The new version:
1. Imports from D&D modules (parsers, renderers, modals, extensions, SRD, entities) -- same as before
2. Imports `InquiryModule` from `./inquiry/InquiryModule`
3. Removes all imports from deleted files (inquiry-view, AgentService, ConversationManager)
4. In `onload()`:
   - Loads settings
   - Initializes SRD store and entity registry (same as before)
   - Creates and initializes `InquiryModule`, passing `this`, `this.app`, `entityRegistry`, `srdStore`
   - Registers D&D code block processors (monster, spell, item)
   - Registers inline tag post-processor
   - Registers CodeMirror editor extension
   - Registers D&D commands (insert-monster, insert-spell, insert-item)
   - Adds settings tab
   - Triggers SRD import if needed
   - Loads user entities from vault
5. In `onunload()`: calls `this.inquiry.destroy()`

The code block processors, post-processor, editor extension, D&D commands, SRD import, and user entity loading are identical to the current implementation. The only change is replacing AgentService/ConversationManager/InquiryView init with InquiryModule init.

- [ ] **Step 2: Build and verify**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds (or shows only warnings, not errors).

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire Archivist main.ts to InquiryModule + D&D features"
```

---

### Task 7: Settings Merge

**Files:**
- Modify: `src/settings/settings-tab.ts`
- Modify: `src/types/settings.ts`

- [ ] **Step 1: Simplify ArchivistSettings type**

In `src/types/settings.ts`, remove chat-specific settings (model, permissionMode, maxConversations) since those are now owned by InquiryModule's ClaudianSettings. Keep only D&D settings:

```typescript
export interface ArchivistSettings {
  compendiumRoot: string;
  userEntityFolder: string;
  srdImported: boolean;
  ttrpgRootDir: string;
  externalContextPaths: string[];
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  userEntityFolder: "me",
  srdImported: false,
  ttrpgRootDir: "/",
  externalContextPaths: [],
};
```

- [ ] **Step 2: Simplify settings-tab.ts**

Update `src/settings/settings-tab.ts` to show only D&D content settings. Claudian registers its own settings tab via InquiryModule, so we add a note pointing to it:

```typescript
import { PluginSettingTab, Setting, App } from "obsidian";
import type ArchivistPlugin from "../main";

export class ArchivistSettingTab extends PluginSettingTab {
  plugin: ArchivistPlugin;

  constructor(app: App, plugin: ArchivistPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "D&D Content" });

    new Setting(containerEl)
      .setName("Compendium Root Folder")
      .setDesc("Root folder for entity notes in your vault")
      .addText((text) =>
        text.setPlaceholder("Compendium").setValue(this.plugin.settings.compendiumRoot)
          .onChange(async (value) => { this.plugin.settings.compendiumRoot = value; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("User Entity Folder")
      .setDesc("Subfolder for AI-generated and custom entities")
      .addText((text) =>
        text.setPlaceholder("me").setValue(this.plugin.settings.userEntityFolder)
          .onChange(async (value) => { this.plugin.settings.userEntityFolder = value; await this.plugin.saveSettings(); })
      );

    new Setting(containerEl)
      .setName("TTRPG Root Directory")
      .setDesc("Root directory in vault scoped for TTRPG content")
      .addText((text) =>
        text.setPlaceholder("/").setValue(this.plugin.settings.ttrpgRootDir)
          .onChange(async (value) => { this.plugin.settings.ttrpgRootDir = value; await this.plugin.saveSettings(); })
      );

    containerEl.createEl("h2", { text: "Chat Settings" });
    containerEl.createEl("p", {
      text: "Chat, MCP, agent, and model settings are in the Archivist Inquiry settings tab (registered separately by the chat engine).",
      cls: "setting-item-description",
    });
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/settings.ts src/settings/settings-tab.ts
git commit -m "feat: simplify Archivist settings, delegate chat settings to InquiryModule"
```

---

### Task 8: D&D System Prompt Extension

**Files:**
- Create: `src/inquiry/core/prompts/dndContext.ts`
- Modify: `src/inquiry/core/prompts/mainAgent.ts`
- Test: `tests/dnd-context.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dnd-context.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDndSystemPromptSection } from "../src/inquiry/core/prompts/dndContext";

describe("buildDndSystemPromptSection", () => {
  it("returns empty string when no D&D context provided", () => {
    const result = buildDndSystemPromptSection({});
    expect(result).toBe("");
  });

  it("includes D&D persona when ttrpgRootDir is set", () => {
    const result = buildDndSystemPromptSection({ ttrpgRootDir: "/Campaign" });
    expect(result).toContain("D&D 5e");
    expect(result).toContain("/Campaign");
  });

  it("includes entity context when provided", () => {
    const result = buildDndSystemPromptSection({
      entityContext: '<entity-context type="monster" name="Goblin">name: Goblin</entity-context>',
    });
    expect(result).toContain("entity-context");
    expect(result).toContain("Goblin");
  });

  it("lists generation instructions", () => {
    const result = buildDndSystemPromptSection({ ttrpgRootDir: "/" });
    expect(result).toContain("monster");
    expect(result).toContain("spell");
    expect(result).toContain("item");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dnd-context.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 3: Implement dndContext.ts**

Create `src/inquiry/core/prompts/dndContext.ts`:

```typescript
export interface DndPromptContext {
  ttrpgRootDir?: string;
  entityContext?: string;
  currentNoteContent?: string;
  currentNotePath?: string;
  selectedText?: string;
}

export function buildDndSystemPromptSection(ctx: DndPromptContext): string {
  const parts: string[] = [];

  if (ctx.ttrpgRootDir) {
    parts.push(`## D&D 5e Campaign Assistant

You are also a scholarly assistant for D&D 5e campaign management. Files in \`${ctx.ttrpgRootDir}\` are your primary source of truth for campaign content. Search the vault first before using training knowledge.

When generating D&D entities, output them as YAML inside code fences:
- Monsters: use \`\`\`monster code fence
- Spells: use \`\`\`spell code fence
- Magic Items: use \`\`\`item code fence

These code fences will be rendered as styled stat blocks automatically.`);
  }

  if (ctx.currentNotePath && ctx.currentNoteContent) {
    parts.push(`CONTEXT -- CURRENT NOTE: ${ctx.currentNotePath}\n\`\`\`\n${ctx.currentNoteContent}\n\`\`\``);
  }

  if (ctx.selectedText) {
    parts.push(`CONTEXT -- SELECTED TEXT:\n\`\`\`\n${ctx.selectedText}\n\`\`\``);
  }

  if (ctx.entityContext) {
    parts.push(`The user has referenced the following entities:\n${ctx.entityContext}`);
  }

  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dnd-context.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Hook into mainAgent.ts**

Read `src/inquiry/core/prompts/mainAgent.ts` fully. Find the system prompt builder function. Add a `dndContext?: DndPromptContext` parameter and append the D&D section at the end:

```typescript
import { buildDndSystemPromptSection, type DndPromptContext } from './dndContext';

// In the prompt builder function, add parameter and at the end:
if (dndContext) {
  const dndSection = buildDndSystemPromptSection(dndContext);
  if (dndSection) {
    prompt += '\n\n' + dndSection;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/inquiry/core/prompts/dndContext.ts tests/dnd-context.test.ts src/inquiry/core/prompts/mainAgent.ts
git commit -m "feat: D&D system prompt extension for entity context and persona"
```

---

### Task 9: D&D Entity Renderer for Chat Messages

**Files:**
- Create: `src/inquiry/features/chat/rendering/DndEntityRenderer.ts`
- Modify: `src/inquiry/features/chat/rendering/MessageRenderer.ts`
- Test: `tests/dnd-entity-renderer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/dnd-entity-renderer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { isDndCodeFence, parseDndCodeFence } from "../src/inquiry/features/chat/rendering/DndEntityRenderer";

describe("isDndCodeFence", () => {
  it("detects monster code fence", () => { expect(isDndCodeFence("monster")).toBe(true); });
  it("detects spell code fence", () => { expect(isDndCodeFence("spell")).toBe(true); });
  it("detects item code fence", () => { expect(isDndCodeFence("item")).toBe(true); });
  it("rejects non-D&D languages", () => {
    expect(isDndCodeFence("javascript")).toBe(false);
    expect(isDndCodeFence("")).toBe(false);
  });
});

describe("parseDndCodeFence", () => {
  it("parses monster YAML", () => {
    const yaml = "name: Goblin\nsize: Small\ntype: humanoid";
    const result = parseDndCodeFence("monster", yaml);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("monster");
    expect(result!.name).toBe("Goblin");
  });

  it("parses spell YAML", () => {
    const yaml = "name: Fireball\nlevel: 3\nschool: Evocation";
    const result = parseDndCodeFence("spell", yaml);
    expect(result).not.toBeNull();
    expect(result!.entityType).toBe("spell");
  });

  it("returns null for invalid YAML", () => {
    expect(parseDndCodeFence("monster", "not: valid: yaml: [[[")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dnd-entity-renderer.test.ts`
Expected: FAIL -- module not found.

- [ ] **Step 3: Implement DndEntityRenderer.ts**

Create `src/inquiry/features/chat/rendering/DndEntityRenderer.ts`:

```typescript
import { setIcon } from "obsidian";
import { parseMonster } from "../../../../parsers/monster-parser";
import { parseSpell } from "../../../../parsers/spell-parser";
import { parseItem } from "../../../../parsers/item-parser";
import { renderMonsterBlock } from "../../../../renderers/monster-renderer";
import { renderSpellBlock } from "../../../../renderers/spell-renderer";
import { renderItemBlock } from "../../../../renderers/item-renderer";
import * as yaml from "js-yaml";

const DND_LANGUAGES = new Set(["monster", "spell", "item"]);

export interface DndCodeFenceResult {
  entityType: string;
  name: string;
  data: Record<string, unknown>;
  yamlSource: string;
}

export function isDndCodeFence(language: string): boolean {
  return DND_LANGUAGES.has(language);
}

export function parseDndCodeFence(language: string, yamlSource: string): DndCodeFenceResult | null {
  try {
    const data = yaml.load(yamlSource) as Record<string, unknown>;
    if (!data || typeof data !== "object") return null;
    return { entityType: language, name: (data.name as string) || "Unknown", data, yamlSource };
  } catch {
    return null;
  }
}

export type CopyAndSaveCallback = (entityType: string, data: Record<string, unknown>) => Promise<void>;

export function renderDndEntityBlock(
  containerEl: HTMLElement,
  result: DndCodeFenceResult,
  onCopyAndSave?: CopyAndSaveCallback
): HTMLElement {
  const wrapper = containerEl.createDiv({ cls: "archivist-entity-block-wrapper" });
  wrapper.style.position = "relative";

  // Source badge
  const badge = wrapper.createDiv({ cls: "archivist-entity-source-badge archivist-entity-source-badge-ai" });
  const badgeIcon = badge.createSpan();
  setIcon(badgeIcon, "sparkles");
  badge.createSpan({ text: "AI" });

  // Render stat block
  const blockEl = wrapper.createDiv();
  try {
    switch (result.entityType) {
      case "monster": renderMonsterBlock(blockEl, parseMonster(result.yamlSource)); break;
      case "spell": renderSpellBlock(blockEl, parseSpell(result.yamlSource)); break;
      case "item": renderItemBlock(blockEl, parseItem(result.yamlSource)); break;
    }
  } catch (e) {
    blockEl.createDiv({ cls: "archivist-entity-error", text: `Failed to render: ${e}` });
  }

  // Copy & Save button
  if (onCopyAndSave) {
    const actionsRow = wrapper.createDiv({ cls: "archivist-entity-actions" });
    const copyBtn = actionsRow.createEl("button", { cls: "archivist-copy-save-btn" });
    const copyIcon = copyBtn.createSpan();
    setIcon(copyIcon, "copy-plus");
    copyBtn.createSpan({ text: " Copy & Save" });

    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText("```" + result.entityType + "\n" + result.yamlSource + "\n```");
        await onCopyAndSave(result.entityType, result.data);
        copyBtn.empty();
        setIcon(copyBtn.createSpan(), "check");
        copyBtn.createSpan({ text: " Saved!" });
        setTimeout(() => {
          copyBtn.empty();
          setIcon(copyBtn.createSpan(), "copy-plus");
          copyBtn.createSpan({ text: " Copy & Save" });
        }, 2000);
      } catch {
        copyBtn.empty();
        setIcon(copyBtn.createSpan(), "x");
        copyBtn.createSpan({ text: " Error" });
      }
    });
  }

  return wrapper;
}

export function replaceDndCodeFences(el: HTMLElement, onCopyAndSave?: CopyAndSaveCallback): void {
  for (const code of Array.from(el.querySelectorAll("pre > code"))) {
    const classMatch = code.className.match(/language-(\w+)/);
    if (!classMatch) continue;
    const language = classMatch[1];
    if (!isDndCodeFence(language)) continue;

    const result = parseDndCodeFence(language, code.textContent || "");
    if (!result) continue;

    const pre = code.parentElement;
    if (!pre) continue;
    const wrapper = pre.parentElement?.classList.contains("claudian-code-wrapper") ? pre.parentElement : pre;

    const blockEl = document.createElement("div");
    renderDndEntityBlock(blockEl, result, onCopyAndSave);
    wrapper.replaceWith(blockEl);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dnd-entity-renderer.test.ts`
Expected: 7 tests PASS.

- [ ] **Step 5: Hook into MessageRenderer.renderContent()**

In `src/inquiry/features/chat/rendering/MessageRenderer.ts`, in the `renderContent` method, after the existing `pre` element wrapping loop (where it adds language labels), add:

```typescript
import { replaceDndCodeFences, type CopyAndSaveCallback } from './DndEntityRenderer';

// Add field and setter:
private dndCopyAndSaveCallback?: CopyAndSaveCallback;
setDndCopyAndSaveCallback(cb: CopyAndSaveCallback): void { this.dndCopyAndSaveCallback = cb; }

// At the end of renderContent(), after the pre-wrapping loop:
replaceDndCodeFences(el, this.dndCopyAndSaveCallback);
```

- [ ] **Step 6: Commit**

```bash
git add src/inquiry/features/chat/rendering/DndEntityRenderer.ts tests/dnd-entity-renderer.test.ts src/inquiry/features/chat/rendering/MessageRenderer.ts
git commit -m "feat: D&D entity stat block rendering in chat messages"
```

---

### Task 10: Entity Autocomplete (`[[`) in Chat

**Files:**
- Create: `src/inquiry/shared/components/EntityAutocompleteDropdown.ts`
- Test: `tests/entity-autocomplete-dropdown.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/entity-autocomplete-dropdown.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseEntityReference, resolveEntityReferences } from "../src/inquiry/shared/components/EntityAutocompleteDropdown";

describe("parseEntityReference", () => {
  it("parses [[monster:Ancient Red Dragon]]", () => {
    expect(parseEntityReference("[[monster:Ancient Red Dragon]]")).toEqual({ type: "monster", name: "Ancient Red Dragon" });
  });
  it("parses [[Goblin]] without type prefix", () => {
    expect(parseEntityReference("[[Goblin]]")).toEqual({ type: null, name: "Goblin" });
  });
  it("returns null for non-entity text", () => {
    expect(parseEntityReference("hello")).toBeNull();
    expect(parseEntityReference("[[]]")).toBeNull();
  });
});

describe("resolveEntityReferences", () => {
  it("extracts all entity references from text", () => {
    const refs = resolveEntityReferences("Compare [[monster:Goblin]] with [[spell:Fireball]]");
    expect(refs).toHaveLength(2);
    expect(refs[0]).toEqual({ type: "monster", name: "Goblin" });
    expect(refs[1]).toEqual({ type: "spell", name: "Fireball" });
  });
  it("returns empty for text without references", () => {
    expect(resolveEntityReferences("no refs")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/entity-autocomplete-dropdown.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement EntityAutocompleteDropdown.ts**

Create `src/inquiry/shared/components/EntityAutocompleteDropdown.ts` with:
- `parseEntityReference(text)` -- parses `[[type:name]]` or `[[name]]` from a single reference string
- `resolveEntityReferences(text)` -- extracts all `[[...]]` references from message text
- `EntityAutocompleteDropdown` class -- dropdown triggered by `[[`, searches EntityRegistry, type prefix filtering via PREFIX_MAP, keyboard navigation, inserts `[[type:Name]]` on selection

Full implementation as shown in the code block in the spec section 2.4. The class follows the same pattern as Claudian's `MentionDropdownController` and `SlashCommandDropdown`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/entity-autocomplete-dropdown.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/inquiry/shared/components/EntityAutocompleteDropdown.ts tests/entity-autocomplete-dropdown.test.ts
git commit -m "feat: entity autocomplete ([[ trigger) for chat input"
```

---

### Task 11: D&D Slash Commands

**Files:**
- Modify: `src/inquiry/core/commands/builtInCommands.ts`

- [ ] **Step 1: Add D&D commands**

In `src/inquiry/core/commands/builtInCommands.ts`:

Update the type:
```typescript
export type BuiltInCommandAction = 'clear' | 'add-dir' | 'resume' | 'fork' | 'generate' | 'search-srd' | 'roll';
```

Add to `BUILT_IN_COMMANDS` array:
```typescript
{
  name: 'generate',
  description: 'Generate a D&D entity (monster, spell, item, encounter, NPC)',
  action: 'generate',
  hasArgs: true,
  argumentHint: '<monster|spell|item|encounter|npc> [description]',
},
{
  name: 'search-srd',
  description: 'Search SRD content by name',
  action: 'search-srd',
  hasArgs: true,
  argumentHint: '[query]',
},
{
  name: 'roll',
  description: 'Roll dice (e.g., /roll 2d6+3)',
  action: 'roll',
  hasArgs: true,
  argumentHint: '<notation>',
},
```

- [ ] **Step 2: Commit**

```bash
git add src/inquiry/core/commands/builtInCommands.ts
git commit -m "feat: add D&D slash commands (/generate, /search-srd, /roll)"
```

---

### Task 12: Entity Mentions in @ Dropdown

**Files:**
- Modify: `src/inquiry/shared/mention/types.ts`
- Modify: `src/inquiry/shared/mention/MentionDropdownController.ts`

- [ ] **Step 1: Add entity type to MentionItem**

In `src/inquiry/shared/mention/types.ts`, add:

```typescript
export interface EntityMentionItem {
  type: 'entity';
  name: string;
  entityType: string;
  slug: string;
  source: 'srd' | 'custom';
}
```

Add `EntityMentionItem` to the `MentionItem` union type.

- [ ] **Step 2: Add entity search to MentionDropdownController**

In `src/inquiry/shared/mention/MentionDropdownController.ts`:

1. Add a field and setter for EntityRegistry
2. In `showMentionDropdown()`, after vault items, search entities and append results
3. In `renderMentionDropdown()`, handle the `'entity'` case with appropriate icon
4. In `selectMentionItem()`, handle the `'entity'` case by inserting `@EntityName`

The implementation follows the same pattern as existing mention types (MCP servers, agents, etc.).

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/shared/mention/types.ts src/inquiry/shared/mention/MentionDropdownController.ts
git commit -m "feat: add D&D entity mentions in @ dropdown"
```

---

### Task 13: Copy & Save Wiring

**Files:**
- Modify: `src/inquiry/InquiryModule.ts`

- [ ] **Step 1: Add saveEntityToVault method to InquiryModule**

```typescript
import { Notice } from 'obsidian';
import { slugify, ensureUniqueSlug, generateEntityMarkdown, TYPE_FOLDER_MAP } from '../entities/entity-vault-store';

async saveEntityToVault(entityType: string, data: Record<string, unknown>): Promise<void> {
  if (!this.entityRegistry) return;

  const name = (data.name as string) || 'Unknown';
  const baseSlug = slugify(name);
  const slug = ensureUniqueSlug(baseSlug, this.entityRegistry.getAllSlugs());
  const folder = TYPE_FOLDER_MAP[entityType] ?? entityType;

  // Access Archivist settings from the parent plugin
  const archivistSettings = (this.plugin as any).settings;
  const compendiumRoot = archivistSettings?.compendiumRoot || 'Compendium';
  const userFolder = archivistSettings?.userEntityFolder || 'me';
  const dirPath = `${compendiumRoot}/${userFolder}/${folder}`;

  if (!this.app.vault.getAbstractFileByPath(dirPath)) {
    await this.app.vault.createFolder(dirPath);
  }

  const entity = { slug, name, entityType, source: 'custom' as const, data };
  const markdown = generateEntityMarkdown(entity);
  const filePath = `${dirPath}/${name}.md`;
  await this.app.vault.create(filePath, markdown);

  this.entityRegistry.register({ slug, name, entityType, source: 'custom', filePath, data });
  new Notice(`Saved to ${filePath}`);
}
```

- [ ] **Step 2: Wire callback in Tab/MessageRenderer initialization**

Find where MessageRenderer is constructed in the Tab setup. After construction, call:

```typescript
renderer.setDndCopyAndSaveCallback(async (entityType, data) => {
  await this.plugin.saveEntityToVault(entityType, data);
});
```

The implementation engineer should find the exact file (likely `Tab.ts` or a controller) and wire this.

- [ ] **Step 3: Commit**

```bash
git add src/inquiry/InquiryModule.ts
git commit -m "feat: Copy & Save wiring for AI-generated entity blocks"
```

---

### Task 14: CSS for Entity Blocks in Chat

**Files:**
- Modify: `src/styles/archivist-dnd.css`

- [ ] **Step 1: Add entity chat styles**

Append to `src/styles/archivist-dnd.css`:

```css
/* Entity block wrapper in chat */
.archivist-entity-block-wrapper { position: relative; margin: 8px 0; }

/* Source badge (top-right, absolute) */
.archivist-entity-source-badge {
  position: absolute; top: 12px; right: 12px; z-index: 1;
  display: flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 500; text-transform: uppercase;
  padding: 2px 6px; border-radius: 4px;
}
.archivist-entity-source-badge svg { width: 12px; height: 12px; }
.archivist-entity-source-badge-srd { color: rgba(0,0,0,0.4); }
.archivist-entity-source-badge-custom { color: var(--text-accent); }
.archivist-entity-source-badge-ai { color: var(--text-accent); }

/* Copy & Save button */
.archivist-entity-actions { display: flex; justify-content: flex-end; padding: 4px 8px; }
.archivist-copy-save-btn {
  display: flex; align-items: center; gap: 4px; padding: 4px 12px;
  border-radius: 4px; font-size: 12px; cursor: pointer;
  background: var(--interactive-normal); border: 1px solid var(--background-modifier-border);
}
.archivist-copy-save-btn:hover { background: var(--interactive-hover); }
.archivist-copy-save-btn svg { width: 14px; height: 14px; }

/* Entity autocomplete dropdown */
.archivist-entity-dropdown {
  position: absolute; bottom: 100%; left: 0; right: 0; max-height: 300px;
  overflow-y: auto; background: var(--background-primary);
  border: 1px solid var(--background-modifier-border); border-radius: 8px;
  z-index: 100; display: none; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}
.archivist-entity-dropdown.visible { display: block; }
.archivist-entity-dropdown-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer;
}
.archivist-entity-dropdown-item:hover,
.archivist-entity-dropdown-item.selected { background: var(--background-modifier-hover); }
.archivist-entity-dropdown-icon { flex-shrink: 0; color: var(--text-muted); }
.archivist-entity-dropdown-icon svg { width: 14px; height: 14px; }
.archivist-entity-dropdown-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.archivist-entity-dropdown-badge {
  font-size: 9px; font-weight: 600; text-transform: uppercase; padding: 1px 4px; border-radius: 3px;
}
.archivist-entity-dropdown-badge-srd { color: var(--text-muted); background: var(--background-modifier-border); }
.archivist-entity-dropdown-badge-custom { color: var(--text-accent); background: rgba(var(--color-accent-rgb), 0.1); }

/* Dark mode */
.theme-dark .archivist-entity-source-badge-srd { color: rgba(255,255,255,0.4); }
```

- [ ] **Step 2: Rebuild CSS**

```bash
npm run build:css
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/archivist-dnd.css styles.css
git commit -m "feat: CSS for entity blocks, badges, autocomplete in chat"
```

---

### Task 15: Build, Test, and Deploy

**Files:** No new files.

- [ ] **Step 1: Fix remaining TypeScript errors**

```bash
npx tsc --noEmit --skipLibCheck 2>&1
```

Fix each error iteratively. Common issues: cross-boundary import paths, missing type declarations, Claudian files still referencing old main.

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass (D&D tests + new integration tests).

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: `main.js` + `styles.css` built. Size ~5-7MB.

- [ ] **Step 4: Deploy to vault**

```bash
yes | cp main.js /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/main.js
yes | cp styles.css /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/styles.css
yes | cp manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/manifest.json
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete Claudian chat engine integration into Archivist"
```

---

## Task Dependency Graph

```
Task 1 (Clone) ─┬─→ Task 2 (Delete old)
                 ├─→ Task 3 (Build system)
                 └─→ Task 4 (Branding)

Tasks 2+3+4 ──→ Task 5 (InquiryModule) ──→ Task 6 (main.ts)
                                         ──→ Task 7 (Settings)

Task 6 ──→ Task 8 (D&D prompt)
       ──→ Task 9 (Entity renderer) ──→ Task 13 (Copy & Save)
       ──→ Task 10 (Entity autocomplete)
       ──→ Task 11 (Slash commands)
       ──→ Task 12 (Entity mentions)

Task 3 ──→ Task 14 (CSS)

All ──→ Task 15 (Build + Deploy)
```
