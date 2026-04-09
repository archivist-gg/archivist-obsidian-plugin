# Monster Edit Panel Design Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the speed toggle, damage/condition fields, and legendary counts in the monster edit panel (+ add legendary tracking boxes to read mode) to harmonize with PHB layout conventions and the parchment theme.

**Architecture:** Three independent UI changes, all in the edit/render layer. Speed becomes inline pick-and-add on the property line. Damage/condition fields get collapsible wrappers around the existing SearchableTagSelect. Legendary edit switches to number spinners; legendary read gets inline tracking boxes. No type or parser changes needed.

**Tech Stack:** TypeScript, Obsidian API (DOM manipulation), CSS custom properties from archivist-dnd.css/archivist-edit.css.

---

### Task 1: Replace speed toggle CSS with pick-and-add CSS

**Files:**
- Modify: `src/styles/archivist-edit.css:1372-1416`

- [ ] **Step 1: Replace the Speed Mode Toggle CSS block**

In `src/styles/archivist-edit.css`, find the block from line 1372 to line 1416 (the `Speed Mode Toggle` section). Replace it entirely with:

```css
/* ==========================================================================
   Speed Pick & Add
   ========================================================================== */

.archivist-speed-remove {
  font-size: 10px;
  color: var(--d5e-bar-fill);
  cursor: pointer;
  vertical-align: super;
  margin-left: 1px;
  margin-right: 2px;
  opacity: 0.5;
  font-weight: bold;
}

.archivist-speed-remove:hover {
  opacity: 1;
}

.archivist-speed-add-btn {
  font-size: 10px;
  color: var(--d5e-bar-fill);
  background: none;
  border: 1px solid var(--d5e-border-tan);
  border-radius: 3px;
  padding: 1px 6px;
  cursor: pointer;
  font-family: inherit;
  vertical-align: middle;
}

.archivist-speed-add-btn:hover {
  border-color: var(--d5e-bar-fill);
}

.archivist-speed-dropdown-anchor {
  position: relative;
  display: inline-block;
}

.archivist-speed-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
  border: 1px solid var(--d5e-border-tan);
  background: var(--d5e-parchment-light, #fef8ee);
  border-radius: 0 0 3px 3px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  min-width: 120px;
}

.archivist-speed-dropdown-item {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--d5e-text-dark);
  cursor: pointer;
}

.archivist-speed-dropdown-item:hover {
  background: var(--d5e-parchment-dark, #f4e4c1);
}

.archivist-speed-dropdown-item-taken {
  color: #999;
  text-decoration: line-through;
  cursor: default;
}

.archivist-speed-dropdown-item-taken:hover {
  background: transparent;
}
```

- [ ] **Step 2: Build to verify CSS compiles**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/styles/archivist-edit.css
git commit -m "feat: replace speed toggle CSS with pick-and-add dropdown styles"
```

---

### Task 2: Rewrite speed section in monster-edit-render.ts

**Files:**
- Modify: `src/edit/monster-edit-render.ts:312-362`

- [ ] **Step 1: Replace the speed section**

In `src/edit/monster-edit-render.ts`, find the speed section from line 312 (`// -- Speed --`) through line 362 (`extraRow.createEl("span", { cls: "archivist-speed-ft", text: "ft." });`). Replace that entire block with:

