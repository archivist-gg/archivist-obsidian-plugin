# Archivist Inquiry -- AI Agent for archivist-ttrpg-blocks

## Overview

Archivist Inquiry is an AI chat agent embedded in the archivist-ttrpg-blocks Obsidian plugin. It acts as "the Archivist, a wise owl" -- a D&D 5e campaign assistant that can search vault documents, generate monster/spell/item stat blocks, build encounters, create NPC notes, help with session prep, suggest lore connections, and answer rules questions.

The agent uses Claude Code CLI (via the Agent SDK) as its AI backend, requiring zero API key configuration for users who already have Claude Code installed. Claude Code's native tools (Read, Write, Edit, Grep, Glob, Bash) handle all vault file operations. The plugin provides 7 custom MCP tools for TTRPG-specific functionality: entity generation (monster, spell, item, encounter, NPC) and SRD data access (search, lookup).

## Architecture

### Layer Diagram

```
OBSIDIAN UI LAYER
  Chat View (sidebar panel, message list, streaming display, stat block rendering)
  Chat Tabs (multi-conversation, history browser)
  Chat Input (model picker, context gauge, permission toggle, send/stop icons)

AGENT SDK LAYER
  Conversation Manager (create/resume/delete, message history, JSON persistence)
  Agent SDK query() (@anthropic-ai/claude-agent-sdk, spawns Claude Code CLI, NDJSON stdin/stdout)

CLAUDE CODE CLI (subprocess, user's existing install)
  Native Tools: Read, Write, Edit, Bash, Grep, Glob
  Custom MCP Tools (ours): generate_monster, generate_spell, generate_item,
                           generate_encounter, generate_npc, search_srd, get_srd_entity

SYSTEM PROMPT: Archivist owl persona + TTRPG directory scoping + generation instructions
```

### Provider

Claude Code CLI only (no direct API key support). The plugin uses the `@anthropic-ai/claude-agent-sdk` package to spawn and communicate with the CLI. Users must have Claude Code installed and authenticated. If not detected, the AI features display a setup guide while the rest of the plugin (block rendering, modals, inline tags) continues to work normally.

### Communication Protocol

The Agent SDK's `query()` function handles subprocess lifecycle. Communication is NDJSON (newline-delimited JSON) over stdin/stdout. The plugin:

1. Calls `query()` with the user's message, system prompt, and MCP server config
2. Iterates the async response stream
3. Handles message types: text deltas, tool calls, tool results, errors, completion
4. Renders each chunk in the chat UI in real-time

### Custom MCP Tools

Registered in-process via `createSdkMcpServer()` from the Agent SDK. Claude Code sees these as `mcp__archivist__<tool_name>`.

## AI Tools

### Generation Tools (structured output, rendered in chat)

#### generate_monster

Input: Full D&D 5e monster schema (Zod-validated):
- name, size (Tiny-Gargantuan), type, subtype, alignment, cr
- abilities (str/dex/con/int/wis/cha, each 1-30)
- ac (array of {ac, from?, condition?}), hp ({average, formula}), speed (walk/fly/swim/climb/burrow)
- saves, skills (records), defenses (vulnerabilities/resistances/immunities)
- senses, passive_perception, languages
- traits, actions, reactions, legendary (each {name, entries[]})
- legendary_actions count, legendary_resistance count, proficiency_bonus, environment

Post-validation enrichment:
- Calculate XP from CR using CR-XP mapping table
- Derive proficiency bonus from CR
- Compute ability modifiers
- Ensure passive Perception is present
- Default languages to "---"

Output: Validated Monster object. Rendered in chat using existing `renderMonsterBlock()`.

#### generate_spell

Input: Full spell schema (Zod-validated):
- name, level (0-9), school (8 schools), casting_time, range, components, duration
- description (string array), at_higher_levels, classes, ritual, concentration

Post-validation enrichment:
- Auto-detect concentration from duration text
- Default classes to ["Wizard", "Sorcerer"]
- Mark source as "Homebrew"

Output: Validated Spell object. Rendered using existing `renderSpellBlock()`.

#### generate_item

Input: Full item schema (Zod-validated):
- name, type (weapon/armor/potion/ring/rod/scroll/staff/wand/wondrous item/shield)
- rarity (common-artifact), source, entries
- weight, value, attunement (boolean or string)
- Weapon props: property, dmg1, dmgType, weaponCategory, bonusWeapon
- Armor props: ac, bonusAc
- Magic props: attachedSpells, bonusSpellAttack, bonusSpellSaveDc
- curse, charges, recharge

