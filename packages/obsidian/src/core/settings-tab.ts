import { App, PluginSettingTab, Setting, type ToggleComponent } from "obsidian";
import type { EntityRegistry } from "@archivist-gg/core";
import type ArchivistPlugin from "../main";
import { hiddenCompendiumSet, isCompendiumVisible, withCompendiumVisibility } from "../shared/entities/compendium-visibility";

/**
 * Per-compendium entity counts in ONE pass over the registry (spec §8 item 2).
 *
 * This replaces a `registry.search("", undefined, 99999)` sweep run once PER
 * COMPENDIUM: each sweep materialised and sorted every registered entity, so the
 * settings tab cost O(compendiums · n log n) just to print a number. Walking
 * `getAllSlugs()` through `getBySlug()` visits the same `bySlug` set exactly once
 * — the untyped `search("")` pool IS that set — so the counts are provably the
 * ones the sweep produced.
 *
 * A registry only knows entities, so a compendium with NO entities is simply
 * absent from the returned map. That omission is why the call site reads
 * `counts.get(comp.name) ?? 0` and still prints "0 entities" for an empty
 * compendium.
 *
 * `null` is accepted as well as `undefined`: `ArchivistPlugin.entityRegistry` is
 * declared `EntityRegistry | null` and is null until the vault has loaded.
 */
export function compendiumEntityCounts(
  registry: EntityRegistry | null | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!registry) return counts;
  for (const slug of registry.getAllSlugs()) {
    const entity = registry.getBySlug(slug);
    if (!entity) continue;
    counts.set(entity.compendium, (counts.get(entity.compendium) ?? 0) + 1);
  }
  return counts;
}

/**
 * Always-visible caption beside a settings toggle (R3-P7 F5): wraps the
 * toggle in a flex group with a small muted label so the per-compendium
 * toggles are distinguishable without hovering. Hover tooltips are kept.
 */
function attachToggleCaption(toggle: ToggleComponent, caption: string): void {
  const host = toggle.toggleEl.parentElement;
  if (!host) return;
  const wrap = host.createDiv({ cls: "archivist-labeled-toggle" });
  wrap.createSpan({ cls: "archivist-toggle-caption", text: caption });
  wrap.appendChild(toggle.toggleEl);
}

/**
 * Settings tab for D&D Content configuration.
 */
export class ArchivistSettingTab extends PluginSettingTab {
  plugin: ArchivistPlugin;

  constructor(app: App, plugin: ArchivistPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Entity compendium").setHeading();

    new Setting(containerEl)
      .setName("Compendium root folder")
      .setDesc("Root vault folder where entity notes are stored.")
      .addText((text) =>
        text.setPlaceholder("Compendium").setValue(this.plugin.settings.compendiumRoot)
          .onChange(async (value) => {
            this.plugin.settings.compendiumRoot = value || "Compendium";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Player characters folder")
      .setDesc("Vault-relative folder where character `.md` files live. Opening files with `archivist-type: pc` frontmatter in this folder renders them as the full-screen character sheet.")
      .addText((text) =>
        text
          .setPlaceholder("Player characters")
          .setValue(this.plugin.settings.playerCharactersFolder)
          .onChange(async (value) => {
            this.plugin.settings.playerCharactersFolder = value || "PlayerCharacters";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Portraits folder")
      .setDesc("Vault folder the character portrait picker shows and imports into. Empty uses <player characters folder>/Portraits.")
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- folder path example, not prose
          .setPlaceholder("PlayerCharacters/Portraits")
          .setValue(this.plugin.settings.portraitsFolder)
          .onChange(async (value) => {
            this.plugin.settings.portraitsFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).setName("Compendiums").setHeading();
    containerEl.createEl("p", {
      text: 'Compendiums are folders of game entities (monsters, spells, items) stored in your vault. Read-only compendiums cannot be edited; "save as new" will create a copy in a writable compendium. Toggle read-only here or by editing the _compendium.md file inside each compendium folder. Each compendium row has two toggles. The first controls whether its content appears in character-sheet and builder pickers and in the {{...}} suggestion list (on = visible). The second makes the compendium read-only.',
      cls: "setting-item-description",
    });

    const compManager = this.plugin.compendiumManager;
    if (compManager) {
      const allCompendiums = compManager.getAll();
      const registry = this.plugin.entityRegistry;

      const hidden = hiddenCompendiumSet(this.plugin.settings);
      // ONE registry pass for the whole loop (spec §8 item 2). A compendium with
      // no entities is not in the map at all, hence the `?? 0`.
      const counts = compendiumEntityCounts(registry);
      for (const comp of allCompendiums) {
        const entityCount = counts.get(comp.name) ?? 0;

        const desc = `${comp.description || ""} \u00b7 ${entityCount} entities${comp.homebrew ? " \u00b7 homebrew" : ""}`;

        new Setting(containerEl)
          .setName(comp.name)
          .setDesc(desc)
          .addToggle((toggle) => {
            attachToggleCaption(toggle, "Visible");
            toggle
              .setTooltip("Visible in pickers")
              .setValue(isCompendiumVisible(comp.name, hidden))
              .onChange(async (value: boolean) => {
                // REASSIGN a fresh array (never mutate: the loaded value may
                // alias DEFAULT_SETTINGS' own array).
                this.plugin.settings.hiddenCompendiums =
                  withCompendiumVisibility(this.plugin.settings.hiddenCompendiums, comp.name, value);
                await this.plugin.saveSettings();
                // Durability: mirror the flag into _compendium.md via the
                // lossless merge writer (settings stay the runtime cache all
                // filter sites read). A file failure must not break the toggle.
                try {
                  await compManager.setHidden(comp.name, !value);
                } catch (err) {
                  console.error(
                    `Archivist: failed to write hidden flag for compendium "${comp.name}"`,
                    err,
                  );
                }
              });
          })
          .addToggle((toggle) => {
            attachToggleCaption(toggle, "Read-only");
            toggle
              .setTooltip("Read-only")
              .setValue(comp.readonly)
              .onChange(async (value: boolean) => {
                await compManager.setReadonly(comp.name, value);
              });
          });
      }

      // Hidden names not currently discovered in the vault (renamed/deleted
      // compendiums, or the shipped default in a vault without that folder):
      // still rendered so the hide is clearable from the UI.
      const discovered = new Set(allCompendiums.map((c) => c.name));
      for (const name of this.plugin.settings.hiddenCompendiums) {
        if (discovered.has(name)) continue;
        new Setting(containerEl)
          .setName(name)
          .setDesc("Not currently in the vault. Hidden by settings.")
          .addToggle((toggle) => {
            attachToggleCaption(toggle, "Visible");
            toggle
              .setTooltip("Visible in pickers")
              .setValue(false)
              .onChange(async (value: boolean) => {
                this.plugin.settings.hiddenCompendiums =
                  withCompendiumVisibility(this.plugin.settings.hiddenCompendiums, name, value);
                await this.plugin.saveSettings();
              });
          });
      }
    }
  }
}
