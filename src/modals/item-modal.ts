import { App, Editor, Modal } from "obsidian";
import {
  addTextField,
  addDropdown,
  addTextArea,
  addToggle,
  addNumberField,
  toYamlString,
} from "../shared/ui/modal-utils";

interface ItemFormData {
  name: string;
  type: string;
  rarity: string;
  attunement: boolean;
  attunementText: string;
  weight: string;
  damage: string;
  damageType: string;
  properties: string;
  charges: string;
  recharge: string;
  curse: boolean;
  description: string;
}

const RARITY_OPTIONS: Record<string, string> = {
  "": "-- Select Rarity --",
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  "very rare": "Very Rare",
  legendary: "Legendary",
  artifact: "Artifact",
};

export class ItemModal extends Modal {
  private editor: Editor;
  private form: ItemFormData;

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
    this.form = {
      name: "",
      type: "",
      rarity: "",
      attunement: false,
      attunementText: "",
      weight: "",
      damage: "",
      damageType: "",
      properties: "",
      charges: "",
      recharge: "",
      curse: false,
      description: "",
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("archivist-modal");
    contentEl.createEl("h2", { text: "Create magic item" });

    addTextField(contentEl, "Name *", "Flame Tongue Longsword", (v) => (this.form.name = v));
    addTextField(contentEl, "Type", "weapon (longsword)", (v) => (this.form.type = v));
    addDropdown(contentEl, "Rarity", RARITY_OPTIONS, (v) => (this.form.rarity = v));

    // Attunement toggle + text
    addToggle(contentEl, "Requires Attunement", (v) => (this.form.attunement = v));
    addTextField(contentEl, "Attunement Requirement", "a spellcaster", (v) => (this.form.attunementText = v));

    addTextField(contentEl, "Weight", "3", (v) => (this.form.weight = v));
    addTextField(contentEl, "Damage", "1d8", (v) => (this.form.damage = v));
    addTextField(contentEl, "Damage Type", "slashing", (v) => (this.form.damageType = v));
    addTextField(contentEl, "Properties", "versatile, magical", (v) => (this.form.properties = v));
    addNumberField(contentEl, "Charges", "0", (v) => (this.form.charges = v));
    addTextField(contentEl, "Recharge", "dawn", (v) => (this.form.recharge = v));
    addToggle(contentEl, "Curse", (v) => (this.form.curse = v));
    addTextArea(contentEl, "Description", "Item description...", (v) => (this.form.description = v));

    // Insert button
    const btnContainer = contentEl.createDiv({ cls: "archivist-modal-buttons" });
    const insertBtn = btnContainer.createEl("button", {
      text: "Insert item block",
      cls: "mod-cta",
    });
    insertBtn.addEventListener("click", () => {
      this.insertBlock();
    });
  }

  private insertBlock(): void {
    if (!this.form.name.trim()) {
      return;
    }

    const obj: Record<string, unknown> = {};
    obj.name = this.form.name;

    if (this.form.type) obj.type = this.form.type;
    if (this.form.rarity) obj.rarity = this.form.rarity;

    if (this.form.attunement) {
      if (this.form.attunementText) {
        obj.attunement = this.form.attunementText;
      } else {
        obj.attunement = true;
      }
    }

    if (this.form.weight) obj.weight = Number(this.form.weight);
    if (this.form.damage) obj.damage = this.form.damage;
    if (this.form.damageType) obj.damage_type = this.form.damageType;

    if (this.form.properties) {
      obj.properties = this.form.properties.split(",").map((s) => s.trim());
    }

    if (this.form.charges) obj.charges = Number(this.form.charges);
    if (this.form.recharge) obj.recharge = this.form.recharge;
    if (this.form.curse) obj.curse = true;

    if (this.form.description) {
      obj.entries = this.form.description
        .split("\n")
        .filter((s) => s.trim());
    }

    const yamlStr = toYamlString(obj);
    const block = "```item\n" + yamlStr + "\n```\n";
    this.editor.replaceSelection(block);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