Post-validation enrichment:
- Normalize attunement/curse flags
- Default source to "Homebrew"

Output: Validated Item object. Rendered using existing `renderItemBlock()`.

#### generate_encounter

Input:
- party_size (number), party_level (number)
- difficulty: "easy" | "medium" | "hard" | "deadly"
- environment (optional string, e.g., "swamp", "dungeon", "forest")
- theme (optional string, e.g., "undead horde", "dragon lair")

Processing:
- Calculate XP budget based on party size, level, and difficulty using 5e DMG thresholds
- AI selects monsters that fit within the budget, environment, and theme
- Apply encounter multiplier for number of monsters

Output:
- monsters: array of {name, cr, count, role (e.g., "brute", "controller", "minion")}
- tactics: string (suggested combat tactics)
- terrain: string (terrain/environment suggestions)
- notes: string (DM tips, difficulty adjustments)
- xp_budget: {target, actual, difficulty_rating}

Rendered in chat as formatted text with monster list. Each monster name links to SRD data if available.

#### generate_npc

Input:
- role (optional, e.g., "tavern keeper", "guard captain", "merchant")
- race (optional, e.g., "human", "elf", "dwarf")
- context (optional, e.g., "works in the thieves' guild in Valdros")

Output:
- name, race, role
- personality: string (2-3 personality traits)
- motivation: string (what drives them)
- secrets: string (hidden knowledge or agenda)
- appearance: string (physical description)
- voice: string (how they speak, verbal tics, accent notes)
- connections: string (relationships to other NPCs or factions)

Auto-creates a markdown note in the TTRPG root directory with YAML frontmatter:
```yaml
---
type: npc
name: Borin Ironjaw
race: Dwarf
role: Blacksmith
tags: [npc, generated]
---
```
The note body contains all fields formatted as sections with wiki-links to existing vault notes where relevant.

### SRD Tools

#### search_srd

Input:
- query: string (name or partial name)
- entity_type: "monster" | "spell" | "item" (optional filter)
- filters: optional object:
  - cr_min, cr_max (monsters)
  - level_min, level_max (spells)
  - school (spells)
  - rarity (items)
- limit: number (1-20, default 5)

Output: Array of summary objects:
- Monsters: {name, size, type, cr, ac, hp}
- Spells: {name, level, school, casting_time, concentration}
- Items: {name, type, rarity, attunement}

Data source: In-memory JSON loaded at plugin startup.

#### get_srd_entity

Input:
- name: string (exact or close match)
- entity_type: "monster" | "spell" | "item"

Output: Complete entity object matching the plugin's Monster/Spell/Item type interfaces.

### SRD Data

Three JSON files bundled with the plugin:

| File | Contents | Approx Size |
|------|----------|-------------|
| srd-monsters.json | ~325 SRD monsters | ~1.5MB |
| srd-spells.json | ~320 SRD spells | ~500KB |
| srd-items.json | ~250 SRD magic items | ~300KB |

Loaded into memory on plugin startup for fast search queries. Licensed under OGL/Creative Commons.

### Vault Context

Claude Code's native tools handle all vault operations. The system prompt scopes file access:

- **TTRPG root directory** configured in plugin settings (default: entire vault)
- System prompt injects: "Your scope is limited to files within: {ttrpgRootDir}. These documents are the PRIMARY source of truth for this campaign. Always search within this directory first before using your training knowledge. Do not read or modify files outside this directory."
- **Current note** automatically included as context with each message
- **Selected text** shown in the context row above the input; auto-included when present
- Claude Code uses Grep/Glob/Read to search and read vault files as needed

### Abilities Not Requiring Dedicated Tools

These capabilities are handled by the system prompt instructing Claude to use its native tools and training knowledge:

- **Session prep**: System prompt instructs Claude to search recent campaign notes, summarize party status, identify plot hooks, and create a prep note via Write tool
- **Lore linker**: System prompt instructs Claude to search vault for thematic connections between notes and suggest links
- **Rules lookup**: Claude answers D&D 5e rules questions from training knowledge, referencing SRD data for accuracy
- **Note generator**: Claude creates location/faction/quest hook notes using its Write tool with proper frontmatter and wiki-links

## Chat UI

### Sidebar Panel

Obsidian `ItemView` registered as `archivist-inquiry-view`. Opened via ribbon icon (owl) or command palette. Right sidebar.

