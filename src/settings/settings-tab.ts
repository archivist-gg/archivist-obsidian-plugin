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
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Archivist - D&D Content" });

    containerEl.createEl("p", {
      text: "Chat and AI settings are in the separate Archivist Inquiry settings tab (registered by InquiryModule).",
      cls: "setting-item-description",
    });

    // TTRPG Root Directory
    new Setting(containerEl)
      .setName("TTRPG Root Directory")
      .setDesc("Scope AI vault access to this directory. Leave as / for entire vault.")
      .addText((text) =>
        text.setPlaceholder("/").setValue(this.plugin.settings.ttrpgRootDir)
          .onChange(async (value) => {
            this.plugin.settings.ttrpgRootDir = value || "/";
            await this.plugin.saveSettings();
          }),
      );

    // Entity Compendium
    containerEl.createEl("h3", { text: "Entity Compendium" });

    new Setting(containerEl)
      .setName("Compendium Root Folder")
      .setDesc("Root vault folder where entity notes are stored.")
      .addText((text) =>
        text.setPlaceholder("Compendium").setValue(this.plugin.settings.compendiumRoot)
          .onChange(async (value) => {
            this.plugin.settings.compendiumRoot = value || "Compendium";
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("User Entity Folder")
      .setDesc("Subfolder name for user-created and AI-generated entities.")
      .addText((text) =>
        text.setPlaceholder("me").setValue(this.plugin.settings.userEntityFolder)
          .onChange(async (value) => {
            this.plugin.settings.userEntityFolder = value || "me";
            await this.plugin.saveSettings();
          }),
      );
  }
}
