# Archivist Inquiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI chat agent ("Archivist Inquiry") to the archivist-ttrpg-blocks Obsidian plugin that generates D&D 5e content, searches vault documents, and provides campaign assistance via Claude Code CLI.

**Architecture:** The plugin uses the Agent SDK to spawn Claude Code CLI as a subprocess. 7 custom MCP tools handle entity generation (monster/spell/item/encounter/NPC) and SRD data access. The chat UI is an Obsidian ItemView sidebar with multi-tab conversations, streaming responses, and inline stat block rendering.

**Tech Stack:** TypeScript, Obsidian API (ItemView, Plugin, Setting), @anthropic-ai/claude-agent-sdk (query, createSdkMcpServer, tool), zod (schema validation), esbuild (bundler), vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-28-archivist-inquiry-design.md`

---

## File Structure

### New Files

```
src/
  types/
    conversation.ts          -- Conversation, Message, ConversationStore, ToolCall interfaces
    encounter.ts             -- Encounter output type for generate_encounter
    npc.ts                   -- NPC output type for generate_npc
    settings.ts              -- ArchivistSettings interface + defaults
  ai/
    agent-service.ts         -- Wraps Agent SDK query(), manages streaming + abort
    system-prompt.ts         -- Builds system prompt with vault scope + persona
    mcp-server.ts            -- Creates MCP server with all 7 tools registered
    conversation-manager.ts  -- Conversation CRUD, tab state, JSON persistence
    schemas/
      monster-schema.ts      -- Zod schema for monster generation tool input
      spell-schema.ts        -- Zod schema for spell generation tool input
      item-schema.ts         -- Zod schema for item generation tool input
      encounter-schema.ts    -- Zod schema for encounter generation tool input
      npc-schema.ts          -- Zod schema for NPC generation tool input
      srd-schema.ts          -- Zod schemas for SRD tool inputs (search + get)
    validation/
      cr-xp-mapping.ts       -- CR-to-XP lookup table + proficiency bonus calc
      entity-enrichment.ts   -- Post-validation enrichment for monster/spell/item
    srd/
      srd-store.ts           -- In-memory SRD data store with fuzzy search
    tools/
      generation-tools.ts    -- 5 MCP tool definitions (monster/spell/item/encounter/npc)
      srd-tools.ts           -- 2 MCP tool definitions (search_srd/get_srd_entity)
  ui/
    inquiry-view.ts          -- Main Obsidian ItemView (sidebar panel)
    components/
      owl-icon.ts            -- Owl SVG icon from archivist web app
      chat-header.ts         -- Header bar (owl + title + action buttons)
      chat-tabs.ts           -- Browser-style tab bar with context menu
      chat-messages.ts       -- Scrollable message list container
      message-renderer.ts    -- Renders individual messages (user/assistant/tool/error/stat block)
      chat-input.ts          -- Input area (context row + textarea + toolbar)
      chat-history.ts        -- History dropdown grouped by date
  settings/
    settings-tab.ts          -- Plugin settings tab (4 settings)
  data/
    srd-monsters.json        -- Bundled SRD monster data (~325 entries)
    srd-spells.json          -- Bundled SRD spell data (~320 entries)
    srd-items.json           -- Bundled SRD item data (~250 entries)

tests/
  cr-xp-mapping.test.ts
  entity-enrichment.test.ts
  monster-schema.test.ts
  spell-schema.test.ts
  item-schema.test.ts
  encounter-schema.test.ts
  srd-store.test.ts
  conversation-manager.test.ts
```

### Modified Files

```
src/main.ts              -- Add view registration, ribbon icon, commands, settings load/save
styles.css               -- Add ~400 lines of chat UI styles
package.json             -- Add @anthropic-ai/claude-agent-sdk, zod dependencies
esbuild.config.mjs       -- No changes needed (builtins already external)
```

---

### Task 1: Project Setup -- Dependencies & Build Config

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Add dependencies**

```bash
cd /Users/shinoobi/w/archivist-obsidian
npm install @anthropic-ai/claude-agent-sdk zod
```

- [ ] **Step 2: Verify package.json has new deps**

Run: `cat package.json | grep -A2 '"dependencies"'`
Expected: `js-yaml`, `@anthropic-ai/claude-agent-sdk`, `zod` listed

- [ ] **Step 3: Verify build still works**

Run: `npm run build`
Expected: Build succeeds, `main.js` generated

- [ ] **Step 4: Verify tests still pass**

Run: `npm test`
Expected: All 22 existing tests pass

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(inquiry): add agent SDK and zod dependencies"
```

---

### Task 2: Types -- Settings, Conversation, Encounter, NPC

**Files:**
- Create: `src/types/settings.ts`
- Create: `src/types/conversation.ts`
- Create: `src/types/encounter.ts`
- Create: `src/types/npc.ts`

- [ ] **Step 1: Create settings type**

```typescript
// src/types/settings.ts
export interface ArchivistSettings {
  ttrpgRootDir: string;
  permissionMode: "auto" | "safe";
  defaultModel: string;
  maxConversations: number;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  ttrpgRootDir: "/",
  permissionMode: "safe",
  defaultModel: "claude-sonnet-4-6",
  maxConversations: 50,
};
```

- [ ] **Step 2: Create conversation types**

```typescript
// src/types/conversation.ts
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: string;
  /** For assistant messages that contain a generated entity */
  generatedEntity?: {
    type: "monster" | "spell" | "item" | "encounter" | "npc";
    data: unknown;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  model: string;
  messages: Message[];
}

export interface ConversationStore {
  conversations: Record<string, Conversation>;
  openTabs: string[];
  activeConversationId: string | null;
}

export const EMPTY_STORE: ConversationStore = {
  conversations: {},
  openTabs: [],
  activeConversationId: null,
};
```

- [ ] **Step 3: Create encounter type**

```typescript
// src/types/encounter.ts
export interface EncounterMonster {
  name: string;
  cr: string;
  count: number;
  role: string;
}

export interface EncounterXPBudget {
  target: number;
  actual: number;
  difficulty_rating: string;
}

export interface Encounter {
  monsters: EncounterMonster[];
  tactics: string;
  terrain: string;
  notes: string;
  xp_budget: EncounterXPBudget;
}
```

- [ ] **Step 4: Create NPC type**

```typescript
// src/types/npc.ts
export interface NPC {
  name: string;
  race: string;
  role: string;
  personality: string;
  motivation: string;
  secrets: string;
  appearance: string;
  voice: string;
  connections: string;
}
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build succeeds (types are only imported, not executed)

- [ ] **Step 6: Commit**

```bash
git add src/types/settings.ts src/types/conversation.ts src/types/encounter.ts src/types/npc.ts
git commit -m "feat(inquiry): add types for settings, conversations, encounters, NPCs"
```

---

### Task 3: CR-XP Mapping & Entity Enrichment

**Files:**
- Create: `src/ai/validation/cr-xp-mapping.ts`
- Create: `src/ai/validation/entity-enrichment.ts`
- Create: `tests/cr-xp-mapping.test.ts`
- Create: `tests/entity-enrichment.test.ts`

- [ ] **Step 1: Write CR-XP mapping tests**

```typescript
// tests/cr-xp-mapping.test.ts
import { describe, it, expect } from "vitest";
import { getChallengeRatingXP, getProficiencyBonus, parseCR } from "../src/ai/validation/cr-xp-mapping";

describe("getChallengeRatingXP", () => {
  it("returns 10 for CR 0", () => {
    expect(getChallengeRatingXP("0")).toBe(10);
  });

  it("returns 25 for CR 1/8", () => {
    expect(getChallengeRatingXP("1/8")).toBe(25);
  });

  it("returns 1800 for CR 5", () => {
    expect(getChallengeRatingXP("5")).toBe(1800);
  });

  it("returns 155000 for CR 30", () => {
    expect(getChallengeRatingXP("30")).toBe(155000);
  });

  it("returns 0 for unknown CR", () => {
    expect(getChallengeRatingXP("99")).toBe(0);
  });
});

describe("getProficiencyBonus", () => {
  it("returns 2 for CR 0-4", () => {
    expect(getProficiencyBonus("0")).toBe(2);
    expect(getProficiencyBonus("4")).toBe(2);
  });

  it("returns 3 for CR 5-8", () => {
    expect(getProficiencyBonus("5")).toBe(3);
    expect(getProficiencyBonus("8")).toBe(3);
  });

  it("returns 6 for CR 17-20", () => {
    expect(getProficiencyBonus("17")).toBe(6);
    expect(getProficiencyBonus("20")).toBe(6);
  });

  it("handles fractional CRs", () => {
    expect(getProficiencyBonus("1/4")).toBe(2);
    expect(getProficiencyBonus("1/2")).toBe(2);
  });
});

