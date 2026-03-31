# Replace Custom Dice System with Javalent Dice Roller

**Date:** 2026-03-31
**Status:** Approved

## Summary

Remove the entire custom dice system (`src/dice/`, `@3d-dice/dice-box`, overlay CSS, WASM assets) and replace click handlers with calls to `window.DiceRoller` API from the Javalent Dice Roller Obsidian community plugin.

## Remove

- `src/dice/SimpleDiceBox.ts`
- `src/dice/DiceOverlay.ts`
- `src/dice/diceRoller.ts`
- `src/dice/diceStats.ts`
- `src/dice/dice-box.d.ts`
- `src/dice/index.ts`
- `@3d-dice/dice-box` npm dependency
- `assets/dice-box/` directory
- Dice overlay CSS in `archivist-dnd.css`
- DiceOverlay creation + event listener + 3D init in `main.ts`
- Asset copy step in `esbuild.config.mjs`

## Keep

- `renderStatBlockTag()` in `renderer-utils.ts` (icons, dashed underlines, CSS classes)
- `renderInlineTag()` in `inline-tag-renderer.ts` (subtle inline style, colors)
- All annotation CSS (`.archivist-stat-tag-*`, `.archivist-tag-*`)

## Change

**Click handlers** in both renderers: replace `CustomEvent` dispatch with:
```typescript
const api = (window as any).DiceRoller;
if (api) {
  await api.parseDice(notation);
} else {
  new Notice('Install the "Dice Roller" plugin from Community Plugins to roll dice.');
}
```

**Tooltips**: replace `formatDiceTooltip()` with static `"notation -- Click to roll"` text.

**`main.ts`**: remove all dice-related code (import, overlay creation, event listener, 3D init).

**`esbuild.config.mjs`**: remove `cpSync` asset copy step.

**`package.json`**: remove `@3d-dice/dice-box` dependency.

**`.gitignore`**: remove `assets/dice-box/` entry.
