# Archivist Stat Block Audit

Comprehensive audit of gaps in monster, spell, and item stat blocks — covering edit panel fields, view rendering, table support, inline tags, and 5etools tag conversion.

Date: 2026-04-08

---

## Monster Edit Panel Gaps

### High Priority — Fields exist in type/parser but are NOT editable

| Field | In Type | Parsed | Rendered (view) | Editable | Notes |
|-------|---------|--------|-----------------|----------|-------|
| speed.fly | YES | YES | YES | NO | Edit panel only has walk speed input |
| speed.swim | YES | YES | YES | NO | Same — no edit control |
| speed.climb | YES | YES | YES | NO | Same |
| speed.burrow | YES | YES | YES | NO | Same |
| damage_vulnerabilities | YES | YES | YES | NO | No edit control at all |
| damage_resistances | YES | YES | YES | NO | Same |
| damage_immunities | YES | YES | YES | NO | Same |
| condition_immunities | YES | YES | YES | NO | Same |

### Medium Priority — Partial or broken support

| Field | Issue |
|-------|-------|
| bonus_actions | Edit tab infrastructure exists but Monster type, parser, and view renderer don't support it. Data entered is silently lost on re-parse |
| lair_actions | Same phantom tab problem |
| mythic_actions | Same |
| legendary_actions (count) | Used in rendering intro text ("can take 3 legendary actions") but no input to change the number |
| legendary_resistance (count) | Rendered as checkboxes in view but no editor for the count |
| subtype | Parsed from YAML but no edit input and not distinctly rendered (e.g., "Humanoid (elf)") |

### Low Priority — Missing from type entirely