```ts
  // -- Speed --
  const speedLine = coreProps.createDiv({ cls: "property-line last" });
  speedLine.createEl("h4", { text: "Speed" });
  speedLine.appendText(" ");

  const walkWrap = speedLine.createDiv({ cls: "archivist-num-wrap" });
  const walkInput = walkWrap.createEl("input", { cls: "archivist-num-in" });
  walkInput.type = "number";
  walkInput.value = String(m.speed?.walk ?? 30);
  walkInput.addEventListener("input", () => {
    const speed = { ...state.current.speed, walk: parseInt(walkInput.value) || 0 };
    state.updateField("speed", speed);
  });
  createSpinButtons(walkWrap, walkInput);
  speedLine.appendText(" ft.");

  // Extra speed modes — inline pick-and-add
  const extraModeKeys: Array<"fly" | "swim" | "climb" | "burrow"> = ["fly", "swim", "climb", "burrow"];
  const activeSpeedModes: Set<string> = new Set();

  function addSpeedMode(key: "fly" | "swim" | "climb" | "burrow"): void {
    if (activeSpeedModes.has(key)) return;
    activeSpeedModes.add(key);

    // Insert comma before this mode
    const comma = document.createTextNode(", ");
    speedLine.insertBefore(comma, addAnchor);

    const modeSpan = document.createElement("span");
    modeSpan.dataset.speedMode = key;
    speedLine.insertBefore(modeSpan, addAnchor);

    const label = document.createTextNode(`${key} `);
    modeSpan.appendChild(label);

    const numWrap = modeSpan.createDiv({ cls: "archivist-num-wrap" });
    const numInput = numWrap.createEl("input", { cls: "archivist-num-in" });
    numInput.type = "number";
    numInput.value = String(m.speed?.[key] ?? 0);
    numInput.addEventListener("input", () => {
      const speed = { ...state.current.speed, [key]: parseInt(numInput.value) || 0 };
      state.updateField("speed", speed);
    });
    createSpinButtons(numWrap, numInput);

    const ftText = document.createTextNode(" ft.");
    modeSpan.appendChild(ftText);

    const removeBtn = modeSpan.createEl("span", { cls: "archivist-speed-remove", text: "\u00d7" });
    removeBtn.addEventListener("click", () => {
      activeSpeedModes.delete(key);
      // Remove the preceding comma
      const prev = modeSpan.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE && prev.textContent?.includes(",")) {
        prev.remove();
      }
      modeSpan.remove();
      state.updateField("speed", { ...state.current.speed, [key]: 0 });
      updateAddButton();
    });

    updateAddButton();
  }

  // The "+ more" anchor (dropdown container)
  const addAnchor = speedLine.createEl("span", { cls: "archivist-speed-dropdown-anchor" });
  const addBtn = addAnchor.createEl("button", { cls: "archivist-speed-add-btn", text: "+ more" });
  addBtn.style.marginLeft = "6px";
  let dropdownEl: HTMLElement | null = null;

  function updateAddButton(): void {
    const allAdded = extraModeKeys.every(k => activeSpeedModes.has(k));
    addAnchor.style.display = allAdded ? "none" : "";
  }

  function showSpeedDropdown(): void {
    hideSpeedDropdown();
    dropdownEl = addAnchor.createDiv({ cls: "archivist-speed-dropdown" });
    for (const key of extraModeKeys) {
      const taken = activeSpeedModes.has(key);
      const item = dropdownEl.createDiv({
        cls: taken
          ? "archivist-speed-dropdown-item archivist-speed-dropdown-item-taken"
          : "archivist-speed-dropdown-item",
        text: taken ? `${key.charAt(0).toUpperCase() + key.slice(1)} (added)` : key.charAt(0).toUpperCase() + key.slice(1),
      });
      if (!taken) {
        item.addEventListener("click", () => {
          addSpeedMode(key);
          hideSpeedDropdown();
        });
      }
    }
  }

  function hideSpeedDropdown(): void {
    if (dropdownEl) { dropdownEl.remove(); dropdownEl = null; }
  }

  addBtn.addEventListener("click", () => {
    if (dropdownEl) { hideSpeedDropdown(); } else { showSpeedDropdown(); }
  });

  // Close dropdown on outside click
  speedLine.addEventListener("click", (e) => {
    if (dropdownEl && !addAnchor.contains(e.target as Node)) {
      hideSpeedDropdown();
    }
  });

  // Pre-populate existing non-zero speeds
  for (const key of extraModeKeys) {
    if ((m.speed?.[key] ?? 0) > 0) {
      addSpeedMode(key);
    }
  }
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/edit/monster-edit-render.ts
git commit -m "feat: rewrite speed section as inline pick-and-add with dropdown"
```

