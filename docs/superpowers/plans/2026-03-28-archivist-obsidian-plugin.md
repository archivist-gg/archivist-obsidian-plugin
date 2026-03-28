# Archivist Obsidian Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an Obsidian plugin that renders TTRPG stat blocks (monster, spell, magic item) and inline DnD tags with archivist's exact visual design.

**Architecture:** Single Obsidian plugin using `registerMarkdownCodeBlockProcessor` for fenced code blocks (`monster`, `spell`, `item`), CodeMirror 6 `ViewPlugin` for live-preview inline tags, and `MarkdownPostProcessor` for reading-view inline tags. Modals provide guided block creation. All CSS ported 1:1 from archivist's parchment theme.

**Tech Stack:** TypeScript, Obsidian Plugin API, esbuild, js-yaml, CodeMirror 6, Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-archivist-obsidian-plugin-design.md`

**Archivist source (read-only reference):** `/Users/shinoobi/w/archivist`

---

## File Structure

```
archivist-obsidian/
├── manifest.json                    # Obsidian plugin manifest
├── versions.json                    # Version compatibility map
├── package.json                     # Dependencies and scripts
├── tsconfig.json                    # TypeScript config
├── esbuild.config.mjs              # Build config
├── styles.css                       # All plugin CSS (Obsidian auto-loads this)
├── src/
│   ├── main.ts                      # Plugin entry: registers processors, commands
│   ├── types/
│   │   ├── monster.ts               # Monster YAML schema interface
│   │   ├── spell.ts                 # Spell YAML schema interface
│   │   └── item.ts                  # Item YAML schema interface
│   ├── parsers/
│   │   ├── yaml-utils.ts            # Shared YAML parsing + validation helpers
│   │   ├── monster-parser.ts        # YAML string -> Monster object
│   │   ├── spell-parser.ts          # YAML string -> Spell object
│   │   ├── item-parser.ts           # YAML string -> Item object
│   │   └── inline-tag-parser.ts     # Backtick content -> tag type + data
│   ├── renderers/
│   │   ├── renderer-utils.ts        # Shared DOM helpers (createPropertyLine, createSvgBar, etc.)
│   │   ├── monster-renderer.ts      # Monster -> DOM elements
│   │   ├── spell-renderer.ts        # Spell -> DOM elements
│   │   ├── item-renderer.ts         # Item -> DOM elements
│   │   └── inline-tag-renderer.ts   # Tag -> styled span element
│   ├── modals/
│   │   ├── modal-utils.ts           # Shared modal helpers (addRepeatable, generateYaml)
│   │   ├── monster-modal.ts         # Monster creation form modal
│   │   ├── spell-modal.ts           # Spell creation form modal
│   │   └── item-modal.ts            # Item creation form modal
│   └── extensions/
│       └── inline-tag-extension.ts  # CM6 ViewPlugin for live preview
├── tests/
│   ├── monster-parser.test.ts       # Monster parser tests
│   ├── spell-parser.test.ts         # Spell parser tests
│   ├── item-parser.test.ts          # Item parser tests
│   └── inline-tag-parser.test.ts    # Inline tag parser tests
└── test-vault/                      # Sample vault for manual testing
    └── TTRPG Test.md                # All block types + inline tags
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `versions.json`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.config.mjs`
- Create: `src/main.ts` (minimal shell)
- Create: `.gitignore`

- [ ] **Step 1: Create manifest.json**

```json
{
  "id": "archivist-ttrpg-blocks",
  "name": "Archivist TTRPG Blocks",
  "version": "0.1.0",
  "minAppVersion": "1.0.0",
  "description": "Render D&D 5e monster stat blocks, spell blocks, magic item blocks, and inline DnD tags with classic parchment styling.",
  "author": "Shinoobi",
  "isDesktopOnly": false
}
```

- [ ] **Step 2: Create versions.json**

```json
{
  "0.1.0": "1.0.0"
}
```

- [ ] **Step 3: Create package.json**

```json
{
  "name": "archivist-ttrpg-blocks",
  "version": "0.1.0",
  "description": "Obsidian plugin for D&D 5e TTRPG content blocks",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "keywords": [],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "@types/node": "^22.0.0",
    "builtin-modules": "^4.0.0",
    "esbuild": "^0.24.0",
    "obsidian": "latest",
    "tslib": "^2.7.0",
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  },
  "dependencies": {
    "js-yaml": "^4.1.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "inlineSourceMap": true,
    "inlineSources": true,
    "module": "ESNext",
    "target": "ES6",
    "allowJs": true,
    "noImplicitAny": true,
    "moduleResolution": "node",
    "importHelpers": true,
    "isolatedModules": true,
    "strictNullChecks": true,
    "lib": ["DOM", "ES5", "ES6", "ES7"],
    "outDir": "./dist",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "tests"]
}
```

- [ ] **Step 5: Create esbuild.config.mjs**

```javascript
import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";

const banner = `/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/
`;

const prod = process.argv[2] === "production";