### Design Language

- **Chrome**: Obsidian CSS variables (`--text-normal`, `--background-primary`, `--background-modifier-border`, etc.) for full light/dark theme compatibility
- **Brand color**: `#D97757` (warm terracotta, from Claudian's palette) for accents: active tabs, send button, tool call icons, model selector, context gauge
- **Stat blocks**: Existing parchment palette (#fdf1dc background, #7a200d text, #922610 bars) -- unchanged from current plugin
- **Font**: Obsidian's `--font-text` for UI, `--font-monospace` for tool calls. Stat blocks use Libre Baskerville / Noto Sans.

### Layout (top to bottom)

#### Header Bar (36px)
- Left: Owl icon (exact SVG from archivist web app's `OwlIcon.tsx`, stroke=currentColor) + "Archivist Inquiry" in semi-bold
- Right: New chat icon (+), History icon (clock), Close icon (X). All 14x14 Lucide-style icons, muted color, hover to normal.

#### Tabs Bar (archivist browser-style)
- Horizontal row of text-label tabs
- Active tab: brand-color bottom border (2px), brand-color text
- Inactive tabs: transparent bottom border, muted text, hover to lighter
- Close X appears on hover per tab
- Horizontal scroll when many tabs
- Right-click context menu: Close, Close Others, Close All

#### Messages Area (flex-1, scrollable)
- **Welcome state** (empty conversation): Centered owl icon (32px) + serif greeting "Good evening" + "What knowledge do you seek?" subtitle
- **User messages**: Right-aligned, subtle bubble (rgba background, 1px border, rounded corners with smaller bottom-right). Max-width 85%.
- **Assistant messages**: Left-aligned, no bubble, bare text on background. Rendered as markdown with syntax highlighting. Copy button on hover.
- **Tool calls**: Collapsible tree-branch pattern (from Claudian). Icon (brand color) + monospace tool name + italic summary + status checkmark. Click to expand and see parameters/output. 2px left border indent when expanded.
- **Thinking indicator**: Owl icon + "Thinking..." with subtle pulse animation
- **Generated stat blocks**: Rendered inline using existing `renderMonsterBlock()`, `renderSpellBlock()`, `renderItemBlock()`. Parchment theme. "Copy to Clipboard" button below each block.
- **Errors**: Card with colored border (red), icon, message, optional retry button.

#### Input Area (bottom, border-top)

**Context row** (shown when selection exists):
- Highlight icon + "Selection" label in blue + truncated preview text + dismiss X
- Dismissible; auto-included as context in next message

**Input wrapper** (bordered, rounded):
- Auto-expanding textarea (min 36px, max 200px). Placeholder: "Ask the Archivist..."
- During streaming: placeholder changes to "Archivist is thinking...", textarea disabled

**Toolbar row** (below textarea, inside border):
- Model selector: dropdown showing current model in brand color (Opus 4 / Sonnet 4 / Haiku 4). Upward-expanding on click.
- Separator (1px vertical line)
- Context usage gauge: 14px SVG arc showing context window percentage. Brand color fill. Warning state at >80%.
- Separator
- Permission toggle: "Auto" (green, auto-approve tools) / "Safe" (gray, require approval). Small toggle switch.
- Send button (right-aligned): Brand-color circle with arrow icon. During streaming: swaps to gray circle with filled square (stop icon).

### TTRPG Directory Picker

Available in plugin settings as a persistent default TTRPG root directory (folder picker). Per-conversation directory override is out of scope for v1 -- all conversations use the same configured directory.

## Conversation Management

### Storage

JSON via Obsidian's `plugin.loadData()` / `plugin.saveData()`:

```typescript
interface ConversationStore {
  conversations: Record<string, Conversation>;
  openTabs: string[];        // ordered tab IDs
  activeConversationId: string | null;
}

interface Conversation {
  id: string;
  title: string;             // auto-generated from first user message
  createdAt: string;         // ISO timestamp
  updatedAt: string;
  model: string;
  messages: Message[];
}

interface Message {
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: string;
}
```

### History

Dropdown triggered by History icon in header. Conversations grouped chronologically:
- Today / Yesterday / Last Week / Last Month / Older
- Each item: message icon + title (truncated) + chevron right
- Active conversation highlighted with brand-color icon
- Click to open in current tab or new tab
- Max stored conversations: configurable (default 50), oldest auto-deleted when exceeded

### Tab Management

- Multiple conversations open simultaneously as tabs
- New chat: creates new conversation + tab
- Close tab: removes tab, conversation persists in history
- Right-click context menu: Close, Close Others, Close All
- Tab state (open tabs + active tab) persists across Obsidian restarts

## System Prompt

The Archivist persona, adapted from the original web app's `getSystemPrompt()`:

```
You are the Archivist, a wise owl assistant for D&D 5e campaign management.

PERSONA:
- Communicate as a scholarly owl. No physical action descriptions.
- Stay strictly scoped to D&D and TTRPG topics.
- Be helpful, knowledgeable, and concise.

VAULT SCOPE:
- Your file operations are limited to: {ttrpgRootDir}
- Documents in this directory are the PRIMARY source of truth for this campaign.
- Always search within this directory first before using your training knowledge.
- Do not read or modify files outside this directory.

CONTEXT:
- Current note: {currentNotePath} (content included below if available)
- Selected text: {selectedText} (if any)

TOOLS:
- For structured stat blocks: use generate_monster, generate_spell, generate_item tools
- For encounter building: use generate_encounter tool
- For NPC creation: use generate_npc tool (auto-creates note file)
- For SRD reference: use search_srd and get_srd_entity tools
- For vault search: use your built-in Grep, Glob, Read tools within {ttrpgRootDir}
- For creating notes: use your built-in Write tool within {ttrpgRootDir}

GENERATION RULES:
- When generating a stat block, the block IS the response. Do not add redundant text describing what's already visible in the block.
- When generating text content (tavern descriptions, NPC backstories, session prep), write rich descriptive markdown.
- When creating notes, include YAML frontmatter with type, name, and tags.
- Include wiki-links ([[Note Name]]) to existing vault notes when relevant.
- Stop after 7 tool calls to avoid loops.

BEHAVIOR:
- If asked about something in the campaign, search the vault first.
- If vault has no relevant info, use your D&D 5e training knowledge.
- When referencing SRD content, use search_srd/get_srd_entity for accuracy.
- For homebrew content, make it balanced and consistent with 5e design principles.
```

## Plugin Settings

New settings tab in the plugin:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| TTRPG Root Directory | Folder picker | / (entire vault) | Scopes AI vault access and file creation |
| Permission Mode | Toggle | Safe | Auto (auto-approve tool calls) vs Safe (require approval) |
| Default Model | Dropdown | Sonnet 4 | Default model for new conversations |
| Max Conversations | Number | 50 | Max stored conversations before oldest auto-deleted |

## Dependencies

New packages required:

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | Spawn Claude Code CLI, register MCP tools, stream responses |
| `zod` | Schema validation for generation tool inputs/outputs |

Existing packages unchanged: `obsidian`, `js-yaml`, `esbuild`, `vitest`, `@codemirror/language`.

## Error Handling

- **Claude Code not installed**: AI features show setup guide ("Install Claude Code to enable Archivist Inquiry" with link). All non-AI plugin features continue to work.
- **Claude Code not authenticated**: Show auth instructions in chat panel.
- **Stream errors**: Display error card in chat with retry button. Classified as connection/timeout/rate_limit/general.
- **Tool validation errors**: If AI sends invalid data to a generation tool, return validation error to the AI so it can self-correct.
- **Context overflow**: Show context usage warning at >80%. At limit, suggest starting a new conversation.

## Scope Boundaries

### In scope
- Chat sidebar UI (view, tabs, history, messages, input, streaming)
- Agent SDK integration (spawn, stream, MCP tools)
- 7 custom MCP tools (5 generation + 2 SRD)
- Entity validation and enrichment (Zod schemas, auto-calc)
- Bundled SRD JSON data
- System prompt (owl persona, directory scoping)
- Conversation persistence (JSON)
- Plugin settings (directory, permission, model, max conversations)
- Selection awareness (context row)
- Permission modes (Auto/Safe)

### Out of scope
- Direct API key support (Anthropic/OpenAI) -- Claude Code CLI only
- Dice rolling system
- Inline editing with diffs (Claudian's feature, not needed here)
- Cost tracking / token counting (Claude Code handles billing)
- File upload / image analysis
- Web search tool
- Plan mode (Claudian's feature)

## Testing

- **Unit tests**: Zod schemas, entity validation/enrichment, SRD search/lookup, conversation storage
- **Integration tests**: MCP tool registration and execution (mocked Agent SDK)
- **Manual testing**: Full chat flow in Obsidian test vault with TTRPG content
