import { App, PluginSettingTab, Setting } from "obsidian";
import type ArchivistPlugin from "../main";

/**
 * Settings tab for D&D Content configuration.
 *
 * Chat/inquiry settings are managed by InquiryModule and appear in a
 * separate "Archivist Inquiry" settings tab.
 */
export class ArchivistSettingTab extends PluginSettingTab {
  plugin: ArchivistPlugin;

  constructor(app: App, plugin: ArchivistPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.name = "Archivist";
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("p", {
      text: "Chat and AI settings are in the separate archivist inquiry settings tab (registered by inquirymodule).",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Campaign root directory")
      .setDesc("Scope AI vault access to this directory. Leave as / for entire vault.")
      .addText((text) =>
        text.setPlaceholder("/").setValue(this.plugin.settings.ttrpgRootDir)
          .onChange(async (value) => {
            this.plugin.settings.ttrpgRootDir = value || "/";
            await this.plugin.saveSettings();
          }),
      );

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

    new Setting(containerEl).setName("Compendiums").setHeading();
    containerEl.createEl("p", {
      text: 'Compendiums are collections of D&D entities (monsters, spells, items) stored as folders in your vault. Read-only compendiums cannot be modified \u2014 editing an entity from a read-only compendium will only allow "Save As New" to a writable compendium. Toggle read-only here or by editing the _compendium.md file inside each compendium folder.',
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