const context = await esbuild.context({
  banner: { js: banner },
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
main.js
*.js.map
data.json
.superpowers/
```

- [ ] **Step 7: Create minimal src/main.ts**

```typescript
import { Plugin } from "obsidian";

export default class ArchivistPlugin extends Plugin {
  async onload() {
    console.log("Archivist TTRPG Blocks loaded");
  }

  onunload() {
    console.log("Archivist TTRPG Blocks unloaded");
  }
}
```

- [ ] **Step 8: Install dependencies and verify build**

Run: `npm install`
Expected: node_modules created, no errors

Run: `npm run build`
Expected: `main.js` created in root directory, no errors

- [ ] **Step 9: Commit**

```bash
git add manifest.json versions.json package.json tsconfig.json esbuild.config.mjs .gitignore src/main.ts
git commit -m "feat: scaffold obsidian plugin project"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types/monster.ts`
- Create: `src/types/spell.ts`
- Create: `src/types/item.ts`

- [ ] **Step 1: Create src/types/monster.ts**

```typescript
export interface MonsterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface MonsterAC {
  ac: number;
  from?: string[];
}

export interface MonsterHP {
  average: number;
  formula?: string;
}

export interface MonsterSpeed {
  walk?: number;
  fly?: number;
  swim?: number;
  climb?: number;
  burrow?: number;
}

export interface MonsterFeature {
  name: string;
  entries: string[];
}

export interface Monster {
  name: string;
  size?: string;
  type?: string;
  subtype?: string;
  alignment?: string;
  cr?: string;
  ac?: MonsterAC[];
  hp?: MonsterHP;
  speed?: MonsterSpeed;
  abilities?: MonsterAbilities;
  saves?: Partial<Record<string, number>>;
  skills?: Record<string, number>;
  senses?: string[];
  passive_perception?: number;
  languages?: string[];
  damage_vulnerabilities?: string[];
  damage_resistances?: string[];
  damage_immunities?: string[];
  condition_immunities?: string[];
  traits?: MonsterFeature[];
  actions?: MonsterFeature[];
  reactions?: MonsterFeature[];
  legendary?: MonsterFeature[];
  legendary_actions?: number;
  legendary_resistance?: number;
}
```

- [ ] **Step 2: Create src/types/spell.ts**

```typescript
export interface Spell {
  name: string;
  level?: number;
  school?: string;
  casting_time?: string;
  range?: string;
  components?: string;
  duration?: string;
  concentration?: boolean;
  ritual?: boolean;
  classes?: string[];
  description?: string[];
  at_higher_levels?: string[];
}
```

- [ ] **Step 3: Create src/types/item.ts**

```typescript
export interface Item {
  name: string;
  type?: string;
  rarity?: string;
  attunement?: boolean | string;
  weight?: number;
  value?: number;
  damage?: string;
  damage_type?: string;
  properties?: string[];
  charges?: number;
  recharge?: string;
  curse?: boolean;
  entries?: string[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add type definitions for monster, spell, and item"
```

---

### Task 3: Shared YAML Utilities + Monster Parser with Tests

**Files:**
- Create: `src/parsers/yaml-utils.ts`
- Create: `src/parsers/monster-parser.ts`
- Create: `tests/monster-parser.test.ts`

- [ ] **Step 1: Create src/parsers/yaml-utils.ts**

```typescript
import yaml from "js-yaml";

export type ParseResult<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

export function parseYaml<T>(source: string, requiredFields: string[]): ParseResult<T> {
  try {
    const data = yaml.load(source) as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return { success: false, error: "Invalid YAML: expected an object" };
    }
    for (const field of requiredFields) {
      if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === "") {
        return { success: false, error: `Missing required field: ${field}` };
      }
    }
    return { success: true, data: data as T };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: `YAML parse error: ${msg}` };
  }
}

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
```

- [ ] **Step 2: Write failing monster parser tests**

Create `tests/monster-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseMonster } from "../src/parsers/monster-parser";