describe("parseCR", () => {
  it("parses integer CRs", () => {
    expect(parseCR("5")).toBe(5);
  });

  it("parses fractional CRs", () => {
    expect(parseCR("1/4")).toBe(0.25);
    expect(parseCR("1/2")).toBe(0.5);
  });

  it("returns 0 for empty string", () => {
    expect(parseCR("")).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/cr-xp-mapping.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement CR-XP mapping**

```typescript
// src/ai/validation/cr-xp-mapping.ts
export const CR_TO_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100,
  "5": 1800, "6": 2300, "7": 2900, "8": 3900,
  "9": 5000, "10": 5900, "11": 7200, "12": 8400,
  "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};

export function parseCR(cr: string): number {
  if (!cr) return 0;
  if (cr.includes("/")) {
    const [num, denom] = cr.split("/").map(Number);
    return num / denom;
  }
  return Number(cr) || 0;
}

export function getChallengeRatingXP(cr: string): number {
  return CR_TO_XP[cr] ?? 0;
}

export function getProficiencyBonus(cr: string): number {
  const v = parseCR(cr);
  if (v < 5) return 2;
  if (v < 9) return 3;
  if (v < 13) return 4;
  if (v < 17) return 5;
  if (v < 21) return 6;
  if (v < 25) return 7;
  if (v < 29) return 8;
  return 9;
}
```

- [ ] **Step 4: Run CR-XP tests**

Run: `npx vitest run tests/cr-xp-mapping.test.ts`
Expected: All pass

- [ ] **Step 5: Write entity enrichment tests**

```typescript
// tests/entity-enrichment.test.ts
import { describe, it, expect } from "vitest";
import { enrichMonster, enrichSpell, enrichItem } from "../src/ai/validation/entity-enrichment";

describe("enrichMonster", () => {
  it("calculates XP from CR", () => {
    const result = enrichMonster({ name: "Test", cr: "5", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    expect(result.xp).toBe(1800);
  });

  it("calculates proficiency bonus from CR", () => {
    const result = enrichMonster({ name: "Test", cr: "10", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    expect(result.proficiency_bonus).toBe(4);
  });

  it("computes passive perception from wisdom", () => {
    const result = enrichMonster({ name: "Test", cr: "1", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 } });
    expect(result.passive_perception).toBe(12);
  });

  it("preserves explicit passive perception", () => {
    const result = enrichMonster({ name: "Test", cr: "1", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, passive_perception: 15 });
    expect(result.passive_perception).toBe(15);
  });

  it("defaults languages to ---", () => {
    const result = enrichMonster({ name: "Test", cr: "1", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    expect(result.languages).toEqual(["---"]);
  });

  it("preserves existing languages", () => {
    const result = enrichMonster({ name: "Test", cr: "1", abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, languages: ["Common", "Draconic"] });
    expect(result.languages).toEqual(["Common", "Draconic"]);
  });
});

describe("enrichSpell", () => {
  it("detects concentration from duration", () => {
    const result = enrichSpell({ name: "Test", duration: "Concentration, up to 1 minute" });
    expect(result.concentration).toBe(true);
  });

  it("defaults classes to Wizard, Sorcerer", () => {
    const result = enrichSpell({ name: "Test" });
    expect(result.classes).toEqual(["Wizard", "Sorcerer"]);
  });

  it("preserves existing classes", () => {
    const result = enrichSpell({ name: "Test", classes: ["Cleric"] });
    expect(result.classes).toEqual(["Cleric"]);
  });
});

describe("enrichItem", () => {
  it("defaults source to Homebrew", () => {
    const result = enrichItem({ name: "Test" });
    expect(result.source).toBe("Homebrew");
  });

  it("defaults attunement to false", () => {
    const result = enrichItem({ name: "Test" });
    expect(result.attunement).toBe(false);
  });

  it("preserves string attunement", () => {
    const result = enrichItem({ name: "Test", attunement: "by a cleric" });
    expect(result.attunement).toBe("by a cleric");
  });
});
```

- [ ] **Step 6: Run enrichment tests to verify they fail**

Run: `npx vitest run tests/entity-enrichment.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 7: Implement entity enrichment**

```typescript
// src/ai/validation/entity-enrichment.ts
import { getChallengeRatingXP, getProficiencyBonus } from "./cr-xp-mapping";
import { abilityModifier } from "../../parsers/yaml-utils";
import type { Monster } from "../../types/monster";
import type { Spell } from "../../types/spell";
import type { Item } from "../../types/item";

export function enrichMonster(raw: Record<string, unknown>): Monster & { xp?: number; proficiency_bonus?: number } {
  const cr = String(raw.cr ?? "0");
  const abilities = raw.abilities as Monster["abilities"];

  const wisdomMod = abilities ? abilityModifier(abilities.wis) : 0;
  const passivePerception = (raw.passive_perception as number) ?? (10 + wisdomMod);

  const languages = (raw.languages as string[])?.length
    ? (raw.languages as string[])
    : ["---"];

  return {
    ...(raw as unknown as Monster),
    cr,
    xp: getChallengeRatingXP(cr),
    proficiency_bonus: getProficiencyBonus(cr),
    passive_perception: passivePerception,
    languages,
  } as Monster & { xp?: number; proficiency_bonus?: number };
}

export function enrichSpell(raw: Record<string, unknown>): Spell {
  const duration = raw.duration as string | undefined;
  const concentration =
    (raw.concentration as boolean) ??
    (duration?.toLowerCase().includes("concentration") ?? false);

  const classes = (raw.classes as string[])?.length
    ? (raw.classes as string[])
    : ["Wizard", "Sorcerer"];

  return {
    ...(raw as unknown as Spell),
    concentration,
    ritual: (raw.ritual as boolean) ?? false,
    classes,
  };
}

export function enrichItem(raw: Record<string, unknown>): Item & { source?: string } {
  return {
    ...(raw as unknown as Item),
    source: (raw.source as string) ?? "Homebrew",
    attunement: raw.attunement ?? false,
    curse: (raw.curse as boolean) ?? false,
  } as Item & { source?: string };
}
```

- [ ] **Step 8: Run all enrichment tests**

Run: `npx vitest run tests/entity-enrichment.test.ts tests/cr-xp-mapping.test.ts`
Expected: All pass

- [ ] **Step 9: Run full test suite**

Run: `npm test`
Expected: All existing + new tests pass

- [ ] **Step 10: Commit**

```bash
git add src/ai/validation/ tests/cr-xp-mapping.test.ts tests/entity-enrichment.test.ts
git commit -m "feat(inquiry): add CR-XP mapping and entity enrichment with tests"
```

---

### Task 4: Zod Schemas for Entity Generation

**Files:**
- Create: `src/ai/schemas/monster-schema.ts`
- Create: `src/ai/schemas/spell-schema.ts`
- Create: `src/ai/schemas/item-schema.ts`
- Create: `src/ai/schemas/encounter-schema.ts`
- Create: `src/ai/schemas/npc-schema.ts`
- Create: `src/ai/schemas/srd-schema.ts`
- Create: `tests/monster-schema.test.ts` (Zod validation)
- Create: `tests/spell-schema.test.ts` (Zod validation)
- Create: `tests/item-schema.test.ts` (Zod validation)
- Create: `tests/encounter-schema.test.ts`

These schemas are used by the MCP tool definitions for input validation. They are ported from the archivist web app's `entity.schemas.ts` but adapted to match our existing type interfaces (which use `snake_case` field names rather than `camelCase`).

- [ ] **Step 1: Write monster schema tests**

```typescript
// tests/monster-schema.test.ts
import { describe, it, expect } from "vitest";
import { monsterInputSchema } from "../src/ai/schemas/monster-schema";

describe("monsterInputSchema", () => {
  it("validates a minimal monster", () => {
    const result = monsterInputSchema.safeParse({
      name: "Goblin",
      size: "Small",
      type: "Humanoid",
      alignment: "Neutral Evil",
      cr: "1/4",
      abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
      ac: [{ ac: 15 }],
      hp: { average: 7, formula: "2d6" },
      speed: { walk: 30 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = monsterInputSchema.safeParse({
      size: "Small",
      type: "Humanoid",
      alignment: "Neutral Evil",
      cr: "1",
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ac: [{ ac: 10 }],
      hp: { average: 10, formula: "2d8+2" },
      speed: { walk: 30 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects ability scores outside 1-30", () => {
    const result = monsterInputSchema.safeParse({
      name: "Test",
      size: "Medium",
      type: "Beast",
      alignment: "Unaligned",
      cr: "1",
      abilities: { str: 0, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      ac: [{ ac: 10 }],
      hp: { average: 10, formula: "2d8+2" },
      speed: { walk: 30 },
    });
    expect(result.success).toBe(false);
  });

  it("validates a full monster with all optional fields", () => {
    const result = monsterInputSchema.safeParse({
      name: "Adult Red Dragon",
      size: "Huge",
      type: "Dragon",
      alignment: "Chaotic Evil",
      cr: "17",
      abilities: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
      ac: [{ ac: 19, from: ["natural armor"] }],
      hp: { average: 256, formula: "19d12+133" },
      speed: { walk: 40, fly: 80, climb: 40 },
      saves: { dex: 6, con: 13, wis: 7, cha: 11 },
      skills: { Perception: 13, Stealth: 6 },
      damage_immunities: ["fire"],
      senses: ["blindsight 60 ft.", "darkvision 120 ft."],
      passive_perception: 23,
      languages: ["Common", "Draconic"],
      traits: [{ name: "Legendary Resistance (3/Day)", entries: ["If the dragon fails a saving throw, it can choose to succeed instead."] }],
      actions: [{ name: "Multiattack", entries: ["The dragon makes three attacks: one with its bite and two with its claws."] }],
      legendary: [{ name: "Detect", entries: ["The dragon makes a Wisdom (Perception) check."] }],
      legendary_actions: 3,
      legendary_resistance: 3,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run monster schema tests to verify they fail**

Run: `npx vitest run tests/monster-schema.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement monster schema**

```typescript
// src/ai/schemas/monster-schema.ts
import { z } from "zod";

const abilitiesSchema = z.object({
  str: z.number().min(1).max(30),
  dex: z.number().min(1).max(30),
  con: z.number().min(1).max(30),
  int: z.number().min(1).max(30),
  wis: z.number().min(1).max(30),
  cha: z.number().min(1).max(30),
});

const acSchema = z.object({
  ac: z.number(),
  from: z.array(z.string()).optional(),
  condition: z.string().optional(),
});

const hpSchema = z.object({
  average: z.number(),
  formula: z.string(),
});

const speedSchema = z.object({
  walk: z.number().optional(),
  fly: z.number().optional(),
  swim: z.number().optional(),
  climb: z.number().optional(),
  burrow: z.number().optional(),
});

const featureSchema = z.object({
  name: z.string(),
  entries: z.array(z.string()),
});

export const monsterInputSchema = z.object({
  name: z.string().describe("Monster name"),
  size: z.enum(["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"]),
  type: z.string().describe("Creature type (e.g., aberration, beast, dragon)"),
  subtype: z.string().optional(),
  alignment: z.string(),
  cr: z.string().describe('Challenge rating (e.g., "0", "1/8", "1/4", "1/2", "1" through "30")'),
  abilities: abilitiesSchema,
  ac: z.array(acSchema),
  hp: hpSchema,
  speed: speedSchema,
  saves: z.record(z.string(), z.number()).optional(),
  skills: z.record(z.string(), z.number()).optional(),
  damage_vulnerabilities: z.array(z.string()).optional(),
  damage_resistances: z.array(z.string()).optional(),
  damage_immunities: z.array(z.string()).optional(),
  condition_immunities: z.array(z.string()).optional(),
  senses: z.array(z.string()).optional(),
  passive_perception: z.number().optional(),
  languages: z.array(z.string()).optional(),
  traits: z.array(featureSchema).optional(),
  actions: z.array(featureSchema).optional(),
  reactions: z.array(featureSchema).optional(),
  legendary: z.array(featureSchema).optional(),
  legendary_actions: z.number().optional(),
  legendary_resistance: z.number().optional(),
});

/** The raw Zod shape for use with Agent SDK tool() */
export const monsterToolInput = { monster: monsterInputSchema };
```

- [ ] **Step 4: Run monster schema tests**

Run: `npx vitest run tests/monster-schema.test.ts`
Expected: All pass

- [ ] **Step 5: Implement spell schema**

```typescript
// src/ai/schemas/spell-schema.ts
import { z } from "zod";

export const spellInputSchema = z.object({
  name: z.string().describe("Spell name"),
  level: z.number().min(0).max(9).describe("Spell level (0 for cantrips)"),
  school: z.enum([
    "abjuration", "conjuration", "divination", "enchantment",
    "evocation", "illusion", "necromancy", "transmutation",
  ]),
  casting_time: z.string().describe('e.g., "1 action", "1 bonus action"'),
  range: z.string().describe('e.g., "Touch", "120 feet", "Self"'),
  components: z.string().describe('e.g., "V, S", "V, S, M (diamond worth 100 gp)"'),
  duration: z.string().describe('e.g., "Instantaneous", "Concentration, up to 1 minute"'),
  description: z.array(z.string()).describe("Spell description paragraphs"),
  at_higher_levels: z.array(z.string()).optional(),
  classes: z.array(z.string()).optional(),
  ritual: z.boolean().optional(),
  concentration: z.boolean().optional(),
});

export const spellToolInput = { spell: spellInputSchema };
```

- [ ] **Step 6: Write and run spell schema tests**

```typescript
// tests/spell-schema.test.ts
import { describe, it, expect } from "vitest";
import { spellInputSchema } from "../src/ai/schemas/spell-schema";

describe("spellInputSchema", () => {
  it("validates a valid spell", () => {
    const result = spellInputSchema.safeParse({
      name: "Fireball",
      level: 3,
      school: "evocation",
      casting_time: "1 action",
      range: "150 feet",
      components: "V, S, M (a tiny ball of bat guano and sulfur)",
      duration: "Instantaneous",
      description: ["A bright streak flashes from your pointing finger."],
    });
    expect(result.success).toBe(true);
  });

  it("rejects level above 9", () => {
    const result = spellInputSchema.safeParse({
      name: "Test",
      level: 10,
      school: "evocation",
      casting_time: "1 action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      description: ["Test"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid school", () => {
    const result = spellInputSchema.safeParse({
      name: "Test",
      level: 1,
      school: "pyromancy",
      casting_time: "1 action",
      range: "Self",
      components: "V",
      duration: "Instantaneous",
      description: ["Test"],
    });
    expect(result.success).toBe(false);
  });
});
```

Run: `npx vitest run tests/spell-schema.test.ts`
Expected: All pass

- [ ] **Step 7: Implement item schema**

```typescript
// src/ai/schemas/item-schema.ts
import { z } from "zod";

export const itemInputSchema = z.object({
  name: z.string().describe("Item name"),
  type: z.enum([
    "weapon", "armor", "potion", "ring", "rod",
    "scroll", "staff", "wand", "wondrous item", "shield",
  ]),
  rarity: z.enum(["common", "uncommon", "rare", "very rare", "legendary", "artifact"]),
  entries: z.array(z.string()).optional().describe("Item description and properties"),
  weight: z.number().optional(),
  value: z.number().optional(),
  attunement: z.union([z.boolean(), z.string()]).optional(),
  // Weapon props
  properties: z.array(z.string()).optional(),
  damage: z.string().optional(),
  damage_type: z.string().optional(),
  // Armor props
  ac: z.number().optional(),
  // Magic props
  charges: z.number().optional(),
  recharge: z.string().optional(),
  curse: z.boolean().optional(),
});

export const itemToolInput = { item: itemInputSchema };
```

- [ ] **Step 8: Write and run item schema tests**

```typescript
// tests/item-schema.test.ts
import { describe, it, expect } from "vitest";
import { itemInputSchema } from "../src/ai/schemas/item-schema";

describe("itemInputSchema", () => {
  it("validates a valid item", () => {
    const result = itemInputSchema.safeParse({
      name: "Flame Tongue",
      type: "weapon",
      rarity: "rare",
      attunement: true,
      entries: ["When you attack with this magic sword and roll a 20 on the attack roll, that target takes an extra 2d6 fire damage."],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid rarity", () => {
    const result = itemInputSchema.safeParse({
      name: "Test",
      type: "weapon",
      rarity: "mythic",
    });
    expect(result.success).toBe(false);
  });

  it("accepts string attunement", () => {
    const result = itemInputSchema.safeParse({
      name: "Test",
      type: "wondrous item",
      rarity: "rare",
      attunement: "by a spellcaster",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attunement).toBe("by a spellcaster");
    }
  });
});
```

Run: `npx vitest run tests/item-schema.test.ts`
Expected: All pass

- [ ] **Step 9: Implement encounter schema**

```typescript
// src/ai/schemas/encounter-schema.ts
import { z } from "zod";

export const encounterInputSchema = z.object({
  party_size: z.number().min(1).max(10).describe("Number of players"),
  party_level: z.number().min(1).max(20).describe("Average party level"),
  difficulty: z.enum(["easy", "medium", "hard", "deadly"]),
  environment: z.string().optional().describe('e.g., "swamp", "dungeon", "forest"'),
  theme: z.string().optional().describe('e.g., "undead horde", "dragon lair"'),
});

const encounterMonsterSchema = z.object({
  name: z.string(),
  cr: z.string(),
  count: z.number(),
  role: z.string(),
});

export const encounterOutputSchema = z.object({
  monsters: z.array(encounterMonsterSchema),
  tactics: z.string(),
  terrain: z.string(),
  notes: z.string(),
  xp_budget: z.object({
    target: z.number(),
    actual: z.number(),
    difficulty_rating: z.string(),
  }),
});

export const encounterToolInput = { encounter: encounterInputSchema };
```

- [ ] **Step 10: Write and run encounter schema test**

```typescript
// tests/encounter-schema.test.ts
import { describe, it, expect } from "vitest";
import { encounterInputSchema, encounterOutputSchema } from "../src/ai/schemas/encounter-schema";

describe("encounterInputSchema", () => {
  it("validates valid encounter input", () => {
    const result = encounterInputSchema.safeParse({
      party_size: 4,
      party_level: 5,
      difficulty: "medium",
      environment: "forest",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid difficulty", () => {
    const result = encounterInputSchema.safeParse({
      party_size: 4,
      party_level: 5,
      difficulty: "impossible",
    });
    expect(result.success).toBe(false);
  });
});

describe("encounterOutputSchema", () => {
  it("validates valid encounter output", () => {
    const result = encounterOutputSchema.safeParse({
      monsters: [{ name: "Goblin", cr: "1/4", count: 6, role: "minion" }],
      tactics: "Goblins use hit-and-run tactics.",
      terrain: "Dense forest with fallen logs for cover.",
      notes: "Consider adding a goblin boss if party is strong.",
      xp_budget: { target: 500, actual: 450, difficulty_rating: "medium" },
    });
    expect(result.success).toBe(true);
  });
});
```

Run: `npx vitest run tests/encounter-schema.test.ts`
Expected: All pass

- [ ] **Step 11: Implement NPC schema**

```typescript
// src/ai/schemas/npc-schema.ts
import { z } from "zod";

export const npcInputSchema = z.object({
  role: z.string().optional().describe('e.g., "tavern keeper", "guard captain"'),
  race: z.string().optional().describe('e.g., "human", "elf", "dwarf"'),
  context: z.string().optional().describe('e.g., "works in the thieves guild in Valdros"'),
});

export const npcOutputSchema = z.object({
  name: z.string(),
  race: z.string(),
  role: z.string(),
  personality: z.string(),
  motivation: z.string(),
  secrets: z.string(),
  appearance: z.string(),
  voice: z.string(),
  connections: z.string(),
});

export const npcToolInput = { npc: npcInputSchema };
```

- [ ] **Step 12: Implement SRD schemas**

```typescript
// src/ai/schemas/srd-schema.ts
import { z } from "zod";

export const searchSrdInput = {
  query: z.string().describe("Name or partial name to search"),
  entity_type: z.enum(["monster", "spell", "item"]).optional().describe("Filter by entity type"),
  cr_min: z.string().optional().describe("Minimum CR (monsters only)"),
  cr_max: z.string().optional().describe("Maximum CR (monsters only)"),
  level_min: z.number().optional().describe("Minimum level (spells only)"),
  level_max: z.number().optional().describe("Maximum level (spells only)"),
  school: z.string().optional().describe("Spell school filter"),
  rarity: z.string().optional().describe("Item rarity filter"),
  limit: z.number().min(1).max(20).default(5).describe("Max results"),
};

export const getSrdEntityInput = {
  name: z.string().describe("Exact or close-match entity name"),
  entity_type: z.enum(["monster", "spell", "item"]).describe("Entity type"),
};
```

- [ ] **Step 13: Run full test suite**

Run: `npm test`
Expected: All existing + new tests pass

- [ ] **Step 14: Commit**

```bash
git add src/ai/schemas/ tests/monster-schema.test.ts tests/spell-schema.test.ts tests/item-schema.test.ts tests/encounter-schema.test.ts
git commit -m "feat(inquiry): add Zod schemas for all entity generation tools"
```

---

### Task 5: SRD Data Store

**Files:**
- Create: `src/data/srd-monsters.json`
- Create: `src/data/srd-spells.json`
- Create: `src/data/srd-items.json`
- Create: `src/ai/srd/srd-store.ts`
- Create: `tests/srd-store.test.ts`

The SRD JSON data comes from the 5e-bits/5e-database project (CC BY 4.0 licensed). We need to download and transform it to match our type interfaces.

- [ ] **Step 1: Create a script to download and transform SRD data**

```bash
# Create a temporary script to fetch and transform SRD data
# The 5e-database API provides JSON at https://www.dnd5eapi.co/api/
# We'll fetch all monsters, spells, and items and save as JSON

mkdir -p src/data

# Download raw SRD data from 5e-database GitHub releases
# (These URLs point to the raw JSON files from the 5e-bits/5e-database repo)
```

Write a Node.js script at `scripts/fetch-srd.mjs` that:
1. Fetches monster data from `https://www.dnd5eapi.co/api/monsters` (full list) then each individual monster
2. Transforms to our Monster interface format (snake_case fields)
3. Saves to `src/data/srd-monsters.json`
4. Does the same for spells and items

```javascript
// scripts/fetch-srd.mjs
import { writeFileSync } from "fs";

const API = "https://www.dnd5eapi.co/api";

async function fetchAll(endpoint) {
  const list = await fetch(`${API}/${endpoint}`).then(r => r.json());
  const results = [];
  for (const item of list.results) {
    const full = await fetch(`${API}/${endpoint}/${item.index}`).then(r => r.json());
    results.push(full);
  }
  return results;
}

function transformMonster(m) {
  return {
    name: m.name,
    size: m.size,
    type: m.type,
    subtype: m.subtype || undefined,
    alignment: m.alignment,
    cr: String(m.challenge_rating),
    ac: m.armor_class?.map(a => ({ ac: a.value, from: a.armor?.map(ar => ar.name) })) ?? [],
    hp: { average: m.hit_points, formula: m.hit_points_roll || "" },
    speed: {
      walk: parseInt(m.speed?.walk) || undefined,
      fly: parseInt(m.speed?.fly) || undefined,
      swim: parseInt(m.speed?.swim) || undefined,
      climb: parseInt(m.speed?.climb) || undefined,
      burrow: parseInt(m.speed?.burrow) || undefined,
    },
    abilities: {
      str: m.strength, dex: m.dexterity, con: m.constitution,
      int: m.intelligence, wis: m.wisdom, cha: m.charisma,
    },
    saves: Object.fromEntries(
      (m.proficiencies || [])
        .filter(p => p.proficiency.index.startsWith("saving-throw-"))
        .map(p => [p.proficiency.index.replace("saving-throw-", ""), p.value])
    ) || undefined,
    skills: Object.fromEntries(
      (m.proficiencies || [])
        .filter(p => p.proficiency.index.startsWith("skill-"))
        .map(p => [p.proficiency.name.replace("Skill: ", ""), p.value])
    ) || undefined,
    damage_vulnerabilities: m.damage_vulnerabilities?.length ? m.damage_vulnerabilities : undefined,
    damage_resistances: m.damage_resistances?.length ? m.damage_resistances : undefined,
    damage_immunities: m.damage_immunities?.length ? m.damage_immunities : undefined,
    condition_immunities: m.condition_immunities?.map(c => c.name) ?? undefined,
    senses: Object.entries(m.senses || {})
      .filter(([k]) => k !== "passive_perception")
      .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`)
      .filter(s => s.trim()),
    passive_perception: m.senses?.passive_perception,
    languages: m.languages ? m.languages.split(", ").filter(Boolean) : undefined,
    traits: m.special_abilities?.map(a => ({ name: a.name, entries: [a.desc] })),
    actions: m.actions?.map(a => ({ name: a.name, entries: [a.desc] })),
    reactions: m.reactions?.map(a => ({ name: a.name, entries: [a.desc] })),
    legendary: m.legendary_actions?.map(a => ({ name: a.name, entries: [a.desc] })),
  };
}

function transformSpell(s) {
  return {
    name: s.name,
    level: s.level,
    school: s.school?.name?.toLowerCase(),
    casting_time: s.casting_time,
    range: s.range,
    components: s.components?.join(", ") + (s.material ? ` (${s.material})` : ""),
    duration: s.duration,
    concentration: s.concentration,
    ritual: s.ritual,
    classes: s.classes?.map(c => c.name),
    description: s.desc || [],
    at_higher_levels: s.higher_level?.length ? s.higher_level : undefined,
  };
}

function transformItem(i) {
  return {
    name: i.name,
    type: i.equipment_category?.name?.toLowerCase() || "wondrous item",
    rarity: i.rarity?.name?.toLowerCase() || "common",
    entries: i.desc || [],
    weight: i.weight || undefined,
    attunement: false,
  };
}

console.log("Fetching monsters...");
const monsters = await fetchAll("monsters");
writeFileSync("src/data/srd-monsters.json", JSON.stringify(monsters.map(transformMonster), null, 2));
console.log(`Saved ${monsters.length} monsters`);

console.log("Fetching spells...");
const spells = await fetchAll("spells");
writeFileSync("src/data/srd-spells.json", JSON.stringify(spells.map(transformSpell), null, 2));
console.log(`Saved ${spells.length} spells`);

console.log("Fetching magic items...");
const items = await fetchAll("magic-items");
writeFileSync("src/data/srd-items.json", JSON.stringify(items.map(transformItem), null, 2));
console.log(`Saved ${items.length} items`);
```

Run: `node scripts/fetch-srd.mjs`
Expected: Three JSON files created in `src/data/`

Note: This script makes many HTTP requests and may take a few minutes. If the API is slow or rate-limited, the implementer may need to add delays or use a cached data source.

- [ ] **Step 2: Write SRD store tests**

```typescript
// tests/srd-store.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { SrdStore } from "../src/ai/srd/srd-store";

// Use a minimal test fixture instead of full SRD data
const TEST_MONSTERS = [
  { name: "Goblin", size: "Small", type: "Humanoid", cr: "1/4" },
  { name: "Red Dragon", size: "Huge", type: "Dragon", cr: "17" },
  { name: "Goblin Boss", size: "Small", type: "Humanoid", cr: "1" },
];

const TEST_SPELLS = [
  { name: "Fireball", level: 3, school: "evocation" },
  { name: "Fire Bolt", level: 0, school: "evocation" },
  { name: "Shield", level: 1, school: "abjuration" },
];

const TEST_ITEMS = [
  { name: "Flame Tongue", type: "weapon", rarity: "rare" },
  { name: "Ring of Protection", type: "ring", rarity: "rare" },
];

describe("SrdStore", () => {
  let store: SrdStore;

  beforeAll(() => {
    store = new SrdStore();
    store.loadFromArrays(TEST_MONSTERS as any[], TEST_SPELLS as any[], TEST_ITEMS as any[]);
  });

  it("searches monsters by name", () => {
    const results = store.search("goblin", "monster", 10);
    expect(results.length).toBe(2);
    expect(results[0].name).toBe("Goblin");
  });

  it("searches spells by name", () => {
    const results = store.search("fire", "spell", 10);
    expect(results.length).toBe(2);
  });

  it("searches items by name", () => {
    const results = store.search("flame", "item", 10);
    expect(results.length).toBe(1);
    expect(results[0].name).toBe("Flame Tongue");
  });

  it("searches across all types when no type filter", () => {
    const results = store.search("fire", undefined, 10);
    expect(results.length).toBe(3); // Fireball, Fire Bolt, Flame Tongue
  });

  it("respects limit", () => {
    const results = store.search("goblin", "monster", 1);
    expect(results.length).toBe(1);
  });

  it("gets entity by exact name", () => {
    const result = store.getByName("Goblin", "monster");
    expect(result).toBeDefined();
    expect(result!.name).toBe("Goblin");
  });

  it("returns null for unknown entity", () => {
    const result = store.getByName("Nonexistent", "monster");
    expect(result).toBeNull();
  });

  it("does case-insensitive search", () => {
    const results = store.search("RED DRAGON", "monster", 10);
    expect(results.length).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/srd-store.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 4: Implement SRD store**

```typescript
// src/ai/srd/srd-store.ts
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
        // Exact match first, then starts-with, then includes
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;
        if (aName.startsWith(q) && !bName.startsWith(q)) return -1;
        if (bName.startsWith(q) && !aName.startsWith(q)) return 1;
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
```

- [ ] **Step 5: Run SRD store tests**

Run: `npx vitest run tests/srd-store.test.ts`
Expected: All pass

- [ ] **Step 6: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/ai/srd/ src/data/ tests/srd-store.test.ts scripts/fetch-srd.mjs
git commit -m "feat(inquiry): add SRD data store with bundled JSON and search"
```

---

### Task 6: MCP Tools -- Generation & SRD

**Files:**
- Create: `src/ai/tools/generation-tools.ts`
- Create: `src/ai/tools/srd-tools.ts`
- Create: `src/ai/mcp-server.ts`

These files define the 7 MCP tools using the Agent SDK's `tool()` helper and register them in a server via `createSdkMcpServer()`.

- [ ] **Step 1: Implement generation tools**

```typescript
// src/ai/tools/generation-tools.ts
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { monsterInputSchema } from "../schemas/monster-schema";
import { spellInputSchema } from "../schemas/spell-schema";
import { itemInputSchema } from "../schemas/item-schema";
import { encounterInputSchema } from "../schemas/encounter-schema";
import { npcInputSchema } from "../schemas/npc-schema";
import { enrichMonster, enrichSpell, enrichItem } from "../validation/entity-enrichment";

export const generateMonsterTool = tool(
  "generate_monster",
  "Generate a D&D 5e monster stat block. Returns a validated and enriched monster object with auto-calculated XP, proficiency bonus, and ability modifiers. The stat block will be rendered visually in the chat.",
  { monster: monsterInputSchema },
  async ({ monster }) => {
    const enriched = enrichMonster(monster as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ type: "monster", data: enriched }) }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateSpellTool = tool(
  "generate_spell",
  "Generate a D&D 5e spell. Returns a validated spell object with auto-detected concentration and default classes. The spell will be rendered visually in the chat.",
  { spell: spellInputSchema },
  async ({ spell }) => {
    const enriched = enrichSpell(spell as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ type: "spell", data: enriched }) }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateItemTool = tool(
  "generate_item",
  "Generate a D&D 5e magic item. Returns a validated item object with normalized attunement and source fields. The item will be rendered visually in the chat.",
  { item: itemInputSchema },
  async ({ item }) => {
    const enriched = enrichItem(item as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ type: "item", data: enriched }) }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateEncounterTool = tool(
  "generate_encounter",
  "Generate a balanced D&D 5e encounter for a party. Provide party size, level, and difficulty. Returns a list of monsters with tactical suggestions. You must fill in the monster details based on SRD data or your knowledge.",
  { encounter: encounterInputSchema },
  async ({ encounter }) => {
    // The encounter tool just validates the input and returns it.
    // The AI fills in the actual monsters, tactics, etc. as part of its response.
    // This tool serves as a structured signal that the AI is building an encounter.
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          type: "encounter",
          params: encounter,
        }),
      }],
    };
  },
  { annotations: { readOnlyHint: true } },
);

export const generateNpcTool = tool(
  "generate_npc",
  "Generate a D&D NPC with personality, motivation, secrets, appearance, and voice notes. Returns structured NPC data. A note file will be created in the TTRPG directory.",
  { npc: npcInputSchema },
  async ({ npc }) => {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ type: "npc", params: npc }),
      }],
    };
  },
  { annotations: { readOnlyHint: true } },
);
```

- [ ] **Step 2: Implement SRD tools**

```typescript
// src/ai/tools/srd-tools.ts
import { tool } from "@anthropic-ai/claude-agent-sdk";
import { searchSrdInput, getSrdEntityInput } from "../schemas/srd-schema";
import type { SrdStore } from "../srd/srd-store";

/** Factory: creates SRD tools bound to a store instance */
export function createSrdTools(store: SrdStore) {
  const searchSrdTool = tool(
    "search_srd",
    "Search the D&D 5e SRD database for monsters, spells, or magic items by name. Returns summary results.",
    searchSrdInput,
    async ({ query, entity_type, limit }) => {
      const results = store.search(query, entity_type as any, limit);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(results) }],
      };
    },
    { annotations: { readOnlyHint: true } },
  );

  const getSrdEntityTool = tool(
    "get_srd_entity",
    "Get complete details for a specific D&D 5e SRD entity by exact name. Returns the full stat block / spell / item data.",
    getSrdEntityInput,
    async ({ name, entity_type }) => {
      const entity = store.getByName(name, entity_type as any);
      if (!entity) {
        return {
          content: [{ type: "text" as const, text: `Entity "${name}" not found in SRD.` }],
          isError: true,
        };
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify(entity) }],
      };
    },
    { annotations: { readOnlyHint: true } },
  );

  return { searchSrdTool, getSrdEntityTool };
}
```

- [ ] **Step 3: Implement MCP server factory**

```typescript
// src/ai/mcp-server.ts
import { createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import {
  generateMonsterTool,
  generateSpellTool,
  generateItemTool,
  generateEncounterTool,
  generateNpcTool,
} from "./tools/generation-tools";
import { createSrdTools } from "./tools/srd-tools";
import type { SrdStore } from "./srd/srd-store";

export function createArchivistMcpServer(srdStore: SrdStore) {
  const { searchSrdTool, getSrdEntityTool } = createSrdTools(srdStore);

  return createSdkMcpServer({
    name: "archivist",
    version: "1.0.0",
    tools: [
      generateMonsterTool,
      generateSpellTool,
      generateItemTool,
      generateEncounterTool,
      generateNpcTool,
      searchSrdTool,
      getSrdEntityTool,
    ],
  });
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/ai/tools/ src/ai/mcp-server.ts
git commit -m "feat(inquiry): add MCP tools for entity generation and SRD access"
```

---

### Task 7: System Prompt Builder

**Files:**
- Create: `src/ai/system-prompt.ts`

- [ ] **Step 1: Implement system prompt builder**

```typescript
// src/ai/system-prompt.ts
export interface SystemPromptContext {
  ttrpgRootDir: string;
  currentNotePath?: string;
  currentNoteContent?: string;
  selectedText?: string;
}

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts: string[] = [];

  parts.push(`You are the Archivist, a wise owl assistant for D&D 5e campaign management.

PERSONA:
- Communicate as a scholarly owl. No physical action descriptions.
- Stay strictly scoped to D&D and TTRPG topics.
- Be helpful, knowledgeable, and concise.

VAULT SCOPE:
- Your file operations are limited to: ${ctx.ttrpgRootDir}
- Documents in this directory are the PRIMARY source of truth for this campaign.
- Always search within this directory first before using your training knowledge.
- Do not read or modify files outside this directory.

TOOLS:
- For structured stat blocks: use mcp__archivist__generate_monster, mcp__archivist__generate_spell, mcp__archivist__generate_item tools
- For encounter building: use mcp__archivist__generate_encounter tool
- For NPC creation: use mcp__archivist__generate_npc tool (then create a note file with Write)
- For SRD reference: use mcp__archivist__search_srd and mcp__archivist__get_srd_entity tools
- For vault search: use your built-in Grep, Glob, Read tools within ${ctx.ttrpgRootDir}
- For creating notes: use your built-in Write tool within ${ctx.ttrpgRootDir}

GENERATION RULES:
- When generating a stat block, the block IS the response. Do not add redundant text describing what is already visible in the block.
- When generating text content (tavern descriptions, NPC backstories, session prep), write rich descriptive markdown.
- When creating notes, include YAML frontmatter with type, name, and tags.
- Include wiki-links ([[Note Name]]) to existing vault notes when relevant.
- Stop after 7 tool calls to avoid loops.

BEHAVIOR:
- If asked about something in the campaign, search the vault first.
- If vault has no relevant info, use your D&D 5e training knowledge.
- When referencing SRD content, use search_srd/get_srd_entity for accuracy.
- For homebrew content, make it balanced and consistent with 5e design principles.`);

  if (ctx.currentNotePath) {
    parts.push(`\nCONTEXT -- CURRENT NOTE: ${ctx.currentNotePath}`);
    if (ctx.currentNoteContent) {
      parts.push(`\`\`\`markdown\n${ctx.currentNoteContent}\n\`\`\``);
    }
  }

  if (ctx.selectedText) {
    parts.push(`\nCONTEXT -- SELECTED TEXT:\n\`\`\`\n${ctx.selectedText}\n\`\`\``);
  }

  return parts.join("\n");
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/ai/system-prompt.ts
git commit -m "feat(inquiry): add system prompt builder with vault scoping"
```

---

### Task 8: Agent Service -- SDK Integration

**Files:**
- Create: `src/ai/agent-service.ts`

This wraps the Agent SDK's `query()` function and provides a clean interface for the UI layer to send messages and receive streaming responses.

- [ ] **Step 1: Implement agent service**

```typescript
// src/ai/agent-service.ts
import type { SrdStore } from "./srd/srd-store";
import type { ArchivistSettings } from "../types/settings";
import { buildSystemPrompt, type SystemPromptContext } from "./system-prompt";
import { createArchivistMcpServer } from "./mcp-server";

export interface StreamEvent {
  type: "text" | "tool_call" | "tool_result" | "error" | "done";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  isError?: boolean;
  /** For generation tool results that should render as stat blocks */
  generatedEntity?: { type: string; data: unknown };
  /** Final result metadata */
  totalCostUsd?: number;
  numTurns?: number;
}

export class AgentService {
  private srdStore: SrdStore;
  private mcpServer: ReturnType<typeof createArchivistMcpServer> | null = null;
  private activeQuery: any = null;
  private abortController: AbortController | null = null;

  constructor(srdStore: SrdStore) {
    this.srdStore = srdStore;
  }

  isAvailable(): boolean {
    try {
      require.resolve("@anthropic-ai/claude-agent-sdk");
      return true;
    } catch {
      return false;
    }
  }

  async *sendMessage(
    message: string,
    settings: ArchivistSettings,
    context: SystemPromptContext,
    model?: string,
  ): AsyncGenerator<StreamEvent> {
    // Dynamically import to handle case where SDK is not installed
    const { query } = await import("@anthropic-ai/claude-agent-sdk");

    if (!this.mcpServer) {
      this.mcpServer = createArchivistMcpServer(this.srdStore);
    }

    this.abortController = new AbortController();

    const systemPrompt = buildSystemPrompt(context);
    const permissionMode = settings.permissionMode === "auto"
      ? "acceptEdits" as const
      : "default" as const;

    const selectedModel = model ?? settings.defaultModel;

    this.activeQuery = query({
      prompt: message,
      options: {
        systemPrompt,
        model: selectedModel,
        cwd: context.ttrpgRootDir === "/" ? undefined : context.ttrpgRootDir,
        permissionMode,
        mcpServers: { archivist: this.mcpServer },
        allowedTools: ["mcp__archivist__*"],
        abortController: this.abortController,
        maxTurns: 15,
        includePartialMessages: true,
      },
    });

    try {
      for await (const msg of this.activeQuery) {
        if (msg.type === "assistant") {
          for (const block of msg.message.content) {
            if ("text" in block && block.text) {
              yield { type: "text", content: block.text };
            }
            if ("name" in block) {
              yield {
                type: "tool_call",
                toolName: block.name,
                toolInput: block.input as Record<string, unknown>,
              };
            }
          }
        } else if (msg.type === "result") {
          if (msg.subtype === "success") {
            yield {
              type: "done",
              totalCostUsd: msg.total_cost_usd,
              numTurns: msg.num_turns,
            };
          } else {
            yield {
              type: "error",
              content: (msg as any).errors?.join(", ") ?? "Unknown error",
              isError: true,
            };
          }
        } else if (msg.type === "stream_event") {
          const event = (msg as any).event;
          if (event?.type === "content_block_delta" && event?.delta?.type === "text_delta") {
            yield { type: "text", content: event.delta.text };
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        yield {
          type: "error",
          content: (err as Error).message ?? "Stream error",
          isError: true,
        };
      }
    } finally {
      this.activeQuery = null;
      this.abortController = null;
    }
  }

  abort(): void {
    this.abortController?.abort();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/ai/agent-service.ts
git commit -m "feat(inquiry): add agent service wrapping Claude Code SDK"
```

---

### Task 9: Conversation Manager

**Files:**
- Create: `src/ai/conversation-manager.ts`
- Create: `tests/conversation-manager.test.ts`

- [ ] **Step 1: Write conversation manager tests**

```typescript
// tests/conversation-manager.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { ConversationManager } from "../src/ai/conversation-manager";
import type { ConversationStore } from "../src/types/conversation";

describe("ConversationManager", () => {
  let manager: ConversationManager;
  let savedData: ConversationStore | null = null;

  beforeEach(() => {
    savedData = null;
    manager = new ConversationManager(
      async () => savedData,
      async (data) => { savedData = data; },
    );
  });

  it("creates a new conversation", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    expect(conv.id).toBeDefined();
    expect(conv.title).toBe("New conversation");
    expect(conv.messages).toEqual([]);
  });

  it("adds a message to a conversation", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    await manager.addMessage(conv.id, {
      id: "msg-1",
      role: "user",
      content: "Generate a dragon",
      timestamp: new Date().toISOString(),
    });

    const updated = manager.getConversation(conv.id);
    expect(updated?.messages.length).toBe(1);
    expect(updated?.messages[0].content).toBe("Generate a dragon");
  });

  it("auto-titles from first user message", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    await manager.addMessage(conv.id, {
      id: "msg-1",
      role: "user",
      content: "Generate a CR 5 fire dragon for my volcanic lair encounter",
      timestamp: new Date().toISOString(),
    });

    const updated = manager.getConversation(conv.id);
    expect(updated?.title).toBe("Generate a CR 5 fire dragon for my v...");
  });

  it("lists conversations sorted by updatedAt", async () => {
    const c1 = await manager.createConversation("claude-sonnet-4-6");
    const c2 = await manager.createConversation("claude-sonnet-4-6");
    await manager.addMessage(c1.id, {
      id: "msg-1",
      role: "user",
      content: "First",
      timestamp: new Date().toISOString(),
    });

    const list = manager.listConversations();
    expect(list[0].id).toBe(c1.id); // c1 was updated more recently
  });

  it("deletes a conversation", async () => {
    const conv = await manager.createConversation("claude-sonnet-4-6");
    await manager.deleteConversation(conv.id);

    expect(manager.getConversation(conv.id)).toBeUndefined();
  });

  it("manages open tabs", async () => {
    const c1 = await manager.createConversation("claude-sonnet-4-6");
    const c2 = await manager.createConversation("claude-sonnet-4-6");

    manager.openTab(c1.id);
    manager.openTab(c2.id);
    expect(manager.getOpenTabs()).toEqual([c1.id, c2.id]);

    manager.closeTab(c1.id);
    expect(manager.getOpenTabs()).toEqual([c2.id]);
  });

  it("enforces max conversations", async () => {
    const mgr = new ConversationManager(
      async () => savedData,
      async (data) => { savedData = data; },
      2, // maxConversations
    );

    await mgr.createConversation("claude-sonnet-4-6");
    await mgr.createConversation("claude-sonnet-4-6");
    await mgr.createConversation("claude-sonnet-4-6");

    const list = mgr.listConversations();
    expect(list.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/conversation-manager.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement conversation manager**

```typescript
// src/ai/conversation-manager.ts
import type { Conversation, ConversationStore, Message } from "../types/conversation";
import { EMPTY_STORE } from "../types/conversation";

function generateId(): string {
  return "conv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function truncateTitle(text: string, maxLen = 40): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

export class ConversationManager {
  private store: ConversationStore;
  private loadFn: () => Promise<ConversationStore | null>;
  private saveFn: (store: ConversationStore) => Promise<void>;
  private maxConversations: number;

  constructor(
    loadFn: () => Promise<ConversationStore | null>,
    saveFn: (store: ConversationStore) => Promise<void>,
    maxConversations = 50,
  ) {
    this.loadFn = loadFn;
    this.saveFn = saveFn;
    this.maxConversations = maxConversations;
    this.store = { ...EMPTY_STORE };
  }

  async load(): Promise<void> {
    const data = await this.loadFn();
    if (data) {
      this.store = data;
    }
  }

  private async save(): Promise<void> {
    await this.saveFn(this.store);
  }

  async createConversation(model: string): Promise<Conversation> {
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: generateId(),
      title: "New conversation",
      createdAt: now,
      updatedAt: now,
      model,
      messages: [],
    };

    this.store.conversations[conv.id] = conv;
    this.enforceMax();
    await this.save();
    return conv;
  }

  async addMessage(conversationId: string, message: Message): Promise<void> {
    const conv = this.store.conversations[conversationId];
    if (!conv) return;

    conv.messages.push(message);
    conv.updatedAt = new Date().toISOString();

    // Auto-title from first user message
    if (message.role === "user" && conv.title === "New conversation") {
      conv.title = truncateTitle(message.content);
    }

    await this.save();
  }

  getConversation(id: string): Conversation | undefined {
    return this.store.conversations[id];
  }

  listConversations(): Conversation[] {
    return Object.values(this.store.conversations)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async deleteConversation(id: string): Promise<void> {
    delete this.store.conversations[id];
    this.store.openTabs = this.store.openTabs.filter((t) => t !== id);
    if (this.store.activeConversationId === id) {
      this.store.activeConversationId = this.store.openTabs[0] ?? null;
    }
    await this.save();
  }

  // Tab management
  openTab(id: string): void {
    if (!this.store.openTabs.includes(id)) {
      this.store.openTabs.push(id);
    }
    this.store.activeConversationId = id;
  }

  closeTab(id: string): void {
    this.store.openTabs = this.store.openTabs.filter((t) => t !== id);
    if (this.store.activeConversationId === id) {
      this.store.activeConversationId = this.store.openTabs[0] ?? null;
    }
  }

  getOpenTabs(): string[] {
    return [...this.store.openTabs];
  }

  getActiveConversationId(): string | null {
    return this.store.activeConversationId;
  }

  setActiveTab(id: string): void {
    if (this.store.openTabs.includes(id)) {
      this.store.activeConversationId = id;
    }
  }

  getStore(): ConversationStore {
    return this.store;
  }

  private enforceMax(): void {
    const convs = this.listConversations();
    if (convs.length > this.maxConversations) {
      const toDelete = convs.slice(this.maxConversations);
      for (const c of toDelete) {
        delete this.store.conversations[c.id];
        this.store.openTabs = this.store.openTabs.filter((t) => t !== c.id);
      }
    }
  }
}
```

- [ ] **Step 4: Run conversation manager tests**

Run: `npx vitest run tests/conversation-manager.test.ts`
Expected: All pass

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/ai/conversation-manager.ts tests/conversation-manager.test.ts
git commit -m "feat(inquiry): add conversation manager with persistence and tab state"
```

---

### Task 10: Plugin Settings Tab

**Files:**
- Create: `src/settings/settings-tab.ts`

- [ ] **Step 1: Implement settings tab**

```typescript
// src/settings/settings-tab.ts
import { App, PluginSettingTab, Setting } from "obsidian";
import type ArchivistPlugin from "../main";
import type { ArchivistSettings } from "../types/settings";

export class ArchivistSettingTab extends PluginSettingTab {
  plugin: ArchivistPlugin;

  constructor(app: App, plugin: ArchivistPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Archivist Inquiry" });

    new Setting(containerEl)
      .setName("TTRPG Root Directory")
      .setDesc("Scope AI vault access to this directory. Leave as / for entire vault.")
      .addText((text) =>
        text
          .setPlaceholder("/")
          .setValue(this.plugin.settings.ttrpgRootDir)
          .onChange(async (value) => {
            this.plugin.settings.ttrpgRootDir = value || "/";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Permission Mode")
      .setDesc("Auto: auto-approve tool calls. Safe: require approval for writes.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("safe", "Safe")
          .addOption("auto", "Auto")
          .setValue(this.plugin.settings.permissionMode)
          .onChange(async (value) => {
            this.plugin.settings.permissionMode = value as "auto" | "safe";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default Model")
      .setDesc("Model used for new conversations.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("claude-sonnet-4-6", "Sonnet 4")
          .addOption("claude-opus-4-6", "Opus 4")
          .addOption("claude-haiku-4-5-20251001", "Haiku 4")
          .setValue(this.plugin.settings.defaultModel)
          .onChange(async (value) => {
            this.plugin.settings.defaultModel = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Max Conversations")
      .setDesc("Maximum stored conversations. Oldest auto-deleted when exceeded.")
      .addText((text) =>
        text
          .setPlaceholder("50")
          .setValue(String(this.plugin.settings.maxConversations))
          .onChange(async (value) => {
            const num = parseInt(value);
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.maxConversations = num;
              await this.plugin.saveSettings();
            }
          }),
      );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds (settings tab isn't wired into main.ts yet, but the import types are checked)

- [ ] **Step 3: Commit**

```bash
git add src/settings/settings-tab.ts
git commit -m "feat(inquiry): add plugin settings tab"
```

---

### Task 11: Chat UI -- Owl Icon & View Shell

**Files:**
- Create: `src/ui/components/owl-icon.ts`
- Create: `src/ui/inquiry-view.ts`

- [ ] **Step 1: Create owl icon component**

```typescript
// src/ui/components/owl-icon.ts
export function createOwlIcon(size = 18): SVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  const paths = [
    { tag: "ellipse", attrs: { cx: "12", cy: "9", rx: "8", ry: "7" } },
    { tag: "path", attrs: { d: "M12 9a4 4 0 1 1 8 0v12h-4C9.4 21 4 15.6 4 9a4 4 0 1 1 8 0v1" } },
    { tag: "path", attrs: { d: "M8 9h.01" } },
    { tag: "path", attrs: { d: "M16 9h.01" } },
    { tag: "path", attrs: { d: "M20 21a3.9 3.9 0 1 1 0-7.8" } },
    { tag: "path", attrs: { d: "M10 19.4V22" } },
    { tag: "path", attrs: { d: "M14 20.85V22" } },
  ];

  for (const { tag, attrs } of paths) {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    svg.appendChild(el);
  }

  return svg;
}
```

- [ ] **Step 2: Create the ItemView shell**

```typescript
// src/ui/inquiry-view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type ArchivistPlugin from "../main";
import { createOwlIcon } from "./components/owl-icon";

export const VIEW_TYPE_INQUIRY = "archivist-inquiry-view";

export class InquiryView extends ItemView {
  plugin: ArchivistPlugin;
  private containerEl_: HTMLElement | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: ArchivistPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_INQUIRY;
  }

  getDisplayText(): string {
    return "Archivist Inquiry";
  }

  getIcon(): string {
    return "bot"; // fallback Lucide icon; we render our own owl in the view
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("archivist-inquiry-container");

    this.containerEl_ = container;
    this.renderView();
  }

  async onClose(): Promise<void> {
    // Cleanup
  }

  private renderView(): void {
    if (!this.containerEl_) return;
    const el = this.containerEl_;

    // Placeholder: will be replaced with full UI in subsequent tasks
    const welcome = el.createDiv({ cls: "archivist-inquiry-welcome" });
    welcome.appendChild(createOwlIcon(32));
    welcome.createEl("div", { cls: "archivist-inquiry-welcome-title", text: "Good evening" });
    welcome.createEl("div", { cls: "archivist-inquiry-welcome-subtitle", text: "What knowledge do you seek?" });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/owl-icon.ts src/ui/inquiry-view.ts
git commit -m "feat(inquiry): add owl icon and ItemView shell for chat sidebar"
```

---

### Task 12: Chat UI -- Header, Tabs, History

**Files:**
- Create: `src/ui/components/chat-header.ts`
- Create: `src/ui/components/chat-tabs.ts`
- Create: `src/ui/components/chat-history.ts`

- [ ] **Step 1: Implement chat header**

```typescript
// src/ui/components/chat-header.ts
import { setIcon } from "obsidian";
import { createOwlIcon } from "./owl-icon";

export interface ChatHeaderCallbacks {
  onNewChat: () => void;
  onToggleHistory: () => void;
  onClose: () => void;
}

export function renderChatHeader(parent: HTMLElement, callbacks: ChatHeaderCallbacks): HTMLElement {
  const header = parent.createDiv({ cls: "archivist-inquiry-header" });

  // Left: owl + title
  const left = header.createDiv({ cls: "archivist-inquiry-header-left" });
  const iconWrap = left.createSpan({ cls: "archivist-inquiry-header-icon" });
  iconWrap.appendChild(createOwlIcon(18));
  left.createSpan({ cls: "archivist-inquiry-header-title", text: "Archivist Inquiry" });

  // Right: action buttons
  const right = header.createDiv({ cls: "archivist-inquiry-header-right" });

  const newBtn = right.createDiv({ cls: "archivist-inquiry-header-btn", attr: { "aria-label": "New chat" } });
  setIcon(newBtn, "plus");
  newBtn.addEventListener("click", callbacks.onNewChat);

  const historyBtn = right.createDiv({ cls: "archivist-inquiry-header-btn", attr: { "aria-label": "History" } });
  setIcon(historyBtn, "history");
  historyBtn.addEventListener("click", callbacks.onToggleHistory);

  const closeBtn = right.createDiv({ cls: "archivist-inquiry-header-btn", attr: { "aria-label": "Close" } });
  setIcon(closeBtn, "x");
  closeBtn.addEventListener("click", callbacks.onClose);

  return header;
}
```

- [ ] **Step 2: Implement chat tabs**

```typescript
// src/ui/components/chat-tabs.ts
export interface TabData {
  id: string;
  title: string;
  isActive: boolean;
}

export interface ChatTabsCallbacks {
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
  onCloseAllTabs: () => void;
}

export function renderChatTabs(
  parent: HTMLElement,
  tabs: TabData[],
  callbacks: ChatTabsCallbacks,
): HTMLElement {
  const bar = parent.createDiv({ cls: "archivist-inquiry-tabs" });

  for (const tab of tabs) {
    const tabEl = bar.createDiv({
      cls: tab.isActive
        ? "archivist-inquiry-tab archivist-inquiry-tab-active"
        : "archivist-inquiry-tab",
    });

    tabEl.createSpan({ cls: "archivist-inquiry-tab-title", text: tab.title });

    const closeBtn = tabEl.createSpan({ cls: "archivist-inquiry-tab-close", text: "\u00d7" });
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      callbacks.onCloseTab(tab.id);
    });

    tabEl.addEventListener("click", () => callbacks.onSelectTab(tab.id));

    // Right-click context menu
    tabEl.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showTabContextMenu(e, tab.id, callbacks);
    });
  }

  return bar;
}

function showTabContextMenu(
  event: MouseEvent,
  tabId: string,
  callbacks: ChatTabsCallbacks,
): void {
  const menu = document.createElement("div");
  menu.addClass("archivist-inquiry-context-menu");
  menu.style.position = "fixed";
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  const items = [
    { label: "Close", action: () => callbacks.onCloseTab(tabId) },
    { label: "Close Others", action: () => callbacks.onCloseOtherTabs(tabId) },
    { label: "Close All", action: () => callbacks.onCloseAllTabs() },
  ];

  for (const item of items) {
    const el = menu.createDiv({ cls: "archivist-inquiry-context-menu-item", text: item.label });
    el.addEventListener("click", () => {
      item.action();
      menu.remove();
    });
  }

  document.body.appendChild(menu);

  const dismiss = () => {
    menu.remove();
    document.removeEventListener("click", dismiss);
  };
  setTimeout(() => document.addEventListener("click", dismiss), 0);
}
```

- [ ] **Step 3: Implement chat history dropdown**

```typescript
// src/ui/components/chat-history.ts
import { setIcon } from "obsidian";
import type { Conversation } from "../../types/conversation";

export interface ChatHistoryCallbacks {
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
}

interface GroupedConversations {
  label: string;
  conversations: Conversation[];
}

function groupByDate(conversations: Conversation[]): GroupedConversations[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);
  const lastMonth = new Date(today.getTime() - 30 * 86400000);

  const groups: GroupedConversations[] = [
    { label: "Today", conversations: [] },
    { label: "Yesterday", conversations: [] },
    { label: "Last Week", conversations: [] },
    { label: "Last Month", conversations: [] },
    { label: "Older", conversations: [] },
  ];

  for (const conv of conversations) {
    const date = new Date(conv.updatedAt);
    if (date >= today) groups[0].conversations.push(conv);
    else if (date >= yesterday) groups[1].conversations.push(conv);
    else if (date >= lastWeek) groups[2].conversations.push(conv);
    else if (date >= lastMonth) groups[3].conversations.push(conv);
    else groups[4].conversations.push(conv);
  }

  return groups.filter((g) => g.conversations.length > 0);
}

export function renderChatHistory(
  parent: HTMLElement,
  conversations: Conversation[],
  activeId: string | null,
  callbacks: ChatHistoryCallbacks,
): HTMLElement {
  const dropdown = parent.createDiv({ cls: "archivist-inquiry-history" });
  const groups = groupByDate(conversations);

  for (const group of groups) {
    dropdown.createDiv({ cls: "archivist-inquiry-history-label", text: group.label });

    for (const conv of group.conversations) {
      const isActive = conv.id === activeId;
      const item = dropdown.createDiv({
        cls: isActive
          ? "archivist-inquiry-history-item archivist-inquiry-history-item-active"
          : "archivist-inquiry-history-item",
      });

      const iconEl = item.createSpan({ cls: "archivist-inquiry-history-icon" });
      setIcon(iconEl, "message-square");

      item.createSpan({ cls: "archivist-inquiry-history-title", text: conv.title });

      const chevron = item.createSpan({ cls: "archivist-inquiry-history-chevron" });
      setIcon(chevron, "chevron-right");

      item.addEventListener("click", () => callbacks.onSelectConversation(conv.id));
    }
  }

  if (conversations.length === 0) {
    dropdown.createDiv({ cls: "archivist-inquiry-history-empty", text: "No conversations yet" });
  }

  return dropdown;
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/chat-header.ts src/ui/components/chat-tabs.ts src/ui/components/chat-history.ts
git commit -m "feat(inquiry): add chat header, tabs, and history components"
```

---

### Task 13: Chat UI -- Messages & Message Renderer

**Files:**
- Create: `src/ui/components/message-renderer.ts`
- Create: `src/ui/components/chat-messages.ts`

- [ ] **Step 1: Implement message renderer**

```typescript
// src/ui/components/message-renderer.ts
import { MarkdownRenderer, type App } from "obsidian";
import { setIcon } from "obsidian";
import { renderMonsterBlock } from "../../renderers/monster-renderer";
import { renderSpellBlock } from "../../renderers/spell-renderer";
import { renderItemBlock } from "../../renderers/item-renderer";
import type { Message } from "../../types/conversation";

export function renderUserMessage(parent: HTMLElement, message: Message): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-user" });
  const bubble = wrapper.createDiv({ cls: "archivist-inquiry-msg-bubble" });
  bubble.textContent = message.content;
  return wrapper;
}

export function renderAssistantMessage(
  parent: HTMLElement,
  message: Message,
  app: App,
  sourcePath: string,
): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-assistant" });

  // Render markdown content
  if (message.content) {
    const textDiv = wrapper.createDiv({ cls: "archivist-inquiry-msg-text" });
    MarkdownRenderer.render(app, message.content, textDiv, sourcePath, null as any);

    // Copy button (hover-reveal)
    const copyBtn = wrapper.createDiv({ cls: "archivist-inquiry-msg-copy" });
    setIcon(copyBtn, "copy");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(message.content);
      setIcon(copyBtn, "check");
      setTimeout(() => setIcon(copyBtn, "copy"), 2000);
    });
  }

  // Render generated entity as stat block
  if (message.generatedEntity) {
    const blockWrapper = wrapper.createDiv({ cls: "archivist-inquiry-stat-block" });
    renderGeneratedBlock(blockWrapper, message.generatedEntity);
  }

  return wrapper;
}

export function renderToolCallMessage(
  parent: HTMLElement,
  toolName: string,
  toolInput?: Record<string, unknown>,
  isComplete = true,
): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-tool-call" });

  const header = wrapper.createDiv({ cls: "archivist-inquiry-tool-call-header" });

  const iconEl = header.createSpan({ cls: "archivist-inquiry-tool-call-icon" });
  setIcon(iconEl, getToolIcon(toolName));

  header.createSpan({
    cls: "archivist-inquiry-tool-call-name",
    text: toolName.replace("mcp__archivist__", ""),
  });

  if (toolInput) {
    const summary = getToolSummary(toolName, toolInput);
    if (summary) {
      header.createSpan({ cls: "archivist-inquiry-tool-call-summary", text: summary });
    }
  }

  const statusEl = header.createSpan({ cls: "archivist-inquiry-tool-call-status" });
  if (isComplete) {
    setIcon(statusEl, "check");
    statusEl.addClass("archivist-inquiry-tool-status-done");
  } else {
    statusEl.addClass("archivist-inquiry-tool-status-running");
  }

  return wrapper;
}

export function renderErrorMessage(parent: HTMLElement, errorText: string): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-msg-error" });
  const iconEl = wrapper.createSpan({ cls: "archivist-inquiry-msg-error-icon" });
  setIcon(iconEl, "alert-circle");
  wrapper.createSpan({ text: errorText });
  return wrapper;
}

export function renderThinkingIndicator(parent: HTMLElement): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-thinking" });
  const iconEl = wrapper.createSpan({ cls: "archivist-inquiry-thinking-icon" });
  setIcon(iconEl, "loader-2");
  wrapper.createSpan({ text: "Thinking..." });
  return wrapper;
}

function renderGeneratedBlock(
  parent: HTMLElement,
  entity: { type: string; data: unknown },
): void {
  try {
    switch (entity.type) {
      case "monster":
        parent.appendChild(renderMonsterBlock(entity.data as any));
        break;
      case "spell":
        parent.appendChild(renderSpellBlock(entity.data as any));
        break;
      case "item":
        parent.appendChild(renderItemBlock(entity.data as any));
        break;
      default:
        // For encounter/npc, render as formatted text
        const pre = parent.createEl("pre", { cls: "archivist-inquiry-json" });
        pre.textContent = JSON.stringify(entity.data, null, 2);
    }
  } catch {
    parent.createDiv({ cls: "archivist-inquiry-msg-error", text: "Failed to render block" });
  }

  // Copy to clipboard button
  const copyBtn = parent.createDiv({ cls: "archivist-inquiry-block-copy" });
  const copyIcon = copyBtn.createSpan();
  setIcon(copyIcon, "clipboard-copy");
  copyBtn.createSpan({ text: "Copy to Clipboard" });
  copyBtn.addEventListener("click", () => {
    // Copy as YAML for stat blocks
    const yamlContent = entityToYaml(entity);
    navigator.clipboard.writeText(yamlContent);
    copyBtn.empty();
    const checkIcon = copyBtn.createSpan();
    setIcon(checkIcon, "check");
    copyBtn.createSpan({ text: "Copied!" });
    setTimeout(() => {
      copyBtn.empty();
      const icon2 = copyBtn.createSpan();
      setIcon(icon2, "clipboard-copy");
      copyBtn.createSpan({ text: "Copy to Clipboard" });
    }, 2000);
  });
}

function entityToYaml(entity: { type: string; data: unknown }): string {
  // Simple YAML serialization for clipboard
  const yaml = require("js-yaml") as typeof import("js-yaml");
  const fenceType = entity.type;
  const yamlStr = yaml.dump(entity.data, { lineWidth: -1 });
  return `\`\`\`${fenceType}\n${yamlStr}\`\`\``;
}

function getToolIcon(toolName: string): string {
  const name = toolName.replace("mcp__archivist__", "");
  if (name.includes("search")) return "search";
  if (name.includes("get")) return "book-open";
  if (name.includes("generate")) return "wand-2";
  return "wrench";
}

function getToolSummary(toolName: string, input: Record<string, unknown>): string {
  const name = toolName.replace("mcp__archivist__", "");
  if (name === "search_srd") return `"${input.query}"`;
  if (name === "get_srd_entity") return `"${input.name}"`;
  if (name === "generate_monster" && input.monster) return `"${(input.monster as any).name}"`;
  if (name === "generate_spell" && input.spell) return `"${(input.spell as any).name}"`;
  if (name === "generate_item" && input.item) return `"${(input.item as any).name}"`;
  return "";
}
```

- [ ] **Step 2: Implement chat messages container**

```typescript
// src/ui/components/chat-messages.ts
import type { App } from "obsidian";
import type { Message } from "../../types/conversation";
import {
  renderUserMessage,
  renderAssistantMessage,
  renderToolCallMessage,
  renderErrorMessage,
  renderThinkingIndicator,
} from "./message-renderer";
import { createOwlIcon } from "./owl-icon";

export function renderChatMessages(
  parent: HTMLElement,
  messages: Message[],
  app: App,
  sourcePath: string,
  isStreaming: boolean,
): HTMLElement {
  const container = parent.createDiv({ cls: "archivist-inquiry-messages" });

  if (messages.length === 0 && !isStreaming) {
    renderWelcomeState(container);
    return container;
  }

  for (const message of messages) {
    if (message.role === "user") {
      renderUserMessage(container, message);
    } else if (message.role === "assistant") {
      renderAssistantMessage(container, message, app, sourcePath);
    } else if (message.role === "tool") {
      // Tool messages are rendered as collapsible indicators
      for (const tc of message.toolCalls ?? []) {
        renderToolCallMessage(container, tc.name, tc.input, true);
      }
    }
  }

  if (isStreaming) {
    renderThinkingIndicator(container);
  }

  // Auto-scroll to bottom
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });

  return container;
}

function renderWelcomeState(parent: HTMLElement): void {
  const welcome = parent.createDiv({ cls: "archivist-inquiry-welcome" });
  welcome.appendChild(createOwlIcon(32));
  welcome.createDiv({ cls: "archivist-inquiry-welcome-title", text: "Good evening" });
  welcome.createDiv({ cls: "archivist-inquiry-welcome-subtitle", text: "What knowledge do you seek?" });
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/message-renderer.ts src/ui/components/chat-messages.ts
git commit -m "feat(inquiry): add message renderer with stat block support"
```

---

### Task 14: Chat UI -- Input Area & Toolbar

**Files:**
- Create: `src/ui/components/chat-input.ts`

- [ ] **Step 1: Implement chat input with toolbar**

```typescript
// src/ui/components/chat-input.ts
import { setIcon } from "obsidian";

export interface ChatInputState {
  selectedText?: string;
  model: string;
  permissionMode: "auto" | "safe";
  contextPercent: number;
  isStreaming: boolean;
}

export interface ChatInputCallbacks {
  onSend: (text: string) => void;
  onStop: () => void;
  onModelChange: (model: string) => void;
  onPermissionToggle: () => void;
  onDismissSelection: () => void;
}

const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4" },
  { id: "claude-opus-4-6", label: "Opus 4" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4" },
];

export function renderChatInput(
  parent: HTMLElement,
  state: ChatInputState,
  callbacks: ChatInputCallbacks,
): HTMLElement {
  const wrapper = parent.createDiv({ cls: "archivist-inquiry-input-area" });

  // Context row (selection indicator)
  if (state.selectedText) {
    const ctxRow = wrapper.createDiv({ cls: "archivist-inquiry-context-row" });
    const iconEl = ctxRow.createSpan({ cls: "archivist-inquiry-context-icon" });
    setIcon(iconEl, "highlighter");
    ctxRow.createSpan({ cls: "archivist-inquiry-context-label", text: "Selection" });
    ctxRow.createSpan({
      cls: "archivist-inquiry-context-preview",
      text: state.selectedText.length > 60
        ? state.selectedText.slice(0, 60) + "..."
        : state.selectedText,
    });
    const dismissBtn = ctxRow.createSpan({ cls: "archivist-inquiry-context-dismiss", text: "\u00d7" });
    dismissBtn.addEventListener("click", callbacks.onDismissSelection);
  }

  // Input wrapper
  const inputWrapper = wrapper.createDiv({
    cls: state.isStreaming
      ? "archivist-inquiry-input-wrapper archivist-inquiry-input-streaming"
      : "archivist-inquiry-input-wrapper",
  });

  // Textarea
  const textarea = inputWrapper.createEl("textarea", {
    cls: "archivist-inquiry-textarea",
    attr: {
      placeholder: state.isStreaming ? "Archivist is thinking..." : "Ask the Archivist...",
      rows: "1",
    },
  });
  if (state.isStreaming) {
    textarea.disabled = true;
  }

  // Auto-expand textarea
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
  });

  // Send on Enter (without Shift)
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !state.isStreaming) {
      e.preventDefault();
      const text = textarea.value.trim();
      if (text) {
        callbacks.onSend(text);
        textarea.value = "";
        textarea.style.height = "auto";
      }
    }
  });

  // Toolbar row
  const toolbar = inputWrapper.createDiv({ cls: "archivist-inquiry-toolbar" });

  // Model selector
  const modelBtn = toolbar.createDiv({ cls: "archivist-inquiry-model-selector" });
  const currentModel = MODELS.find((m) => m.id === state.model) ?? MODELS[0];
  modelBtn.createSpan({ text: currentModel.label });
  const chevron = modelBtn.createSpan({ cls: "archivist-inquiry-model-chevron" });
  setIcon(chevron, "chevron-up");

  // Model dropdown
  const modelDropdown = toolbar.createDiv({ cls: "archivist-inquiry-model-dropdown" });
  modelDropdown.style.display = "none";
  for (const model of MODELS) {
    const option = modelDropdown.createDiv({
      cls: model.id === state.model
        ? "archivist-inquiry-model-option archivist-inquiry-model-option-active"
        : "archivist-inquiry-model-option",
      text: model.label,
    });
    option.addEventListener("click", () => {
      callbacks.onModelChange(model.id);
      modelDropdown.style.display = "none";
    });
  }
  modelBtn.addEventListener("click", () => {
    modelDropdown.style.display = modelDropdown.style.display === "none" ? "" : "none";
  });

  // Separator
  toolbar.createDiv({ cls: "archivist-inquiry-toolbar-sep" });

  // Context gauge
  const gauge = toolbar.createDiv({ cls: "archivist-inquiry-gauge" });
  renderContextGauge(gauge, state.contextPercent);

  // Separator
  toolbar.createDiv({ cls: "archivist-inquiry-toolbar-sep" });

  // Permission toggle
  const permToggle = toolbar.createDiv({ cls: "archivist-inquiry-perm-toggle" });
  const isAuto = state.permissionMode === "auto";
  permToggle.createSpan({
    cls: isAuto ? "archivist-inquiry-perm-label archivist-inquiry-perm-auto" : "archivist-inquiry-perm-label",
    text: isAuto ? "Auto" : "Safe",
  });
  const toggle = permToggle.createDiv({
    cls: isAuto ? "archivist-inquiry-toggle archivist-inquiry-toggle-on" : "archivist-inquiry-toggle",
  });
  toggle.createDiv({ cls: "archivist-inquiry-toggle-thumb" });
  permToggle.addEventListener("click", callbacks.onPermissionToggle);

  // Send / Stop button
  const actionBtn = toolbar.createDiv({ cls: "archivist-inquiry-send-btn" });
  if (state.isStreaming) {
    actionBtn.addClass("archivist-inquiry-stop-btn");
    const stopIcon = actionBtn.createDiv({ cls: "archivist-inquiry-stop-icon" });
    void stopIcon;
    actionBtn.addEventListener("click", callbacks.onStop);
  } else {
    const sendIcon = actionBtn.createSpan();
    setIcon(sendIcon, "send");
    actionBtn.addEventListener("click", () => {
      const text = textarea.value.trim();
      if (text) {
        callbacks.onSend(text);
        textarea.value = "";
        textarea.style.height = "auto";
      }
    });
  }

  return wrapper;
}

function renderContextGauge(parent: HTMLElement, percent: number): void {
  const size = 14;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.style.transform = "rotate(-90deg)";

  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  // Background circle
  const bg = document.createElementNS(ns, "circle");
  bg.setAttribute("cx", "12");
  bg.setAttribute("cy", "12");
  bg.setAttribute("r", String(radius));
  bg.setAttribute("stroke", "var(--background-modifier-border)");
  bg.setAttribute("stroke-width", "2.5");
  bg.setAttribute("fill", "none");
  svg.appendChild(bg);

  // Progress circle
  const progress = document.createElementNS(ns, "circle");
  progress.setAttribute("cx", "12");
  progress.setAttribute("cy", "12");
  progress.setAttribute("r", String(radius));
  progress.setAttribute("stroke", percent > 80 ? "var(--text-error)" : "#D97757");
  progress.setAttribute("stroke-width", "2.5");
  progress.setAttribute("fill", "none");
  progress.setAttribute("stroke-dasharray", String(circumference));
  progress.setAttribute("stroke-dashoffset", String(offset));
  progress.setAttribute("stroke-linecap", "round");
  svg.appendChild(progress);

  parent.appendChild(svg);
  parent.createSpan({ cls: "archivist-inquiry-gauge-text", text: `${percent}%` });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/chat-input.ts
git commit -m "feat(inquiry): add chat input with model selector, permission toggle, and context gauge"
```

---

### Task 15: Chat CSS Styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add chat UI styles to styles.css**

Append the following to `styles.css`. All classes are prefixed with `archivist-inquiry-` to avoid conflicts. The styles use Obsidian CSS variables for theme compatibility, with `#D97757` as the brand accent color.

```css
/* === Archivist Inquiry Chat UI === */
:root {
  --archivist-brand: #D97757;
  --archivist-brand-rgb: 217, 119, 87;
}

.archivist-inquiry-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--font-text);
  color: var(--text-normal);
  background: var(--background-primary);
}

/* Header */
.archivist-inquiry-header {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px;
  border-bottom: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
}

.archivist-inquiry-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.archivist-inquiry-header-icon {
  color: var(--text-muted);
  display: flex;
}

.archivist-inquiry-header-title {
  font-size: 13px;
  font-weight: 600;
  font-family: 'Libre Baskerville', Georgia, serif;
}

.archivist-inquiry-header-right {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.archivist-inquiry-header-btn {
  padding: 4px;
  border-radius: 4px;
  color: var(--text-faint);
  cursor: pointer;
  display: flex;
  align-items: center;
}

.archivist-inquiry-header-btn:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

.archivist-inquiry-header-btn svg {
  width: 14px;
  height: 14px;
}

/* Tabs */
.archivist-inquiry-tabs {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 0 8px;
  overflow-x: auto;
  border-bottom: 1px solid var(--background-modifier-border);
  flex-shrink: 0;
  background: var(--background-secondary);
}

.archivist-inquiry-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

.archivist-inquiry-tab:hover {
  color: var(--text-normal);
}

.archivist-inquiry-tab-active {
  color: var(--archivist-brand);
  border-bottom-color: var(--archivist-brand);
  font-weight: 500;
}

.archivist-inquiry-tab-close {
  font-size: 12px;
  opacity: 0;
  cursor: pointer;
  color: var(--text-faint);
  transition: opacity 0.15s;
}

.archivist-inquiry-tab:hover .archivist-inquiry-tab-close {
  opacity: 1;
}

/* Context menu */
.archivist-inquiry-context-menu {
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px;
  min-width: 120px;
}

.archivist-inquiry-context-menu-item {
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-normal);
}

.archivist-inquiry-context-menu-item:hover {
  background: var(--background-modifier-hover);
}

/* Messages area */
.archivist-inquiry-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Welcome state */
.archivist-inquiry-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 40px 20px;
  opacity: 0.7;
}

.archivist-inquiry-welcome svg {
  color: var(--archivist-brand);
  margin-bottom: 12px;
}

.archivist-inquiry-welcome-title {
  font-family: 'Libre Baskerville', Georgia, serif;
  font-size: 20px;
  font-weight: 300;
  color: var(--text-normal);
  margin-bottom: 6px;
}

.archivist-inquiry-welcome-subtitle {
  font-size: 12px;
  color: var(--text-muted);
}

/* User messages */
.archivist-inquiry-msg-user {
  align-self: flex-end;
  max-width: 85%;
}

.archivist-inquiry-msg-bubble {
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px 8px 2px 8px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.5;
}

/* Assistant messages */
.archivist-inquiry-msg-assistant {
  max-width: 95%;
  position: relative;
}

.archivist-inquiry-msg-text {
  font-size: 13px;
  line-height: 1.6;
}

.archivist-inquiry-msg-copy {
  position: absolute;
  top: 0;
  right: -24px;
  opacity: 0;
  cursor: pointer;
  color: var(--text-faint);
  transition: opacity 0.15s;
}

.archivist-inquiry-msg-assistant:hover .archivist-inquiry-msg-copy {
  opacity: 1;
}

.archivist-inquiry-msg-copy svg {
  width: 14px;
  height: 14px;
}

/* Tool calls */
.archivist-inquiry-tool-call {
  padding: 2px 0;
}

.archivist-inquiry-tool-call-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
}

.archivist-inquiry-tool-call-icon {
  color: var(--archivist-brand);
  display: flex;
}

.archivist-inquiry-tool-call-icon svg {
  width: 12px;
  height: 12px;
}

.archivist-inquiry-tool-call-name {
  font-family: var(--font-monospace);
  font-size: 11px;
}

.archivist-inquiry-tool-call-summary {
  color: var(--text-faint);
  font-style: italic;
}

.archivist-inquiry-tool-call-status {
  margin-left: auto;
  display: flex;
}

.archivist-inquiry-tool-call-status svg {
  width: 10px;
  height: 10px;
}

.archivist-inquiry-tool-status-done {
  color: var(--color-green);
}

.archivist-inquiry-tool-status-running {
  color: var(--archivist-brand);
  animation: archivist-pulse 1.5s ease-in-out infinite;
}

/* Stat blocks in chat */
.archivist-inquiry-stat-block {
  margin-top: 8px;
  max-width: 400px;
}

.archivist-inquiry-block-copy {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: var(--text-muted);
  cursor: pointer;
  background: var(--background-secondary);
  border: 1px solid var(--background-modifier-border);
  margin-top: 6px;
  width: fit-content;
  transition: color 0.15s, background 0.15s;
}

.archivist-inquiry-block-copy:hover {
  color: var(--text-normal);
  background: var(--background-modifier-hover);
}

.archivist-inquiry-block-copy svg {
  width: 12px;
  height: 12px;
}

/* Error messages */
.archivist-inquiry-msg-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(var(--color-red-rgb, 255,0,0), 0.1);
  border: 1px solid var(--text-error);
  font-size: 12px;
  color: var(--text-error);
}

.archivist-inquiry-msg-error-icon svg {
  width: 14px;
  height: 14px;
}

/* Thinking indicator */
.archivist-inquiry-thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  animation: archivist-pulse 1.5s ease-in-out infinite;
}

.archivist-inquiry-thinking-icon svg {
  width: 14px;
  height: 14px;
  color: var(--archivist-brand);
  animation: archivist-spin 1s linear infinite;
}

/* Input area */
.archivist-inquiry-input-area {
  border-top: 1px solid var(--background-modifier-border);
  padding: 8px;
  flex-shrink: 0;
}

/* Context row */
.archivist-inquiry-context-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  margin-bottom: 6px;
  background: var(--background-secondary);
  border-radius: 4px;
  border: 1px solid rgba(122, 186, 255, 0.15);
}

.archivist-inquiry-context-icon {
  display: flex;
  color: #7abaff;
}

.archivist-inquiry-context-icon svg {
  width: 12px;
  height: 12px;
}

.archivist-inquiry-context-label {
  font-size: 10px;
  color: #7abaff;
  font-weight: 500;
}

.archivist-inquiry-context-preview {
  font-size: 10px;
  color: var(--text-faint);
  font-style: italic;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.archivist-inquiry-context-dismiss {
  font-size: 12px;
  color: var(--text-faint);
  cursor: pointer;
  flex-shrink: 0;
}

/* Input wrapper */
.archivist-inquiry-input-wrapper {
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  overflow: hidden;
}

.archivist-inquiry-input-streaming {
  border-color: rgba(var(--archivist-brand-rgb), 0.3);
}

.archivist-inquiry-textarea {
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 13px;
  font-family: var(--font-text);
  color: var(--text-normal);
  min-height: 36px;
  max-height: 200px;
}

.archivist-inquiry-textarea::placeholder {
  color: var(--text-faint);
}

/* Toolbar */
.archivist-inquiry-toolbar {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 8px;
  border-top: 1px solid var(--background-modifier-border-focus);
}

.archivist-inquiry-toolbar-sep {
  width: 1px;
  height: 12px;
  background: var(--background-modifier-border);
}

/* Model selector */
.archivist-inquiry-model-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--archivist-brand);
  font-weight: 500;
  cursor: pointer;
  position: relative;
}

.archivist-inquiry-model-chevron svg {
  width: 8px;
  height: 8px;
}

.archivist-inquiry-model-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  min-width: 100px;
  padding: 4px;
}

.archivist-inquiry-model-option {
  padding: 4px 8px;
  font-size: 11px;
  cursor: pointer;
  border-radius: 4px;
  color: var(--text-normal);
}

.archivist-inquiry-model-option:hover {
  background: var(--background-modifier-hover);
}

.archivist-inquiry-model-option-active {
  background: rgba(var(--archivist-brand-rgb), 0.15);
  color: var(--archivist-brand);
}

/* Context gauge */
.archivist-inquiry-gauge {
  display: flex;
  align-items: center;
  gap: 3px;
}

.archivist-inquiry-gauge-text {
  font-size: 9px;
  color: var(--text-faint);
}

/* Permission toggle */
.archivist-inquiry-perm-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.archivist-inquiry-perm-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-muted);
}

.archivist-inquiry-perm-auto {
  color: var(--color-green);
}

.archivist-inquiry-toggle {
  width: 28px;
  height: 14px;
  background: var(--background-modifier-border);
  border-radius: 7px;
  position: relative;
  transition: background 0.2s;
}

.archivist-inquiry-toggle-on {
  background: var(--color-green);
}

.archivist-inquiry-toggle-thumb {
  width: 10px;
  height: 10px;
  background: var(--text-on-accent);
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.2s;
}

.archivist-inquiry-toggle-on .archivist-inquiry-toggle-thumb {
  left: 16px;
}

/* Send / Stop buttons */
.archivist-inquiry-send-btn {
  margin-left: auto;
  background: var(--archivist-brand);
  border-radius: 6px;
  padding: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}

.archivist-inquiry-send-btn:hover {
  opacity: 0.85;
}

.archivist-inquiry-send-btn svg {
  width: 14px;
  height: 14px;
  color: white;
}

.archivist-inquiry-stop-btn {
  background: var(--text-muted);
}

.archivist-inquiry-stop-icon {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 1px;
}

/* History dropdown */
.archivist-inquiry-history {
  position: absolute;
  right: 8px;
  top: 36px;
  width: 280px;
  max-height: 400px;
  overflow-y: auto;
  background: var(--background-primary);
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 100;
  padding: 8px;
  backdrop-filter: blur(20px);
}

.archivist-inquiry-history-label {
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-top: 8px;
}

.archivist-inquiry-history-label:first-child {
  margin-top: 0;
}

.archivist-inquiry-history-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.archivist-inquiry-history-item:hover {
  background: var(--background-modifier-hover);
}

.archivist-inquiry-history-item-active {
  background: rgba(var(--archivist-brand-rgb), 0.08);
}

.archivist-inquiry-history-icon {
  display: flex;
  color: var(--text-faint);
}

.archivist-inquiry-history-icon svg {
  width: 14px;
  height: 14px;
}

.archivist-inquiry-history-item-active .archivist-inquiry-history-icon {
  color: var(--archivist-brand);
}

.archivist-inquiry-history-title {
  font-size: 12px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.archivist-inquiry-history-chevron {
  display: flex;
  color: var(--text-faint);
}

.archivist-inquiry-history-chevron svg {
  width: 10px;
  height: 10px;
}

.archivist-inquiry-history-empty {
  padding: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

/* Animations */
@keyframes archivist-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes archivist-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat(inquiry): add chat UI CSS styles with Obsidian theme integration"
```

---

### Task 16: Wire InquiryView with All Components

**Files:**
- Modify: `src/ui/inquiry-view.ts`

- [ ] **Step 1: Update InquiryView to assemble all components**

Replace the placeholder in `src/ui/inquiry-view.ts` with the full view that wires header, tabs, messages, input, and history together, connecting them to the ConversationManager and AgentService.

```typescript
// src/ui/inquiry-view.ts
import { ItemView, WorkspaceLeaf } from "obsidian";
import type ArchivistPlugin from "../main";
import { renderChatHeader } from "./components/chat-header";
import { renderChatTabs, type TabData } from "./components/chat-tabs";
import { renderChatMessages } from "./components/chat-messages";
import { renderChatInput, type ChatInputState } from "./components/chat-input";
import { renderChatHistory } from "./components/chat-history";
import type { Message } from "../types/conversation";
import type { StreamEvent } from "../ai/agent-service";

export const VIEW_TYPE_INQUIRY = "archivist-inquiry-view";

export class InquiryView extends ItemView {
  plugin: ArchivistPlugin;
  private root: HTMLElement | null = null;
  private historyVisible = false;
  private historyEl: HTMLElement | null = null;
  private isStreaming = false;
  private streamingText = "";
  private selectedText: string | undefined;

  constructor(leaf: WorkspaceLeaf, plugin: ArchivistPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string { return VIEW_TYPE_INQUIRY; }
  getDisplayText(): string { return "Archivist Inquiry"; }
  getIcon(): string { return "bot"; }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("archivist-inquiry-container");
    this.root = container;

    // Listen for selection changes in the editor
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => this.updateSelection()),
    );

    this.render();
  }

  async onClose(): Promise<void> {
    this.plugin.agentService?.abort();
  }

  updateSelection(): void {
    const view = this.app.workspace.getActiveViewOfType(
      (require("obsidian") as any).MarkdownView,
    );
    if (view?.editor) {
      const sel = view.editor.getSelection();
      this.selectedText = sel || undefined;
    } else {
      this.selectedText = undefined;
    }
  }

  render(): void {
    if (!this.root) return;
    this.root.empty();

    const mgr = this.plugin.conversationManager;
    if (!mgr) return;

    // Header
    renderChatHeader(this.root, {
      onNewChat: () => this.createNewChat(),
      onToggleHistory: () => this.toggleHistory(),
      onClose: () => this.app.workspace.detachLeavesOfType(VIEW_TYPE_INQUIRY),
    });

    // Tabs
    const openTabs = mgr.getOpenTabs();
    const activeId = mgr.getActiveConversationId();
    const tabData: TabData[] = openTabs.map((id) => {
      const conv = mgr.getConversation(id);
      return { id, title: conv?.title ?? "Untitled", isActive: id === activeId };
    });

    if (tabData.length > 0) {
      renderChatTabs(this.root, tabData, {
        onSelectTab: (id) => { mgr.setActiveTab(id); this.render(); },
        onCloseTab: (id) => { mgr.closeTab(id); this.render(); },
        onCloseOtherTabs: (id) => {
          for (const t of openTabs) { if (t !== id) mgr.closeTab(t); }
          this.render();
        },
        onCloseAllTabs: () => {
          for (const t of openTabs) mgr.closeTab(t);
          this.render();
        },
      });
    }

    // Messages
    const activeConv = activeId ? mgr.getConversation(activeId) : undefined;
    const messages = activeConv?.messages ?? [];
    const sourcePath = this.app.workspace.getActiveFile()?.path ?? "";

    renderChatMessages(this.root, messages, this.app, sourcePath, this.isStreaming);

    // Input
    const inputState: ChatInputState = {
      selectedText: this.selectedText,
      model: activeConv?.model ?? this.plugin.settings.defaultModel,
      permissionMode: this.plugin.settings.permissionMode,
      contextPercent: 0,
      isStreaming: this.isStreaming,
    };

    renderChatInput(this.root, inputState, {
      onSend: (text) => this.sendMessage(text),
      onStop: () => this.plugin.agentService?.abort(),
      onModelChange: (model) => {
        if (activeConv) activeConv.model = model;
        this.render();
      },
      onPermissionToggle: async () => {
        this.plugin.settings.permissionMode =
          this.plugin.settings.permissionMode === "auto" ? "safe" : "auto";
        await this.plugin.saveSettings();
        this.render();
      },
      onDismissSelection: () => { this.selectedText = undefined; this.render(); },
    });

    // History dropdown (if visible)
    if (this.historyVisible) {
      this.historyEl = renderChatHistory(
        this.root,
        mgr.listConversations(),
        activeId,
        {
          onSelectConversation: (id) => {
            mgr.openTab(id);
            this.historyVisible = false;
            this.render();
          },
          onDeleteConversation: async (id) => {
            await mgr.deleteConversation(id);
            this.render();
          },
        },
      );
    }
  }

  private async createNewChat(): Promise<void> {
    const mgr = this.plugin.conversationManager;
    if (!mgr) return;

    const conv = await mgr.createConversation(this.plugin.settings.defaultModel);
    mgr.openTab(conv.id);
    this.render();
  }

  private toggleHistory(): void {
    this.historyVisible = !this.historyVisible;
    this.render();
  }

  private async sendMessage(text: string): Promise<void> {
    const mgr = this.plugin.conversationManager;
    const agent = this.plugin.agentService;
    if (!mgr || !agent) return;

    let activeId = mgr.getActiveConversationId();
    if (!activeId) {
      const conv = await mgr.createConversation(this.plugin.settings.defaultModel);
      mgr.openTab(conv.id);
      activeId = conv.id;
    }

    // Add user message
    const userMsg: Message = {
      id: "msg-" + Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
    };
    await mgr.addMessage(activeId, userMsg);

    this.isStreaming = true;
    this.streamingText = "";
    this.render();

    // Build context
    const activeFile = this.app.workspace.getActiveFile();
    const currentNoteContent = activeFile
      ? await this.app.vault.cachedRead(activeFile)
      : undefined;

    const vaultPath = (this.app.vault.adapter as any).basePath ?? "";
    const ttrpgRoot = this.plugin.settings.ttrpgRootDir === "/"
      ? vaultPath
      : `${vaultPath}/${this.plugin.settings.ttrpgRootDir}`;

    const context = {
      ttrpgRootDir: ttrpgRoot,
      currentNotePath: activeFile?.path,
      currentNoteContent,
      selectedText: this.selectedText,
    };

    const conv = mgr.getConversation(activeId);
    const model = conv?.model ?? this.plugin.settings.defaultModel;

    // Stream response
    let assistantContent = "";
    let generatedEntity: Message["generatedEntity"] | undefined;

    try {
      for await (const event of agent.sendMessage(text, this.plugin.settings, context, model)) {
        switch (event.type) {
          case "text":
            assistantContent += event.content ?? "";
            this.streamingText = assistantContent;
            this.render();
            break;
          case "tool_call":
            // Tool calls are rendered inline during streaming
            this.render();
            break;
          case "done":
            break;
          case "error":
            assistantContent += `\n\n**Error:** ${event.content}`;
            break;
        }

        // Check for generated entity in tool results
        if (event.type === "text" && event.content) {
          try {
            const parsed = JSON.parse(event.content);
            if (parsed.type && parsed.data) {
              generatedEntity = { type: parsed.type, data: parsed.data };
            }
          } catch {
            // Not JSON, that's fine -- it's regular text
          }
        }
      }
    } catch (err) {
      assistantContent += `\n\n**Error:** ${(err as Error).message}`;
    }

    // Save assistant message
    const assistantMsg: Message = {
      id: "msg-" + Date.now().toString(36),
      role: "assistant",
      content: assistantContent,
      timestamp: new Date().toISOString(),
      generatedEntity,
    };
    await mgr.addMessage(activeId, assistantMsg);

    this.isStreaming = false;
    this.streamingText = "";
    this.render();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/ui/inquiry-view.ts
git commit -m "feat(inquiry): wire InquiryView with all chat UI components"
```

---

### Task 17: Main Plugin Integration

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update main.ts to register everything**

```typescript
// src/main.ts
import { Plugin } from "obsidian";
import { parseMonster } from "./parsers/monster-parser";
import { parseSpell } from "./parsers/spell-parser";
import { parseItem } from "./parsers/item-parser";
import { parseInlineTag } from "./parsers/inline-tag-parser";
import { renderMonsterBlock } from "./renderers/monster-renderer";
import { renderSpellBlock } from "./renderers/spell-renderer";
import { renderItemBlock } from "./renderers/item-renderer";
import { renderInlineTag } from "./renderers/inline-tag-renderer";
import { createErrorBlock } from "./renderers/renderer-utils";
import { MonsterModal } from "./modals/monster-modal";
import { SpellModal } from "./modals/spell-modal";
import { ItemModal } from "./modals/item-modal";
import { inlineTagPlugin } from "./extensions/inline-tag-extension";
import { InquiryView, VIEW_TYPE_INQUIRY } from "./ui/inquiry-view";
import { ArchivistSettingTab } from "./settings/settings-tab";
import { AgentService } from "./ai/agent-service";
import { ConversationManager } from "./ai/conversation-manager";
import { SrdStore } from "./ai/srd/srd-store";
import type { ArchivistSettings } from "./types/settings";
import { DEFAULT_SETTINGS } from "./types/settings";

export default class ArchivistPlugin extends Plugin {
  settings: ArchivistSettings = DEFAULT_SETTINGS;
  agentService: AgentService | null = null;
  conversationManager: ConversationManager | null = null;
  private srdStore: SrdStore | null = null;

  async onload() {
    await this.loadSettings();

    // Initialize SRD store
    this.srdStore = new SrdStore();
    // SRD data will be loaded from bundled JSON files
    // We use a try/catch since the files might not exist yet during development
    try {
      const basePath = this.app.vault.configDir + "/plugins/archivist-ttrpg-blocks/data";
      await this.srdStore.loadFromFiles(
        async (path: string) => {
          const adapter = this.app.vault.adapter;
          return await adapter.read(path);
        },
        basePath,
      );
    } catch {
      // SRD data not available -- tools will return empty results
      console.log("Archivist: SRD data not loaded. Generation tools will work without SRD reference.");
    }

    // Initialize AI services
    this.agentService = new AgentService(this.srdStore);
    this.conversationManager = new ConversationManager(
      async () => {
        const data = await this.loadData();
        return data?.conversationStore ?? null;
      },
      async (store) => {
        const data = (await this.loadData()) ?? {};
        data.conversationStore = store;
        await this.saveData(data);
      },
      this.settings.maxConversations,
    );
    await this.conversationManager.load();

    // Register the Inquiry view
    this.registerView(VIEW_TYPE_INQUIRY, (leaf) => new InquiryView(leaf, this));

    // Add ribbon icon (owl)
    this.addRibbonIcon("bot", "Archivist Inquiry", () => {
      this.activateInquiryView();
    });

    // Add command to open Inquiry
    this.addCommand({
      id: "open-inquiry",
      name: "Open Archivist Inquiry",
      callback: () => this.activateInquiryView(),
    });

    // Existing block processors
    this.registerMarkdownCodeBlockProcessor("monster", (source, el) => {
      this.renderBlock(source, el, parseMonster, renderMonsterBlock);
    });

    this.registerMarkdownCodeBlockProcessor("spell", (source, el) => {
      this.renderBlock(source, el, parseSpell, renderSpellBlock);
    });

    this.registerMarkdownCodeBlockProcessor("item", (source, el) => {
      this.renderBlock(source, el, parseItem, renderItemBlock);
    });

    this.registerMarkdownPostProcessor((element) => {
      const codeElements = element.querySelectorAll("code");
      codeElements.forEach((codeEl) => {
        const text = codeEl.textContent ?? "";
        const parsed = parseInlineTag(text);
        if (parsed) {
          const tagEl = renderInlineTag(parsed);
          codeEl.replaceWith(tagEl);
        }
      });
    });

    this.registerEditorExtension(inlineTagPlugin);

    // Existing commands
    this.addCommand({
      id: "insert-monster",
      name: "Insert Monster Block",
      editorCallback: (editor) => {
        new MonsterModal(this.app, editor).open();
      },
    });

    this.addCommand({
      id: "insert-spell",
      name: "Insert Spell Block",
      editorCallback: (editor) => {
        new SpellModal(this.app, editor).open();
      },
    });

    this.addCommand({
      id: "insert-item",
      name: "Insert Magic Item Block",
      editorCallback: (editor) => {
        new ItemModal(this.app, editor).open();
      },
    });

    // Settings tab
    this.addSettingTab(new ArchivistSettingTab(this.app, this));
  }

  private async activateInquiryView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_INQUIRY);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_INQUIRY, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  private renderBlock<T>(
    source: string,
    el: HTMLElement,
    parser: (
      source: string,
    ) => { success: true; data: T } | { success: false; error: string },
    renderer: (data: T) => HTMLElement,
  ): void {
    const result = parser(source);
    if (result.success) {
      el.appendChild(renderer(result.data));
    } else {
      el.appendChild(createErrorBlock(result.error, source));
    }
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
  }

  async saveSettings(): Promise<void> {
    const data = (await this.loadData()) ?? {};
    data.settings = this.settings;
    await this.saveData(data);
  }

  onunload() {
    this.agentService?.abort();
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(inquiry): integrate Archivist Inquiry into main plugin"
```

---

### Task 18: Build, Install, and Manual Test

**Files:**
- No new files

- [ ] **Step 1: Build the plugin**

Run: `npm run build`
Expected: Build succeeds, `main.js` generated

- [ ] **Step 2: Install to test vault**

```bash
rm -rf /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks
mkdir -p /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks
cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/
```

If SRD data files exist, also copy them:
```bash
mkdir -p /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/data
cp src/data/srd-*.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist-ttrpg-blocks/data/
```

- [ ] **Step 3: Manual test in Obsidian**

Restart Obsidian. Verify:
1. Ribbon icon appears (bot icon)
2. Clicking opens the Inquiry sidebar
3. Welcome state shows owl + greeting
4. Settings tab appears with 4 settings
5. Existing monster/spell/item blocks still render correctly
6. If Claude Code is installed: typing a message streams a response
7. If Claude Code is NOT installed: the chat shows an appropriate error

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(inquiry): address manual testing issues"
```

---

## Self-Review

**1. Spec coverage:**
- Chat sidebar UI (view, tabs, history, messages, input, streaming): Tasks 11-16
- Agent SDK integration (spawn, stream, MCP tools): Tasks 6-8
- 7 custom MCP tools (5 generation + 2 SRD): Tasks 4, 6
- Entity validation and enrichment (Zod schemas, auto-calc): Tasks 3-4
- Bundled SRD JSON data: Task 5
- System prompt (owl persona, directory scoping): Task 7
- Conversation persistence (JSON): Task 9
- Plugin settings (directory, permission, model, max conversations): Task 10
- Selection awareness (context row): Task 14 (chat-input.ts)
- Permission modes (Auto/Safe): Task 14 (chat-input.ts) + Task 8 (agent-service.ts)

**2. Placeholder scan:** No TBD, TODO, or vague instructions found. All steps have concrete code.

**3. Type consistency:** Verified:
- `Monster`, `Spell`, `Item` types used consistently from `src/types/`
- `Conversation`, `Message`, `ConversationStore` types match between conversation-manager.ts and inquiry-view.ts
- `ArchivistSettings` type matches between settings-tab.ts and main.ts
- `StreamEvent` type matches between agent-service.ts and inquiry-view.ts
- `SrdStore` class interface matches between srd-store.ts, srd-tools.ts, and mcp-server.ts
- `enrichMonster`/`enrichSpell`/`enrichItem` signatures match between entity-enrichment.ts and generation-tools.ts