---

### Task 3: Add collapsible section CSS

**Files:**
- Modify: `src/styles/archivist-edit.css` (append after SearchableTagSelect block, before Speed block)

- [ ] **Step 1: Add collapsible section CSS**

In `src/styles/archivist-edit.css`, insert the following block before the `Speed Pick & Add` section (which was written in Task 1). Find the end of the `.archivist-tag-dropdown-custom:hover` rule and add after it:

```css
/* ==========================================================================
   Collapsible Field Sections
   ========================================================================== */

.archivist-collapse-header {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 3px 0;
  user-select: none;
}

.archivist-collapse-header:hover .archivist-collapse-arrow {
  color: var(--d5e-bar-fill);
}

.archivist-collapse-arrow {
  font-size: 10px;
  color: var(--d5e-border-tan-dark);
  width: 12px;
  text-align: center;
  transition: transform 0.15s;
  display: inline-block;
}

.archivist-collapse-arrow-open {
  transform: rotate(90deg);
}

.archivist-collapse-title {
  font-size: 14px;
  font-weight: bold;
  color: var(--d5e-text-accent);
}

.archivist-collapse-count {
  font-size: 11px;
  color: #766649;
  font-weight: normal;
}

.archivist-collapse-body {
  margin-left: 18px;
  padding: 4px 0 2px;
}

.archivist-collapse-body-hidden {
  display: none;
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/styles/archivist-edit.css
git commit -m "feat: add collapsible field section CSS"
```

---

### Task 4: Wrap damage/condition fields in collapsible sections

**Files:**
- Modify: `src/edit/monster-edit-render.ts:631-675`

- [ ] **Step 1: Replace the damage/condition block**

In `src/edit/monster-edit-render.ts`, find the block from line 631 (`// =========================================================================`) through line 675 (the last `createSearchableTagSelect` call for condition immunities, ending with `});`). Replace that entire block with:

```ts
  // =========================================================================
  // 11b. Damage & Condition Immunities (Collapsible)
  // =========================================================================

  const damagePresets = [...DAMAGE_TYPES, ...DAMAGE_NONMAGICAL_VARIANTS];

  interface CollapseField {
    title: string;
    presets: string[];
    selected: string[];
    field: string;
    placeholder: string;
  }

  const collapseFields: CollapseField[] = [
    { title: "Damage Vulnerabilities", presets: damagePresets, selected: [...(m.damage_vulnerabilities ?? [])], field: "damage_vulnerabilities", placeholder: "Search damage types..." },
    { title: "Damage Resistances", presets: damagePresets, selected: [...(m.damage_resistances ?? [])], field: "damage_resistances", placeholder: "Search damage types..." },
    { title: "Damage Immunities", presets: damagePresets, selected: [...(m.damage_immunities ?? [])], field: "damage_immunities", placeholder: "Search damage types..." },
    { title: "Condition Immunities", presets: CONDITIONS, selected: [...(m.condition_immunities ?? [])], field: "condition_immunities", placeholder: "Search conditions..." },
  ];

  for (const cf of collapseFields) {
    const wrapper = sensesSection.createDiv();
    const header = wrapper.createDiv({ cls: "archivist-collapse-header" });
    const arrow = header.createEl("span", { cls: "archivist-collapse-arrow", text: "\u25B6" });
    header.createEl("span", { cls: "archivist-collapse-title", text: cf.title });
    const countEl = header.createEl("span", { cls: "archivist-collapse-count", text: `(${cf.selected.length})` });

    const body = wrapper.createDiv({ cls: "archivist-collapse-body" });
    // Expand if has values, collapse if empty
    if (cf.selected.length === 0) {
      body.addClass("archivist-collapse-body-hidden");
    } else {
      arrow.addClass("archivist-collapse-arrow-open");
    }

    header.addEventListener("click", () => {
      body.classList.toggle("archivist-collapse-body-hidden");
      arrow.classList.toggle("archivist-collapse-arrow-open");
    });

    createSearchableTagSelect({
      container: body,
      presets: cf.presets,
      selected: cf.selected,
      onChange: (values) => {
        state.updateField(cf.field, values);
        countEl.textContent = `(${values.length})`;
      },
      placeholder: cf.placeholder,
    });
  }

  // Last property before SVG bar
  const condImmWrapper = sensesSection.lastElementChild;
  if (condImmWrapper) condImmWrapper.addClass("last");
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/edit/monster-edit-render.ts
git commit -m "feat: wrap damage/condition fields in collapsible sections"
```