describe("parseMonster", () => {
  it("parses a minimal monster (name only)", () => {
    const result = parseMonster("name: Goblin");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Goblin");
    }
  });

  it("fails when name is missing", () => {
    const result = parseMonster("size: Medium");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("name");
    }
  });

  it("parses a full monster", () => {
    const yaml = `
name: Goblin
size: Small
type: Humanoid
alignment: Neutral Evil
cr: "1/4"
ac:
  - ac: 15
    from: [leather armor, shield]
hp:
  average: 7
  formula: 2d6
speed:
  walk: 30
abilities:
  str: 8
  dex: 14
  con: 10
  int: 10
  wis: 8
  cha: 8
skills:
  Stealth: 6
senses: [darkvision 60 ft.]
passive_perception: 9
languages: [Common, Goblin]
traits:
  - name: Nimble Escape
    entries:
      - The goblin can take the Disengage or Hide action as a bonus action on each of its turns.
actions:
  - name: Scimitar
    entries:
      - "Melee Weapon Attack: +4 to hit, reach 5 ft., one target."
`;
    const result = parseMonster(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      const m = result.data;
      expect(m.name).toBe("Goblin");
      expect(m.size).toBe("Small");
      expect(m.cr).toBe("1/4");
      expect(m.ac?.[0].ac).toBe(15);
      expect(m.ac?.[0].from).toEqual(["leather armor", "shield"]);
      expect(m.hp?.average).toBe(7);
      expect(m.speed?.walk).toBe(30);
      expect(m.abilities?.str).toBe(8);
      expect(m.abilities?.dex).toBe(14);
      expect(m.skills?.Stealth).toBe(6);
      expect(m.traits?.length).toBe(1);
      expect(m.traits?.[0].name).toBe("Nimble Escape");
      expect(m.actions?.length).toBe(1);
    }
  });

  it("fails on invalid YAML", () => {
    const result = parseMonster("name: [invalid: yaml: {{");
    expect(result.success).toBe(false);
  });

  it("coerces cr to string", () => {
    const result = parseMonster("name: Test\ncr: 5");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cr).toBe("5");
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/monster-parser.test.ts`
Expected: FAIL -- module `../src/parsers/monster-parser` not found

- [ ] **Step 4: Implement monster parser**

Create `src/parsers/monster-parser.ts`:

```typescript
import { Monster } from "../types/monster";
import { ParseResult, parseYaml } from "./yaml-utils";

export function parseMonster(source: string): ParseResult<Monster> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const monster: Monster = {
    name: String(raw.name),
  };

  if (raw.size != null) monster.size = String(raw.size);
  if (raw.type != null) monster.type = String(raw.type);
  if (raw.subtype != null) monster.subtype = String(raw.subtype);
  if (raw.alignment != null) monster.alignment = String(raw.alignment);
  if (raw.cr != null) monster.cr = String(raw.cr);

  if (Array.isArray(raw.ac)) {
    monster.ac = raw.ac.map((entry: Record<string, unknown>) => ({
      ac: Number(entry.ac),
      from: Array.isArray(entry.from) ? entry.from.map(String) : undefined,
    }));
  }

  if (raw.hp && typeof raw.hp === "object") {
    const hp = raw.hp as Record<string, unknown>;
    monster.hp = {
      average: Number(hp.average),
      formula: hp.formula != null ? String(hp.formula) : undefined,
    };
  }

  if (raw.speed && typeof raw.speed === "object") {
    const speed = raw.speed as Record<string, unknown>;
    monster.speed = {};
    for (const key of ["walk", "fly", "swim", "climb", "burrow"] as const) {
      if (speed[key] != null) monster.speed[key] = Number(speed[key]);
    }
  }

  if (raw.abilities && typeof raw.abilities === "object") {
    const ab = raw.abilities as Record<string, unknown>;
    monster.abilities = {
      str: Number(ab.str ?? 10),
      dex: Number(ab.dex ?? 10),
      con: Number(ab.con ?? 10),
      int: Number(ab.int ?? 10),
      wis: Number(ab.wis ?? 10),
      cha: Number(ab.cha ?? 10),
    };
  }

  if (raw.saves && typeof raw.saves === "object") {
    const saves: Partial<Record<string, number>> = {};
    for (const [key, val] of Object.entries(raw.saves as Record<string, unknown>)) {
      saves[key] = Number(val);
    }
    monster.saves = saves;
  }

  if (raw.skills && typeof raw.skills === "object") {
    const skills: Record<string, number> = {};
    for (const [key, val] of Object.entries(raw.skills as Record<string, unknown>)) {
      skills[key] = Number(val);
    }
    monster.skills = skills;
  }

  if (Array.isArray(raw.senses)) monster.senses = raw.senses.map(String);
  if (raw.passive_perception != null) monster.passive_perception = Number(raw.passive_perception);
  if (Array.isArray(raw.languages)) monster.languages = raw.languages.map(String);
  if (Array.isArray(raw.damage_vulnerabilities)) monster.damage_vulnerabilities = raw.damage_vulnerabilities.map(String);
  if (Array.isArray(raw.damage_resistances)) monster.damage_resistances = raw.damage_resistances.map(String);
  if (Array.isArray(raw.damage_immunities)) monster.damage_immunities = raw.damage_immunities.map(String);
  if (Array.isArray(raw.condition_immunities)) monster.condition_immunities = raw.condition_immunities.map(String);

  const parseFeatures = (arr: unknown): { name: string; entries: string[] }[] | undefined => {
    if (!Array.isArray(arr)) return undefined;
    return arr.map((f: Record<string, unknown>) => ({
      name: String(f.name ?? ""),
      entries: Array.isArray(f.entries) ? f.entries.map(String) : [],
    }));
  };

  monster.traits = parseFeatures(raw.traits);
  monster.actions = parseFeatures(raw.actions);
  monster.reactions = parseFeatures(raw.reactions);
  monster.legendary = parseFeatures(raw.legendary);

  if (raw.legendary_actions != null) monster.legendary_actions = Number(raw.legendary_actions);
  if (raw.legendary_resistance != null) monster.legendary_resistance = Number(raw.legendary_resistance);

  return { success: true, data: monster };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/monster-parser.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/parsers/yaml-utils.ts src/parsers/monster-parser.ts tests/monster-parser.test.ts
git commit -m "feat: add monster parser with YAML validation and tests"
```

---

### Task 4: Spell Parser with Tests

**Files:**
- Create: `src/parsers/spell-parser.ts`
- Create: `tests/spell-parser.test.ts`

- [ ] **Step 1: Write failing spell parser tests**

Create `tests/spell-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseSpell } from "../src/parsers/spell-parser";

