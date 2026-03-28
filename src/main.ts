import { Plugin } from "obsidian";

export default class ArchivistPlugin extends Plugin {
  async onload() {
    console.log("Archivist TTRPG Blocks loaded");
  }

  onunload() {
    console.log("Archivist TTRPG Blocks unloaded");
  }
}