---

### Task 5: Replace legendary checkboxes CSS with number spinner layout

**Files:**
- Modify: `src/styles/archivist-edit.css:1418-1491`

- [ ] **Step 1: Replace the Legendary Checkboxes CSS block**

In `src/styles/archivist-edit.css`, find the `Legendary Checkboxes` section (from line 1418 to end of file). Replace it entirely with:

```css
/* ==========================================================================
   Legendary Counts (Edit Mode)
   ========================================================================== */

.archivist-legendary-counts {
  display: flex;
  gap: 16px;
  padding: 4px 0 8px;
  flex-wrap: wrap;
  align-items: center;
}

.archivist-legendary-count-field {
  display: flex;
  align-items: center;
  gap: 4px;
}

.archivist-legendary-count-label {
  font-size: 12px;
  font-weight: bold;
  color: var(--d5e-bar-fill);
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/styles/archivist-edit.css
git commit -m "feat: replace legendary checkbox CSS with number spinner layout"
```

---

### Task 6: Rewrite legendary edit to use number spinners

**Files:**
- Modify: `src/edit/monster-edit-render.ts:936-1009` (the `renderLegendaryCheckboxes` and `renderCheckboxRow` functions)

- [ ] **Step 1: Replace both functions**

In `src/edit/monster-edit-render.ts`, find `renderLegendaryCheckboxes` (line 936) through the end of `renderCheckboxRow` (line 1009, ending with the closing `}`). Replace both functions with a single function:

```ts
function renderLegendaryCheckboxes(container: HTMLElement, state: MonsterEditState): void {
  const section = container.createDiv({ cls: "archivist-legendary-counts" });

  // Legendary Actions count
  const actionsField = section.createDiv({ cls: "archivist-legendary-count-field" });
  actionsField.createEl("span", { cls: "archivist-legendary-count-label", text: "Actions:" });
  const actionsWrap = actionsField.createDiv({ cls: "archivist-num-wrap" });
  const actionsInput = actionsWrap.createEl("input", { cls: "archivist-num-in" });
  actionsInput.type = "number";
  actionsInput.style.width = "36px";
  actionsInput.value = String(state.current.legendary_actions ?? 3);
  actionsInput.addEventListener("input", () => {
    state.updateField("legendary_actions", parseInt(actionsInput.value) || 0);
  });
  createSpinButtons(actionsWrap, actionsInput);

  // Legendary Resistance count
  const resistField = section.createDiv({ cls: "archivist-legendary-count-field" });
  resistField.createEl("span", { cls: "archivist-legendary-count-label", text: "Resistance:" });
  const resistWrap = resistField.createDiv({ cls: "archivist-num-wrap" });
  const resistInput = resistWrap.createEl("input", { cls: "archivist-num-in" });
  resistInput.type = "number";
  resistInput.style.width = "36px";
  resistInput.value = String(state.current.legendary_resistance ?? 0);
  resistInput.addEventListener("input", () => {
    state.updateField("legendary_resistance", parseInt(resistInput.value) || 0);
  });
  createSpinButtons(resistWrap, resistInput);

  createSvgBar(container);
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/edit/monster-edit-render.ts
git commit -m "feat: replace legendary checkbox rows with number spinners"
```

