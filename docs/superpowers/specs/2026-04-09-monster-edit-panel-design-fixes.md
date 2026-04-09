# Monster Edit Panel — Design Fixes

> Redesign three areas of the monster edit panel to better harmonize with the parchment stat block aesthetic and PHB layout conventions.

## 1. Speed: Inline Pick-and-Add

**Replace** the current expandable toggle row (separate row with grid of all 4 modes) with an inline pick-and-add pattern on the property line itself.

### Behavior

- Walk speed always visible: `Speed. [30] ft.`
- A `+ more` button appears after the walk value
- Clicking `+ more` opens a dropdown listing: Fly, Swim, Climb, Burrow
- Already-added modes appear struck-through in the dropdown
- Selecting a mode adds it inline: `Speed. [30] ft., fly [80] ft., swim [40] ft.`
- Each added mode has a small superscript `×` to remove it
- Removing a mode sets its value to 0 and hides it from the line
- When all 4 extra modes are added, `+ more` button disappears
- When opening edit mode on a monster with existing non-zero speeds, those modes are pre-populated inline — no toggle interaction needed

### Layout

Speeds render inline on the property line in PHB order: walk, fly, swim, climb, burrow. Natural text wrapping when the line is long. Mode labels are lowercase (matching PHB style: `fly`, not `Fly`). Comma-separated with `ft.` after each value.

### CSS Changes

- Remove: `.archivist-speed-toggle`, `.archivist-speed-extra`, `.archivist-speed-mode`, `.archivist-speed-label`, `.archivist-speed-input`, `.archivist-speed-ft`
- Add: `.archivist-speed-remove` (superscript × button), `.archivist-speed-add-btn` (the `+ more` button), `.archivist-speed-dropdown` / `.archivist-speed-dropdown-item` (dropdown)

### Data Flow

Same as current — `state.updateField("speed", { ...speed, [key]: value })`. Removing a mode sets its value to 0 in the speed object (not undefined — parser expects numbers).

---

## 2. Damage/Condition Fields: Collapsible Sections

**Replace** the current stacked tag-select boxes (one per field, always visible) with collapsible sections. Each field gets a header row with arrow toggle and count badge; expanding reveals the tag-select inside.

### Behavior

- Four collapsible sections in order: Damage Vulnerabilities, Damage Resistances, Damage Immunities, Condition Immunities
- Header row: `▶ Damage Immunities (3)` — arrow, bold title (property-line h4 style), count in muted parens
- Clicking header toggles the body open/closed
- When expanded: shows the existing `SearchableTagSelect` component inside
- Default state on edit open: sections with at least one value are expanded, empty sections (count 0) are collapsed
- The `Damage Vulnerabilities` section is omitted entirely if there are no vulnerabilities AND no other damage sections have values — but since all four sections are always rendered in edit mode, all four always appear (even if collapsed with count 0)
- Count badge updates live as tags are added/removed

### Vertical Expansion

The `SearchableTagSelect` component (tag-select box) uses `display: flex; flex-wrap: wrap`. Tag pills wrap to new lines naturally. Long values like `"Bludgeoning, Piercing, and Slashing from Nonmagical Attacks"` render as a pill that spans the full width — `white-space: normal` on the pill allows it to wrap internally if needed.

### CSS Changes

- Add: `.archivist-collapse-header` (flex row, cursor pointer), `.archivist-collapse-arrow` (triangle, rotates 90deg when open), `.archivist-collapse-title` (bold accent color, inherits property-line h4 style), `.archivist-collapse-count` (muted text, parens), `.archivist-collapse-body` (indented content area)
- Keep: all existing `.archivist-tag-*` classes (SearchableTagSelect component unchanged)

### Data Flow

Unchanged — same `state.updateField("damage_vulnerabilities", values)` etc. The collapsible wrapper is purely visual.

---

## 3. Legendary Counts: Number Spinners (Edit) + Inline Boxes (Read)

### Edit Mode

**Replace** the current checkbox rows at top of Legendary tab with compact number spinners — the same `archivist-num-wrap` pattern used for AC, HP, and ability scores.

Layout: a single row with `Actions: [3]` and `Resistance: [3]` side by side, separated by a bar SVG below before the feature cards.

### Read Mode

**Add** clickable inline tracking boxes to the Legendary section in the rendered (non-edit) stat block:

1. **Legendary Resistance line**: After `"Legendary Resistance (3/Day)."` text, append small inline boxes (16×16px, `border: 2px solid var(--d5e-border-tan)`, `border-radius: 2px`). Clicking toggles an × cross mark (same CSS cross as existing `.archivist-ability-cross`). These are visual-only tracking aids — not persisted to YAML.

2. **Legendary Actions intro**: After the italic intro paragraph (`"The X can take N legendary actions..."`), append the same inline boxes for tracking action usage.

### Box Style

The inline boxes use smaller dimensions (16×16px) compared to the existing Legendary Resistance boxes (22×22px) to fit inline with text without disrupting line height. Cross marks use 8×8px SVG lines. Checked boxes get `border-color: var(--d5e-bar-fill)`.

### CSS Changes

- Remove: `.archivist-legendary-section`, `.archivist-legendary-row`, `.archivist-legendary-label`, `.archivist-legendary-checks`, `.archivist-legendary-check`, `.archivist-legendary-check-checked`, `.archivist-legendary-adjust` (all edit-mode checkbox styles)
- Add (to archivist-dnd.css, read-mode): `.archivist-legendary-action-boxes` (inline-flex container), `.archivist-legendary-action-box` (16×16 box matching existing resistance box style but smaller)

### Data Flow

- Edit mode: `state.updateField("legendary_actions", count)` and `state.updateField("legendary_resistance", count)` — same fields, just using number spinners instead of checkbox count
- Read mode: boxes are purely visual tracking (click to toggle), not persisted. Same pattern as existing `renderLegendaryResistance` function.

---

## Files Affected

| File | Changes |
|------|---------|
| `src/edit/monster-edit-render.ts` | Rewrite speed section, wrap damage/condition fields in collapsibles, replace legendary checkbox rows with number spinners |
| `src/renderers/monster-renderer.ts` | Add inline tracking boxes to legendary actions intro and legendary resistance line |
| `src/styles/archivist-edit.css` | Remove old speed/legendary CSS, add collapsible + speed dropdown CSS |
| `src/styles/archivist-dnd.css` | Add legendary action inline box styles |

## Visual Reference

Mockups in `.superpowers/brainstorm/36225-1775736893/content/`:
- `speed-layout-v2.html` — speed pick-and-add interaction flow
- `unified-layout.html` — all three designs in full stat block context