describe("parseSpell", () => {
  it("parses a minimal spell (name only)", () => {
    const result = parseSpell("name: Magic Missile");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Magic Missile");
    }
  });

  it("fails when name is missing", () => {
    const result = parseSpell("level: 3");
    expect(result.success).toBe(false);
  });

  it("parses a full spell", () => {
    const yaml = `
name: Fireball
level: 3
school: Evocation
casting_time: 1 action
range: 150 feet
components: V, S, M (a tiny ball of bat guano and sulfur)
duration: Instantaneous
concentration: false
ritual: false
classes: [Sorcerer, Wizard]
description:
  - "A bright streak flashes from your pointing finger."
at_higher_levels:
  - "Damage increases by 1d6 for each slot level above 3rd."
`;
    const result = parseSpell(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      const s = result.data;
      expect(s.name).toBe("Fireball");
      expect(s.level).toBe(3);
      expect(s.school).toBe("Evocation");
      expect(s.concentration).toBe(false);
      expect(s.ritual).toBe(false);
      expect(s.classes).toEqual(["Sorcerer", "Wizard"]);
      expect(s.description?.length).toBe(1);
      expect(s.at_higher_levels?.length).toBe(1);
    }
  });

  it("parses a cantrip (level 0)", () => {
    const result = parseSpell("name: Fire Bolt\nlevel: 0\nschool: Evocation");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.level).toBe(0);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/spell-parser.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement spell parser**

Create `src/parsers/spell-parser.ts`:

```typescript
import { Spell } from "../types/spell";
import { ParseResult, parseYaml } from "./yaml-utils";

export function parseSpell(source: string): ParseResult<Spell> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const spell: Spell = {
    name: String(raw.name),
  };

  if (raw.level != null) spell.level = Number(raw.level);
  if (raw.school != null) spell.school = String(raw.school);
  if (raw.casting_time != null) spell.casting_time = String(raw.casting_time);
  if (raw.range != null) spell.range = String(raw.range);
  if (raw.components != null) spell.components = String(raw.components);
  if (raw.duration != null) spell.duration = String(raw.duration);
  if (raw.concentration != null) spell.concentration = Boolean(raw.concentration);
  if (raw.ritual != null) spell.ritual = Boolean(raw.ritual);
  if (Array.isArray(raw.classes)) spell.classes = raw.classes.map(String);
  if (Array.isArray(raw.description)) spell.description = raw.description.map(String);
  if (Array.isArray(raw.at_higher_levels)) spell.at_higher_levels = raw.at_higher_levels.map(String);

  return { success: true, data: spell };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/spell-parser.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/parsers/spell-parser.ts tests/spell-parser.test.ts
git commit -m "feat: add spell parser with tests"
```

---

### Task 5: Item Parser with Tests

**Files:**
- Create: `src/parsers/item-parser.ts`
- Create: `tests/item-parser.test.ts`

- [ ] **Step 1: Write failing item parser tests**

Create `tests/item-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseItem } from "../src/parsers/item-parser";

describe("parseItem", () => {
  it("parses a minimal item (name only)", () => {
    const result = parseItem("name: Bag of Holding");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Bag of Holding");
    }
  });

  it("fails when name is missing", () => {
    const result = parseItem("rarity: Rare");
    expect(result.success).toBe(false);
  });

  it("parses a full magic item", () => {
    const yaml = `
name: Flame Tongue Longsword
type: Weapon (longsword)
rarity: Rare
attunement: true
weight: 3
damage: 1d8
damage_type: slashing
properties: [Versatile (1d10)]
entries:
  - "You can use a bonus action to speak this magic sword's command word."
`;
    const result = parseItem(yaml);
    expect(result.success).toBe(true);
    if (result.success) {
      const i = result.data;
      expect(i.name).toBe("Flame Tongue Longsword");
      expect(i.rarity).toBe("Rare");
      expect(i.attunement).toBe(true);
      expect(i.weight).toBe(3);
      expect(i.properties).toEqual(["Versatile (1d10)"]);
      expect(i.entries?.length).toBe(1);
    }
  });

  it("parses attunement as string", () => {
    const result = parseItem("name: Test\nattunement: by a warlock");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.attunement).toBe("by a warlock");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/item-parser.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement item parser**

Create `src/parsers/item-parser.ts`:

```typescript
import { Item } from "../types/item";
import { ParseResult, parseYaml } from "./yaml-utils";

export function parseItem(source: string): ParseResult<Item> {
  const result = parseYaml<Record<string, unknown>>(source, ["name"]);
  if (!result.success) return result;

  const raw = result.data;

  const item: Item = {
    name: String(raw.name),
  };

  if (raw.type != null) item.type = String(raw.type);
  if (raw.rarity != null) item.rarity = String(raw.rarity);
  if (raw.attunement != null && raw.attunement !== null) {
    if (typeof raw.attunement === "boolean") {
      item.attunement = raw.attunement;
    } else if (typeof raw.attunement === "string") {
      item.attunement = raw.attunement;
    }
  }
  if (raw.weight != null) item.weight = Number(raw.weight);
  if (raw.value != null) item.value = Number(raw.value);
  if (raw.damage != null) item.damage = String(raw.damage);
  if (raw.damage_type != null) item.damage_type = String(raw.damage_type);
  if (Array.isArray(raw.properties)) item.properties = raw.properties.map(String);
  if (raw.charges != null && raw.charges !== null) item.charges = Number(raw.charges);
  if (raw.recharge != null && raw.recharge !== null) item.recharge = String(raw.recharge);
  if (raw.curse != null) item.curse = Boolean(raw.curse);
  if (Array.isArray(raw.entries)) item.entries = raw.entries.map(String);

  return { success: true, data: item };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/item-parser.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/parsers/item-parser.ts tests/item-parser.test.ts
git commit -m "feat: add item parser with tests"
```

---

### Task 6: Inline Tag Parser with Tests

**Files:**
- Create: `src/parsers/inline-tag-parser.ts`
- Create: `tests/inline-tag-parser.test.ts`

- [ ] **Step 1: Write failing inline tag parser tests**

Create `tests/inline-tag-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseInlineTag } from "../src/parsers/inline-tag-parser";

describe("parseInlineTag", () => {
  it("parses dice tag", () => {
    const result = parseInlineTag("dice:2d6+3");
    expect(result).toEqual({ type: "dice", content: "2d6+3" });
  });

  it("parses damage tag with type", () => {
    const result = parseInlineTag("damage:3d8 fire");
    expect(result).toEqual({ type: "damage", content: "3d8 fire" });
  });

  it("parses dc tag", () => {
    const result = parseInlineTag("dc:15");
    expect(result).toEqual({ type: "dc", content: "15" });
  });

  it("parses atk tag", () => {
    const result = parseInlineTag("atk:+7");
    expect(result).toEqual({ type: "atk", content: "+7" });
  });

  it("parses mod tag", () => {
    const result = parseInlineTag("mod:+5");
    expect(result).toEqual({ type: "mod", content: "+5" });
  });

  it("parses check tag", () => {
    const result = parseInlineTag("check:DEX 14");
    expect(result).toEqual({ type: "check", content: "DEX 14" });
  });

  it("returns null for unknown prefix", () => {
    const result = parseInlineTag("foo:bar");
    expect(result).toBeNull();
  });

  it("returns null for plain code", () => {
    const result = parseInlineTag("const x = 5");
    expect(result).toBeNull();
  });

  it("trims whitespace from content", () => {
    const result = parseInlineTag("dice: 1d20 + 5 ");
    expect(result).toEqual({ type: "dice", content: "1d20 + 5" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/inline-tag-parser.test.ts`
Expected: FAIL -- module not found

- [ ] **Step 3: Implement inline tag parser**

Create `src/parsers/inline-tag-parser.ts`:

```typescript
export type InlineTagType = "dice" | "damage" | "dc" | "atk" | "mod" | "check";

export interface InlineTag {
  type: InlineTagType;
  content: string;
}

const VALID_PREFIXES: InlineTagType[] = ["dice", "damage", "dc", "atk", "mod", "check"];

export function parseInlineTag(text: string): InlineTag | null {
  const colonIndex = text.indexOf(":");
  if (colonIndex === -1) return null;

  const prefix = text.slice(0, colonIndex).trim().toLowerCase();
  if (!VALID_PREFIXES.includes(prefix as InlineTagType)) return null;

  const content = text.slice(colonIndex + 1).trim();
  if (content.length === 0) return null;

  return { type: prefix as InlineTagType, content };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/inline-tag-parser.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/parsers/inline-tag-parser.ts tests/inline-tag-parser.test.ts
git commit -m "feat: add inline tag parser with tests"
```

---

### Task 7: CSS Styles (Ported from Archivist)

**Files:**
- Create: `styles.css`

This is a direct 1:1 port of archivist's CSS. All Tailwind `@apply` directives are converted to plain CSS. All class names are prefixed with `archivist-` to avoid Obsidian theme conflicts. Google Fonts are imported for Libre Baskerville and Noto Sans.

- [ ] **Step 1: Create styles.css**

Port the CSS from these archivist source files, converting Tailwind utilities to plain CSS and prefixing all selectors with `archivist-`:
- `/Users/shinoobi/w/archivist/client/src/styles/variables/dnd-theme.css` -> CSS custom properties
- `/Users/shinoobi/w/archivist/client/src/styles/original-monster-stat-block.css` -> monster block styles
- `/Users/shinoobi/w/archivist/client/src/styles/original-spell-block.css` -> spell block styles
- `/Users/shinoobi/w/archivist/client/src/styles/legendary-resistance.css` -> legendary resistance boxes
- `/Users/shinoobi/w/archivist/client/src/styles/dnd-tag-render.css` -> inline tag styles

The file will be large (~600-800 lines). Port each archivist file section by section, converting:
- Tailwind `@apply` to equivalent CSS properties (e.g., `@apply inline-flex items-center px-1.5` becomes `display: inline-flex; align-items: center; padding: 0 6px;`)
- `.original-monster-stat-block` prefix becomes `.archivist-monster-block`
- `.original-spell-block` prefix becomes `.archivist-spell-block`
- `.dnd-tag` prefix becomes `.archivist-tag`
- `.legendary-resistance` prefix becomes `.archivist-legendary-resistance`
- `.dark` selector for dark mode becomes `.theme-dark` (Obsidian's dark mode class)
- `.ProseMirror` selectors are removed (not relevant in Obsidian)

Key sections in `styles.css`:
1. Google Fonts import (Libre Baskerville, Noto Sans)
2. CSS Custom Properties (D&D theme variables)
3. Monster stat block (wrapper, header, name, type, SVG bar, properties, abilities table, tabs, features)
4. Spell block (wrapper, header, properties with icons, description, higher levels, classes, tags)
5. Magic item block (same parchment pattern as spell block with item-specific selectors)
6. Inline tags (base, dice, damage, atk, dc, mod, check, hover, dark mode)
7. Legendary resistance tracking boxes
8. Error state styling
9. Responsive adjustments

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: port archivist CSS for stat blocks and inline tags"
```

---

### Task 8: Renderer Utilities + Inline Tag Renderer

**Files:**
- Create: `src/renderers/renderer-utils.ts`
- Create: `src/renderers/inline-tag-renderer.ts`

- [ ] **Step 1: Create src/renderers/inline-tag-renderer.ts**

```typescript
import { setIcon } from "obsidian";
import { InlineTag, InlineTagType } from "../parsers/inline-tag-parser";

interface TagConfig {
  icon: string;
  cssClass: string;
  formatContent: (content: string) => string;
}

const TAG_CONFIGS: Record<InlineTagType, TagConfig> = {
  dice: {
    icon: "dices",
    cssClass: "archivist-tag-dice",
    formatContent: (c) => c,
  },
  damage: {
    icon: "dices",
    cssClass: "archivist-tag-damage",
    formatContent: (c) => c,
  },
  dc: {
    icon: "shield",
    cssClass: "archivist-tag-dc",
    formatContent: (c) => `DC ${c}`,
  },
  atk: {
    icon: "swords",
    cssClass: "archivist-tag-atk",
    formatContent: (c) => `${c} to hit`,
  },
  mod: {
    icon: "plus-minus",
    cssClass: "archivist-tag-mod",
    formatContent: (c) => c,
  },
  check: {
    icon: "shield-check",
    cssClass: "archivist-tag-check",
    formatContent: (c) => c,
  },
};

export function renderInlineTag(tag: InlineTag): HTMLElement {
  const config = TAG_CONFIGS[tag.type];

  const span = document.createElement("span");
  span.addClasses(["archivist-tag", config.cssClass]);

  const iconEl = document.createElement("span");
  iconEl.addClass("archivist-tag-icon");
  setIcon(iconEl, config.icon);
  span.appendChild(iconEl);

  const contentEl = document.createElement("span");
  contentEl.addClass("archivist-tag-content");
  contentEl.textContent = config.formatContent(tag.content);
  span.appendChild(contentEl);

  return span;
}
```

- [ ] **Step 2: Create src/renderers/renderer-utils.ts**

```typescript
import { setIcon } from "obsidian";
import { abilityModifier, formatModifier } from "../parsers/yaml-utils";
import { parseInlineTag } from "../parsers/inline-tag-parser";
import { renderInlineTag } from "./inline-tag-renderer";

export function el(
  tag: string,
  opts?: { cls?: string | string[]; text?: string; attr?: Record<string, string>; parent?: HTMLElement }
): HTMLElement {
  const element = document.createElement(tag);
  if (opts?.cls) {
    const classes = Array.isArray(opts.cls) ? opts.cls : [opts.cls];
    element.addClasses(classes);
  }
  if (opts?.text) element.textContent = opts.text;
  if (opts?.attr) {
    for (const [k, v] of Object.entries(opts.attr)) {
      element.setAttribute(k, v);
    }
  }
  if (opts?.parent) opts.parent.appendChild(element);
  return element;
}

export function createSvgBar(parent: HTMLElement): void {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("height", "5");
  svg.setAttribute("width", "100%");
  svg.classList.add("archivist-stat-block-bar");

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", "0,0 400,2.5 0,5");
  svg.appendChild(polyline);
  parent.appendChild(svg);
}

export function createPropertyLine(
  parent: HTMLElement,
  label: string,
  value: string,
  isLast = false
): HTMLElement {
  const line = el("div", { cls: isLast ? ["archivist-property-line", "last"] : "archivist-property-line", parent });
  el("h4", { text: label, parent: line });
  el("p", { text: value, parent: line });
  return line;
}

export function createIconProperty(
  parent: HTMLElement,
  iconName: string,
  label: string,
  value: string
): HTMLElement {
  const line = el("div", { cls: "archivist-property-line-icon", parent });
  const iconEl = el("span", { cls: "archivist-property-icon", parent: line });
  setIcon(iconEl, iconName);
  el("span", { cls: "archivist-property-label", text: label, parent: line });
  el("span", { cls: "archivist-property-value", text: value, parent: line });
  return line;
}

export function renderTextWithInlineTags(text: string, parent: HTMLElement): void {
  const regex = /`((?:dice|damage|dc|atk|mod|check):[^`]+)`/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parent.appendText(text.slice(lastIndex, match.index));
    }

    const tagContent = match[1];
    const parsed = parseInlineTag(tagContent);
    if (parsed) {
      const tagEl = renderInlineTag(parsed);
      parent.appendChild(tagEl);
    } else {
      el("code", { text: tagContent, parent });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parent.appendText(text.slice(lastIndex));
  }
}

export function createErrorBlock(error: string, rawSource: string): HTMLElement {
  const container = el("div", { cls: "archivist-error-block" });
  const banner = el("div", { cls: "archivist-error-banner", parent: container });
  const iconEl = el("span", { cls: "archivist-error-icon", parent: banner });
  setIcon(iconEl, "alert-triangle");
  el("span", { text: error, parent: banner });
  el("pre", { cls: "archivist-error-source", text: rawSource, parent: container });
  return container;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderers/renderer-utils.ts src/renderers/inline-tag-renderer.ts
git commit -m "feat: add renderer utilities and inline tag renderer"
```

---

### Task 9: Monster Renderer

**Files:**
- Create: `src/renderers/monster-renderer.ts`

Renders a `Monster` object into DOM elements matching archivist's exact stat block layout. Reference archivist source: `/Users/shinoobi/w/archivist/client/src/components/editor/OriginalMonsterStatBlock.tsx` and `/Users/shinoobi/w/archivist/client/src/styles/original-monster-stat-block.css`.

- [ ] **Step 1: Create src/renderers/monster-renderer.ts**

This is the largest renderer. It must produce the exact same DOM structure as archivist's `OriginalMonsterStatBlock`:
1. Wrapper div (`.archivist-monster-block-wrapper`) with max-width 400px
2. Block div (`.archivist-monster-block`) with parchment bg
3. Header: monster name (Libre Baskerville, small-caps) + type line (italic)
4. SVG bar
5. Core properties (AC, HP, Speed) with hanging indent property lines
6. SVG bar
7. Abilities table (6-col, centered)
8. SVG bar
9. Secondary properties (saves, skills, damage types, senses, languages, CR)
10. SVG bar
11. Tab navigation (Traits/Actions/Reactions/Legendary) with JS click handlers
12. Tab content with feature entries (bold italic name + description)
13. Legendary resistance tracking boxes (interactive checkboxes with X marks)

Full implementation: see the code block in Task 10 of the monster-renderer in the renderers section. The renderer uses `el()`, `createSvgBar()`, `createPropertyLine()`, and `renderTextWithInlineTags()` from `renderer-utils.ts`. Tab switching is done via `addEventListener("click", ...)` that toggles `.active` class and `display` style on tab content divs.

Write the full implementation following the DOM structure and class names from archivist. Every CSS class must match the `archivist-` prefixed versions defined in `styles.css` (Task 7).

- [ ] **Step 2: Commit**

```bash
git add src/renderers/monster-renderer.ts
git commit -m "feat: add monster block renderer with 1:1 archivist layout"
```

---

### Task 10: Spell Renderer

**Files:**
- Create: `src/renderers/spell-renderer.ts`

Reference archivist source: `/Users/shinoobi/w/archivist/client/src/components/editor/OriginalSpellBlock.tsx` and `/Users/shinoobi/w/archivist/client/src/styles/original-spell-block.css`.

- [ ] **Step 1: Create src/renderers/spell-renderer.ts**

DOM structure:
1. Wrapper div (`.archivist-spell-block-wrapper`)
2. Block div (`.archivist-spell-block`) with parchment bg
3. Header: spell name (Libre Baskerville, 23px) + school line (italic) + 2px bottom border
4. Properties with Lucide icons: Clock (casting_time), Target (range), Box (components), Sparkles (duration)
5. Description paragraphs (justified, with inline tag rendering)
6. At Higher Levels section (italic header, border-top)
7. Classes list with BookOpen icon
8. Concentration/Ritual tags (red/blue badges)

Uses `createIconProperty()` for property lines and `renderTextWithInlineTags()` for descriptions. `formatSpellLevel()` helper converts level + school to display string (e.g., "3rd-level Evocation", "Evocation cantrip").

- [ ] **Step 2: Commit**

```bash
git add src/renderers/spell-renderer.ts
git commit -m "feat: add spell block renderer with icon properties and tags"
```

---

### Task 11: Item Renderer

**Files:**
- Create: `src/renderers/item-renderer.ts`

Reference archivist source: `/Users/shinoobi/w/archivist/client/src/components/editor/OriginalMagicItemBlock.tsx`.

- [ ] **Step 1: Create src/renderers/item-renderer.ts**

DOM structure (same parchment theme as spell block):
1. Wrapper div (`.archivist-item-block-wrapper`)
2. Block div (`.archivist-item-block`) with parchment bg
3. Header: item name (Libre Baskerville, 23px) + subtitle (type, rarity, attunement) + 2px bottom border
4. Properties with Lucide icons: Sparkles (attunement), Scale (weight), Coins (value), Swords (damage), Shield (properties)
5. Description entries with inline tag rendering
6. Charges/recharge info
7. Curse indicator

`formatSubtitle()` helper combines type, rarity, and attunement into a single italic line. `formatAttunement()` converts `true` to "Required" and strings to their value.

- [ ] **Step 2: Commit**

```bash
git add src/renderers/item-renderer.ts
git commit -m "feat: add magic item block renderer"
```

---

### Task 12: Modal Utilities + Monster Modal

**Files:**
- Create: `src/modals/modal-utils.ts`
- Create: `src/modals/monster-modal.ts`

- [ ] **Step 1: Create src/modals/modal-utils.ts**

Shared helpers used by all three modals:
- `addTextField(container, name, placeholder, onChange)` -- wraps `Setting.addText()`
- `addDropdown(container, name, options, onChange)` -- wraps `Setting.addDropdown()`
- `addToggle(container, name, onChange)` -- wraps `Setting.addToggle()`
- `addNumberField(container, name, placeholder, onChange)` -- text input with `type="number"`
- `addTextArea(container, name, placeholder, onChange)` -- wraps `Setting.addTextArea()`
- `addRepeatableSection(container, sectionName, entries, onUpdate)` -- dynamic list of name+text pairs with add/remove buttons
- `toYamlString(obj, indent)` -- converts a JS object to YAML string (handles strings, numbers, booleans, arrays, nested objects, quoting special chars)

- [ ] **Step 2: Create src/modals/monster-modal.ts**

`MonsterModal extends Modal` with fields for all monster properties. Uses `MonsterFormData` interface to track form state. `onOpen()` renders the form using helpers from `modal-utils.ts`. `insertBlock()` converts form data to a YAML object, calls `toYamlString()`, wraps in `` ```monster `` fences, and calls `editor.replaceSelection()`.

Fields: Name (required), Size (dropdown), Type, Alignment, CR, AC + source, HP average + formula, Speed (5 fields), Ability Scores (6 fields), Senses, Passive Perception, Languages, Damage/Condition Immunities, Legendary Actions/Resistance counts, Traits/Actions/Reactions/Legendary (repeatable sections).

- [ ] **Step 3: Commit**

```bash
git add src/modals/modal-utils.ts src/modals/monster-modal.ts
git commit -m "feat: add monster creation modal with YAML generation"
```

---

### Task 13: Spell and Item Modals

**Files:**
- Create: `src/modals/spell-modal.ts`
- Create: `src/modals/item-modal.ts`

- [ ] **Step 1: Create src/modals/spell-modal.ts**

`SpellModal extends Modal`. Fields: Name (required), Level (dropdown 0-9), School (dropdown), Casting Time, Range, Components, Duration, Concentration (toggle), Ritual (toggle), Classes (text, comma-separated), Description (textarea), At Higher Levels (textarea). `insertBlock()` wraps output in `` ```spell `` fences.

- [ ] **Step 2: Create src/modals/item-modal.ts**

`ItemModal extends Modal`. Fields: Name (required), Type, Rarity (dropdown), Attunement (toggle + text), Weight, Damage, Damage Type, Properties (text, comma-separated), Charges, Recharge, Curse (toggle), Description (textarea). `insertBlock()` wraps output in `` ```item `` fences.

- [ ] **Step 3: Commit**

```bash
git add src/modals/spell-modal.ts src/modals/item-modal.ts
git commit -m "feat: add spell and item creation modals"
```

---

### Task 14: CodeMirror 6 Inline Tag Extension (Live Preview)

**Files:**
- Create: `src/extensions/inline-tag-extension.ts`

- [ ] **Step 1: Create src/extensions/inline-tag-extension.ts**

A CM6 `ViewPlugin` that:
1. Iterates the syntax tree for `InlineCode` nodes in visible ranges
2. For each inline code node, strips backticks and calls `parseInlineTag()`
3. If it's a valid tag, creates a `Decoration.replace()` with an `InlineTagWidget`
4. `InlineTagWidget.toDOM()` calls `renderInlineTag()` to produce the styled span

The plugin rebuilds decorations on `docChanged` or `viewportChanged`.

```typescript
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { parseInlineTag } from "../parsers/inline-tag-parser";
import { renderInlineTag } from "../renderers/inline-tag-renderer";

class InlineTagWidget extends WidgetType {
  constructor(private tagText: string) {
    super();
  }

  toDOM(): HTMLElement {
    const parsed = parseInlineTag(this.tagText);
    if (parsed) {
      return renderInlineTag(parsed);
    }
    const code = document.createElement("code");
    code.textContent = this.tagText;
    return code;
  }

  eq(other: InlineTagWidget): boolean {
    return this.tagText === other.tagText;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (node.type.name.includes("inline-code") || node.type.name.includes("InlineCode")) {
          const text = view.state.doc.sliceString(node.from, node.to);
          const content = text.startsWith("`") && text.endsWith("`")
            ? text.slice(1, -1)
            : text;

          const parsed = parseInlineTag(content);
          if (parsed) {
            builder.add(
              node.from,
              node.to,
              Decoration.replace({
                widget: new InlineTagWidget(content),
              })
            );
          }
        }
      },
    });
  }

  return builder.finish();
}

export const inlineTagPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);
```

- [ ] **Step 2: Commit**

```bash
git add src/extensions/inline-tag-extension.ts
git commit -m "feat: add CM6 inline tag extension for live preview"
```

---

### Task 15: Main Plugin Entry (Wire Everything Together)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update src/main.ts**

Replace the minimal shell with the full plugin that:
1. Registers code block processors for `monster`, `spell`, `item`
2. Registers a `MarkdownPostProcessor` for inline tags in reading view
3. Registers the CM6 `inlineTagPlugin` for live preview
4. Registers 3 commands: `insert-monster`, `insert-spell`, `insert-item`

Each code block processor calls the parser, then either the renderer (on success) or `createErrorBlock()` (on failure). The post-processor finds `<code>` elements, checks for tag prefixes, and replaces matching ones with rendered tag spans.

```typescript
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

export default class ArchivistPlugin extends Plugin {
  async onload() {
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
  }

  private renderBlock<T>(
    source: string,
    el: HTMLElement,
    parser: (source: string) => { success: true; data: T } | { success: false; error: string },
    renderer: (data: T) => HTMLElement
  ): void {
    const result = parser(source);
    if (result.success) {
      el.appendChild(renderer(result.data));
    } else {
      el.appendChild(createErrorBlock(result.error, source));
    }
  }

  onunload() {}
}
```

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: `main.js` created with no errors

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire up all processors, commands, and extensions in plugin entry"
```

---

### Task 16: Test Vault for Manual Testing

**Files:**
- Create: `test-vault/TTRPG Test.md`

- [ ] **Step 1: Create test-vault/TTRPG Test.md**

A markdown file containing:
- A full monster block (Goblin with traits, actions, all properties)
- A full spell block (Fireball with description, higher levels, concentration)
- A full magic item block (Flame Tongue with entries, attunement)
- Inline tag examples: `dice:1d20+4`, `damage:1d6+2 slashing`, `dc:15`, `atk:+7`, `mod:+5`, `check:DEX 14`
- Minimal blocks (name only) for each type
- An intentionally broken YAML block to test error rendering

- [ ] **Step 2: Commit**

```bash
git add test-vault/
git commit -m "feat: add test vault with all block types and inline tags"
```

---

### Task 17: Run All Tests and Final Build

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass (monster: 5, spell: 4, item: 4, inline tag: 9 = 22 total)

- [ ] **Step 2: Final production build**

Run: `npm run build`
Expected: `main.js` present, no errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete archivist obsidian plugin v0.1.0"
```
