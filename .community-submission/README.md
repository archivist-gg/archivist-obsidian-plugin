# Obsidian Community Plugin Submission

Staged material for submitting Archivist to the [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) directory.

## Submission Steps

1. Fork `https://github.com/obsidianmd/obsidian-releases`.
2. Clone your fork and add the entry below to `community-plugins.json` (append as the last element, preserving alphabetical-ish order is fine — reviewers don't enforce it strictly).
3. Commit on a new branch, push, and open a PR titled:
   ```
   Add plugin: Archivist
   ```
4. The PR body should fill out the template the repo prompts for — link the plugin repo, confirm the required files, and tick the review-checklist boxes.

## community-plugins.json entry

```json
{
  "id": "archivist-gg",
  "name": "Archivist",
  "author": "Shinoobi",
  "description": "D&D 5e toolkit: AI agent for monsters, spells, items, and NPCs; parchment stat blocks; inline dice tags; full SRD compendium.",
  "repo": "archivist-gg/archivist-obsidian-plugin"
}
```

## Pre-submission checklist

Confirm before opening the PR:

- [ ] `manifest.json` `id` matches `archivist-gg` and is NOT used in `community-plugins.json` by any other plugin.
- [ ] `manifest.json` `version` matches the GitHub release tag exactly (no `v` prefix; e.g. tag `0.2.0` matches version `0.2.0`).
- [ ] Latest GitHub Release attaches `main.js`, `manifest.json`, and `styles.css` as top-level binary assets (not bundled in a zip).
- [ ] `versions.json` contains an entry for every published version mapping it to the minimum Obsidian app version.
- [ ] `README.md` has description, screenshots, and install instructions.
- [ ] `LICENSE` file is present.
- [ ] Plugin loads cleanly in a fresh vault without console errors.
- [ ] No `innerHTML` / `outerHTML` / `insertAdjacentHTML` usage (reviewers grep for these).
- [ ] Settings names use sentence case.
- [ ] Settings use `new Setting(containerEl).setHeading()` instead of `<h2>` / `<h3>`.
- [ ] No hardcoded inline styles in TypeScript — styles live in `styles.css`.

## Note on name collision

A plugin called `archivist-importer` ("Archivist Importer" by Archivist AI) is already in the marketplace. It imports vault files into an unrelated "Archivist" web app. Reviewers may ask about potential user confusion. If pushed on this, be ready to:

- Emphasize the different scope ("Archivist" = full D&D toolkit with stat blocks, dice, and chat; "Archivist Importer" = exporter for a different service).
- Offer an alternative display name if needed (e.g. "Archivist Codex").

The id `archivist-gg` is distinct and safe.