---

### Task 7: Add legendary action tracking boxes to read mode

**Files:**
- Modify: `src/renderers/monster-renderer.ts:58-84,295-375`
- Modify: `src/styles/archivist-dnd.css` (append)

- [ ] **Step 1: Add CSS for inline legendary action boxes**

Append to `src/styles/archivist-dnd.css`:

```css
/* ==========================================================================
   Legendary Action Tracking Boxes (Read Mode)
   ========================================================================== */

.archivist-legendary-action-boxes {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.archivist-legendary-action-box {
  width: 16px;
  height: 16px;
  border: 2px solid #d9c484;
  border-radius: 2px;
  background: #fdf1dc;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s;
}

.archivist-legendary-action-box-checked {
  border-color: #922610;
}

.archivist-legendary-action-box svg {
  width: 8px;
  height: 8px;
}

.archivist-legendary-action-box svg line {
  stroke: #922610;
  stroke-width: 2.5;
  stroke-linecap: round;
}

.theme-dark .archivist-legendary-action-box {
  background: #2b2b2b;
  border-color: #5a4f3a;
}

.theme-dark .archivist-legendary-action-box-checked {
  border-color: #c4683a;
}

.theme-dark .archivist-legendary-action-box svg line {
  stroke: #c4683a;
}
```

- [ ] **Step 2: Add a `renderInlineTrackingBoxes` helper function**

In `src/renderers/monster-renderer.ts`, add this function after the existing `renderLegendaryResistance` function (after line 85):

```ts
function renderInlineTrackingBoxes(parent: HTMLElement, count: number): void {
  const container = el("span", { cls: "archivist-legendary-action-boxes", parent });
  for (let i = 0; i < count; i++) {
    const box = el("span", { cls: "archivist-legendary-action-box", parent: container });
    box.addEventListener("click", () => {
      const isChecked = box.hasClass("archivist-legendary-action-box-checked");
      if (isChecked) {
        box.removeClass("archivist-legendary-action-box-checked");
        box.empty();
      } else {
        box.addClass("archivist-legendary-action-box-checked");
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 12 12");
        const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l1.setAttribute("x1", "2"); l1.setAttribute("y1", "2");
        l1.setAttribute("x2", "10"); l1.setAttribute("y2", "10");
        const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l2.setAttribute("x1", "10"); l2.setAttribute("y1", "2");
        l2.setAttribute("x2", "2"); l2.setAttribute("y2", "10");
        svg.appendChild(l1);
        svg.appendChild(l2);
        box.appendChild(svg);
      }
    });
  }
}
```

- [ ] **Step 3: Wire tracking boxes into the two-column legendary section**

In `src/renderers/monster-renderer.ts`, find the two-column legendary block (around line 301-312). The current code is:

```ts
      if (section.id === "legendary") {
        const legendaryCount = monster.legendary_actions ?? 3;
        const introText = `The ${monster.name.toLowerCase()} can take ${legendaryCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monster.name.toLowerCase()} regains spent legendary actions at the start of its turn.`;
        el("p", {
          cls: "archivist-legendary-intro",
          text: introText,
          parent: sectionDiv,
        });

        if (monster.legendary_resistance && monster.legendary_resistance > 0) {
          renderLegendaryResistance(sectionDiv, monster.legendary_resistance);
        }
      }
```

Replace with:

```ts
      if (section.id === "legendary") {
        const legendaryCount = monster.legendary_actions ?? 3;
        const introText = `The ${monster.name.toLowerCase()} can take ${legendaryCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monster.name.toLowerCase()} regains spent legendary actions at the start of its turn.`;
        const introP = el("p", {
          cls: "archivist-legendary-intro",
          text: introText,
          parent: sectionDiv,
        });
        renderInlineTrackingBoxes(introP, legendaryCount);

        if (monster.legendary_resistance && monster.legendary_resistance > 0) {
          renderLegendaryResistance(sectionDiv, monster.legendary_resistance);
        }
      }
```

- [ ] **Step 4: Wire tracking boxes into the single-column (tabbed) legendary section**

In `src/renderers/monster-renderer.ts`, find the single-column legendary block (around line 364-375). The current code is:

```ts
      if (tab.id === "legendary") {
        const legendaryCount = monster.legendary_actions ?? 3;
        const introText = `The ${monster.name.toLowerCase()} can take ${legendaryCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monster.name.toLowerCase()} regains spent legendary actions at the start of its turn.`;
        el("p", {
          cls: "archivist-legendary-intro",
          text: introText,
          parent: content,
        });

        if (monster.legendary_resistance && monster.legendary_resistance > 0) {
          renderLegendaryResistance(content, monster.legendary_resistance);
        }
      }
```

Replace with:

```ts
      if (tab.id === "legendary") {
        const legendaryCount = monster.legendary_actions ?? 3;
        const introText = `The ${monster.name.toLowerCase()} can take ${legendaryCount} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${monster.name.toLowerCase()} regains spent legendary actions at the start of its turn.`;
        const introP = el("p", {
          cls: "archivist-legendary-intro",
          text: introText,
          parent: content,
        });
        renderInlineTrackingBoxes(introP, legendaryCount);

        if (monster.legendary_resistance && monster.legendary_resistance > 0) {
          renderLegendaryResistance(content, monster.legendary_resistance);
        }
      }
```

- [ ] **Step 5: Build to verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/renderers/monster-renderer.ts src/styles/archivist-dnd.css
git commit -m "feat: add legendary action tracking boxes to read mode"
```

---

### Task 8: Build, deploy, and manual verification

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (existing tests unaffected — no logic changes to tested modules).

- [ ] **Step 2: Build and deploy**

Run: `npm run build && /bin/cp main.js styles.css manifest.json /Users/shinoobi/Documents/V/.obsidian/plugins/archivist/`

- [ ] **Step 3: Manual verification checklist**

In Obsidian, test with monsters that have various speed/damage/legendary configurations:

1. **Speed pick-and-add**: Open edit on a basic monster (e.g., Goblin — walk only). Verify only walk speed + `+ more` button. Click `+ more`, verify dropdown shows Fly/Swim/Climb/Burrow. Pick Fly — verify it appears inline as `30 ft., fly [0] ft.×`. Set value to 60. Click `+ more` again — verify Fly is struck-through. Add Swim. Verify comma separation. Remove Fly via ×. Verify it disappears cleanly. Open a dragon (has fly) — verify fly pre-populated inline.

2. **Damage/condition collapsibles**: Open edit on a Lich. Verify Damage Resistances shows collapsed with `(1)`. Verify Condition Immunities shows expanded with `(6)`. Expand Damage Resistances — verify tag-select appears with BPS nonmagical pill. Add "Fire" — verify count updates to `(2)`. Collapse and re-expand — verify values persist. Test a monster with no immunities — verify all sections collapsed with `(0)`.

3. **Legendary edit spinners**: Open Legendary tab on a Lich. Verify "Actions: [3]" and "Resistance: [3]" number spinners. Increment/decrement via spin buttons. Verify changes persist in YAML on save.

4. **Legendary read-mode boxes**: View (non-edit) a Lich. Verify small inline boxes after the legendary intro text. Click a box — verify × cross appears. Click again — verify it toggles off. Verify legendary resistance boxes still work (existing functionality).

5. **Round-trip**: Edit a complex monster, modify all new fields, save, re-enter edit — verify everything preserved.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification feedback for design fixes"
```
