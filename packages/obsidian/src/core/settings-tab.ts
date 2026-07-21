import { App, PluginSettingTab, Setting } from "obsidian";
import type ArchivistPlugin from "../main";

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
      text: 'Compendiums are folders of game entities (monsters, spells, items) stored in your vault. Read-only compendiums cannot be edited; "save as new" will create a copy in a writable compendium. Toggle read-only here or by editing the _compendium.md file inside each compendium folder.',
      cls: "setting-item-description",
    });

    const compManager = this.plugin.compendiumManager;
    if (compManager) {
      const allCompendiums = compManager.getAll();
      const registry = this.plugin.entityRegistry;

      for (const comp of allCompendiums) {
        // Count entities in this compendium
        let entityCount = 0;
        if (registry) {
          // Search with empty query returns all, then filter by compendium
          const allEntities = registry.search("", undefined, 99999);
          entityCount = allEntities.filter((e) => e.compendium === comp.name).length;
        }

        const desc = `${comp.description || ""} \u2014 ${entityCount} entities${comp.homebrew ? " \u2014 homebrew" : ""}`;

        new Setting(containerEl)
          .setName(comp.name)
          .setDesc(desc)
          .addToggle((toggle) => {
            toggle
              .setTooltip("Read-only")
              .setValue(comp.readonly)
              .onChange(async (value: boolean) => {
                await compManager.setReadonly(comp.name, value);
              });
          });
      }
    }
  }
}