| Field | Notes |
|-------|-------|
| hover | SRD data has it (Spectator, Will-O'-Wisp) but not modeled |
| Spellcasting (structured) | No structured support — spell slots, DC, spells known. Can be hacked into trait text |
| Innate Spellcasting | At-will / X/day lists entirely absent |
| XP in view mode | Calculated in edit mode but not shown in rendered stat block next to CR |
| Proficiency Bonus display | Derived from CR but not shown in view mode |
| Regional Effects | Standard for lair creatures, completely missing |

---

## Spell Edit Panel Gaps

| Field | In Type | Parsed | Rendered | Editable | Notes |
|-------|---------|--------|----------|----------|-------|
| name | YES | YES | YES | YES | |
| level | YES | YES | YES | YES | Dropdown 0-9 |
| school | YES | YES | YES | YES | 8 standard schools |
| casting_time | YES | YES | YES | YES | Free text |
| range | YES | YES | YES | YES | Free text |
| components | YES | YES | YES | YES | Single string — no V/S/M decomposition or separate material description |
| duration | YES | YES | YES | YES | Free text |
| concentration | YES | YES | YES | YES | Checkbox |
| ritual | YES | YES | YES | YES | Checkbox |
| description | YES | YES | YES | YES | Array of paragraphs, no table parsing |
| at_higher_levels | YES | YES | YES | YES | |
| classes | YES | YES | YES | YES | Comma-separated |
| source_book | NO | NO | NO | NO | Missing entirely. CSS `.source-badge` exists but is dead code |

### Gaps

- **Components not structured**: Single string input. Should have V/S/M checkboxes + separate material description field
- **Source Book**: Missing entirely

---

## Item Edit Panel Gaps

| Field | In Type | Parsed | Rendered | Editable | Notes |
|-------|---------|--------|----------|----------|-------|
| name | YES | YES | YES | YES | |
| type | YES | YES | YES | YES | Dropdown (10 types) |
| rarity | YES | YES | YES | YES | Dropdown (Common–Artifact) |
| attunement | YES | YES | YES | YES | Checkbox + condition text |
| weight | YES | YES | YES | YES | |
| value | YES | YES | YES | YES | |
| damage | YES | YES | YES | YES | |
| damage_type | YES | YES | YES | YES | Free text, no dropdown |
| properties | YES | YES | YES | YES | Free text, no validation |
| charges | YES | YES | YES | YES | |
| recharge | YES | YES | YES | YES | Free text |
| curse | YES | YES | YES | YES | Checkbox |
| entries | YES | YES | YES | YES | Array of paragraphs, no table parsing |
| ac_bonus | NO | NO | NO | NO | Missing — no field for armor/shield AC |
| stealth_disadvantage | NO | NO | NO | NO | Missing — no boolean for heavy armor |
| source_book | NO | NO | NO | NO | Missing entirely |

### Gaps

- **AC Bonus**: No field for armor/shield AC modifiers
- **Stealth Disadvantage**: No boolean for heavy armor stealth penalty
- **Damage Type**: Free text, should be dropdown for standard D&D damage types
- **Properties**: Free text, should validate against standard weapon properties
- **Source Book**: Missing entirely

---

## Table Rendering — NOT WORKING

Tables in description/entries text do not render. They appear as flat text.

### Current state

- All three renderers use `renderTextWithInlineTags()` from `src/renderers/renderer-utils.ts`
- This function only supports inline formatting: **bold**, *italic*, ~~strikethrough~~, [links](url)
- Markdown pipe tables (`| col1 | col2 |`) render as raw text
- HTML tables render as raw text (no `innerHTML`, only `textContent`)
- Bullet lists, headers, any block-level markdown renders as raw text
- CSS styles for `.markdown-table` exist in `archivist-dnd.css` (lines 686-740 for spells, 884-935 for items) but are **dead code** — no renderer creates matching DOM
- Obsidian's `MarkdownRenderer.renderMarkdown()` is NOT used in stat blocks

### Impact

- Spell descriptions with tables (Wild Magic Surge, many others) display as unformatted text
- Item descriptions with structured data lose all formatting
- Monster feature entries with tables (e.g., random encounter tables) are unreadable

### Fix approach

Use Obsidian's `MarkdownRenderer.renderMarkdown()` for description/entries text, or implement pipe table parsing in `renderTextWithInlineTags()`.

---

## Inline Tags

### Currently working

| Tag Syntax | Type | Rollable | Display |
|------------|------|----------|---------|
| `` `dice:2d6+3` `` | dice | YES | `2d6+3` (click to roll) |
| `` `roll:2d6+3` `` | dice (alias) | YES | `2d6+3` |
| `` `d:2d6` `` | dice (alias) | YES | `2d6` |
| `` `damage:3d8 fire` `` | damage | YES | `3d8 fire` |
| `` `atk:+7` `` | atk | YES | `+7 to hit` |
| `` `dc:15` `` | dc | NO | `DC 15` (styled) |
| `` `mod:+5` `` | mod | YES | `+5` |
| `` `check:Perception` `` | check | NO | `Perception` |
| `` `atk:DEX` `` | formula (monster only) | YES | Resolves to actual DEX attack bonus |

### Missing / Broken

| Issue | Priority | Details |
|-------|----------|---------|
| **Recharge not interactive** | HIGH | `(Recharge 5-6)` in feature names is plain text. No styling, no roll-to-recharge. `{@recharge 5}` converts to literal string, not a tag |
| **Bare dice not auto-detected** | HIGH | `2d6+3` in plain text is NOT rollable. Must be wrapped as `` `dice:2d6+3` ``. **Fix: auto-convert bare dice patterns to `` `dice:...` `` during rendering** |
| **Spell/creature cross-refs not linked** | MEDIUM | `{@spell fireball}` becomes italic text, not a clickable link. **Fix: convert to `{{spell:fireball}}` (compendium widget ref)** |
| **No `condition:` tag** | LOW | Conditions like Frightened, Stunned have no special styling or tooltip |
| **No `save:` tag** | LOW | No saving throw annotation tag |
| **`hit:` prefix not recognized** | LOW | Not in valid prefixes — renders as raw `<code>` |

---

## 5etools Tag Conversion Gaps

`convert5eToolsTags()` in `src/renderers/renderer-utils.ts` handles these conversions:

### Working conversions

| 5etools | Converts to |
|---------|-------------|
| `{@hit N}` | `` `atk:+N` `` (rollable) |
| `{@damage XdY+Z}` | `` `damage:XdY+Z` `` (rollable) |
| `{@dice XdY+Z}` | `` `roll:XdY+Z` `` (rollable) |
| `{@d20 +N}` | `` `roll:d20+N` `` (rollable) |
| `{@dc N}` | `` `dc:N` `` (styled) |
| `{@bold text}` | `**text**` |
| `{@italic text}` | `_text_` |

### Conversions that should be improved

| 5etools | Current | Should be |
|---------|---------|-----------|
| `{@recharge N}` | `(Recharge N-6)` plain text | Styled + rollable tag (roll 1d6, recharge on N-6) |
| `{@spell fireball}` | `_fireball_` italic text | `{{spell:fireball}}` compendium ref link |
| `{@creature goblin}` | `goblin` plain text | `{{monster:goblin}}` compendium ref link |
| `{@item longsword}` | `longsword` plain text | `{{item:longsword}}` compendium ref link |
| `{@condition frightened}` | `frightened` plain text | Styled condition tag with tooltip |
| `{@chance N}` | `N% chance` plain text | Could be rollable (roll d100) |

### Bare dice auto-detection (NEW — not currently implemented)

Plain dice expressions in description text should be auto-converted during rendering:

| Pattern | Should become |
|---------|---------------|
| `2d6+3` | `` `dice:2d6+3` `` |
| `1d20+5` | `` `dice:1d20+5` `` |
| `4d8` | `` `dice:4d8` `` |
| `1d6 + 2` | `` `dice:1d6+2` `` |

Regex pattern: `/\b(\d+d\d+(?:\s*[+-]\s*\d+)?)\b/g` — match digit(s) + "d" + digit(s) + optional modifier, at word boundaries. Must avoid matching inside existing backtick tags.
