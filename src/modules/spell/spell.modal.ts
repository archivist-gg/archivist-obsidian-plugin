import { App, Editor, Modal } from "obsidian";
import {
  addTextField,
  addDropdown,
  addTextArea,
  addToggle,
  toYamlString,
} from "../../shared/ui/modal-utils";

interface SpellFormData {
  name: string;
  level: string;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  classes: string;
  description: string;
  atHigherLevels: string;
}

const LEVEL_OPTIONS: Record<string, string> = {
  "": "-- Select Level --",
  "0": "Cantrip",
  "1": "1st",
  "2": "2nd",
  "3": "3rd",
  "4": "4th",
  "5": "5th",
  "6": "6th",
  "7": "7th",
  "8": "8th",
  "9": "9th",
};

const SCHOOL_OPTIONS: Record<string, string> = {
  "": "-- Select School --",
  Abjuration: "Abjuration",
  Conjuration: "Conjuration",
  Divination: "Divination",
  Enchantment: "Enchantment",
  Evocation: "Evocation",
  Illusion: "Illusion",
  Necromancy: "Necromancy",
  Transmutation: "Transmutation",
};

export class SpellModal extends Modal {
  private editor: Editor;
  private form: SpellFormData;

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
    this.form = {
      name: "",
      level: "",
      school: "",
      castingTime: "",
      range: "",
      components: "",
      duration: "",
      concentration: false,
      ritual: false,
      classes: "",
      description: "",
      atHigherLevels: "",
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("archivist-modal");
    contentEl.createEl("h2", { text: "Create spell" });

    addTextField(contentEl, "Name *", "Fireball", (v) => (this.form.name = v));
    addDropdown(contentEl, "Level", LEVEL_OPTIONS, (v) => (this.form.level = v));
    addDropdown(contentEl, "School", SCHOOL_OPTIONS, (v) => (this.form.school = v));
    addTextField(contentEl, "Casting Time", "1 action", (v) => (this.form.castingTime = v));
    addTextField(contentEl, "Range", "150 feet", (v) => (this.form.range = v));
    addTextField(contentEl, "Components", "V, S, M (a tiny ball of bat guano and sulfur)", (v) => (this.form.components = v));
    addTextField(contentEl, "Duration", "Instantaneous", (v) => (this.form.duration = v));
    addToggle(contentEl, "Concentration", (v) => (this.form.concentration = v));
    addToggle(contentEl, "Ritual", (v) => (this.form.ritual = v));
    addTextField(contentEl, "Classes", "Sorcerer, Wizard", (v) => (this.form.classes = v));
    addTextArea(contentEl, "Description", "Spell description...", (v) => (this.form.description = v));
    addTextArea(contentEl, "At Higher Levels", "When you cast this spell using a spell slot of...", (v) => (this.form.atHigherLevels = v));

    // Insert button
    const btnContainer = contentEl.createDiv({ cls: "archivist-modal-buttons" });
    const insertBtn = btnContainer.createEl("button", {
      text: "Insert spell block",
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

    if (this.form.level !== "") obj.level = Number(this.form.level);
    if (this.form.school) obj.school = this.form.school;
    if (this.form.castingTime) obj.casting_time = this.form.castingTime;
    if (this.form.range) obj.range = this.form.range;
    if (this.form.components) obj.components = this.form.components;
    if (this.form.duration) obj.duration = this.form.duration;
    if (this.form.concentration) obj.concentration = true;
    if (this.form.ritual) obj.ritual = true;

    if (this.form.classes) {
      obj.classes = this.form.classes.split(",").map((s) => s.trim());
    }

    if (this.form.description) {
      obj.description = this.form.description
        .split("\n")
        .filter((s) => s.trim());
    }

    if (this.form.atHigherLevels) {
      obj.at_higher_levels = this.form.atHigherLevels
        .split("\n")
        .filter((s) => s.trim());
    }

    const yamlStr = toYamlString(obj);
    const block = "```spell\n" + yamlStr + "\n```\n";
    this.editor.replaceSelection(block);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
