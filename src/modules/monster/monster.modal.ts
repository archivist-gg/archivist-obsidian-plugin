import { App, Editor, Modal } from "obsidian";
import {
  addTextField,
  addDropdown,
  addNumberField,
  addRepeatableSection,
  toYamlString,
} from "../../shared/ui/modal-utils";

interface MonsterFormData {
  name: string;
  size: string;
  type: string;
  subtype: string;
  alignment: string;
  ac: string;
  acFrom: string;
  hpAverage: string;
  hpFormula: string;
  speedWalk: string;
  speedFly: string;
  speedSwim: string;
  speedClimb: string;
  speedBurrow: string;
  str: string;
  dex: string;
  con: string;
  int: string;
  wis: string;
  cha: string;
  saves: string;
  skills: string;
  senses: string;
  passivePerception: string;
  languages: string;
  cr: string;
  damageVulnerabilities: string;
  damageResistances: string;
  damageImmunities: string;
  conditionImmunities: string;
  legendaryActions: string;
  legendaryResistance: string;
  traits: { name: string; text: string }[];
  actions: { name: string; text: string }[];
  reactions: { name: string; text: string }[];
  legendary: { name: string; text: string }[];
}

const SIZE_OPTIONS: Record<string, string> = {
  "": "-- Select Size --",
  Tiny: "Tiny",
  Small: "Small",
  Medium: "Medium",
  Large: "Large",
  Huge: "Huge",
  Gargantuan: "Gargantuan",
};

export class MonsterModal extends Modal {
  private editor: Editor;
  private form: MonsterFormData;

  constructor(app: App, editor: Editor) {
    super(app);
    this.editor = editor;
    this.form = {
      name: "",
      size: "",
      type: "",
      subtype: "",
      alignment: "",
      ac: "",
      acFrom: "",
      hpAverage: "",
      hpFormula: "",
      speedWalk: "",
      speedFly: "",
      speedSwim: "",
      speedClimb: "",
      speedBurrow: "",
      str: "",
      dex: "",
      con: "",
      int: "",
      wis: "",
      cha: "",
      saves: "",
      skills: "",
      senses: "",
      passivePerception: "",
      languages: "",
      cr: "",
      damageVulnerabilities: "",
      damageResistances: "",
      damageImmunities: "",
      conditionImmunities: "",
      legendaryActions: "",
      legendaryResistance: "",
      traits: [],
      actions: [],
      reactions: [],
      legendary: [],
    };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("archivist-modal");
    contentEl.createEl("h2", { text: "Create monster" });

    // Basic Info
    addTextField(contentEl, "Name *", "Goblin", (v) => (this.form.name = v));
    addDropdown(contentEl, "Size", SIZE_OPTIONS, (v) => (this.form.size = v));
    addTextField(contentEl, "Type", "humanoid", (v) => (this.form.type = v));
    addTextField(contentEl, "Subtype", "goblinoid", (v) => (this.form.subtype = v));
    addTextField(contentEl, "Alignment", "neutral evil", (v) => (this.form.alignment = v));
    addTextField(contentEl, "Challenge Rating", "1/4", (v) => (this.form.cr = v));

    // AC & HP
    contentEl.createEl("h3", { text: "Defenses" });
    addNumberField(contentEl, "Armor Class", "15", (v) => (this.form.ac = v));
    addTextField(contentEl, "AC From", "leather armor, shield", (v) => (this.form.acFrom = v));
    addNumberField(contentEl, "HP Average", "7", (v) => (this.form.hpAverage = v));
    addTextField(contentEl, "HP Formula", "2d6", (v) => (this.form.hpFormula = v));

    // Speed
    contentEl.createEl("h3", { text: "Speed" });
    addNumberField(contentEl, "Walk", "30", (v) => (this.form.speedWalk = v));
    addNumberField(contentEl, "Fly", "0", (v) => (this.form.speedFly = v));
    addNumberField(contentEl, "Swim", "0", (v) => (this.form.speedSwim = v));
    addNumberField(contentEl, "Climb", "0", (v) => (this.form.speedClimb = v));
    addNumberField(contentEl, "Burrow", "0", (v) => (this.form.speedBurrow = v));

    // Abilities
    contentEl.createEl("h3", { text: "Ability scores" });
    addNumberField(contentEl, "STR", "10", (v) => (this.form.str = v));
    addNumberField(contentEl, "DEX", "10", (v) => (this.form.dex = v));
    addNumberField(contentEl, "CON", "10", (v) => (this.form.con = v));
    addNumberField(contentEl, "INT", "10", (v) => (this.form.int = v));
    addNumberField(contentEl, "WIS", "10", (v) => (this.form.wis = v));
    addNumberField(contentEl, "CHA", "10", (v) => (this.form.cha = v));

    // Secondary
    contentEl.createEl("h3", { text: "Secondary properties" });
    addTextField(contentEl, "Saving Throws", "dex: 4, con: 2", (v) => (this.form.saves = v));
    addTextField(contentEl, "Skills", "stealth: 6, perception: 2", (v) => (this.form.skills = v));
    addTextField(contentEl, "Senses", "darkvision 60 ft.", (v) => (this.form.senses = v));
    addNumberField(contentEl, "Passive Perception", "9", (v) => (this.form.passivePerception = v));
    addTextField(contentEl, "Languages", "Common, Goblin", (v) => (this.form.languages = v));

    // Damage/Condition
    contentEl.createEl("h3", { text: "Resistances & immunities" });
    addTextField(contentEl, "Damage Vulnerabilities", "fire, radiant", (v) => (this.form.damageVulnerabilities = v));
    addTextField(contentEl, "Damage Resistances", "cold, lightning", (v) => (this.form.damageResistances = v));
    addTextField(contentEl, "Damage Immunities", "poison", (v) => (this.form.damageImmunities = v));
    addTextField(contentEl, "Condition Immunities", "poisoned", (v) => (this.form.conditionImmunities = v));

    // Legendary
    contentEl.createEl("h3", { text: "Legendary" });
    addNumberField(contentEl, "Legendary Actions", "3", (v) => (this.form.legendaryActions = v));
    addNumberField(contentEl, "Legendary Resistance", "3", (v) => (this.form.legendaryResistance = v));

    // Feature sections
    contentEl.createEl("h3", { text: "Features" });
    addRepeatableSection(contentEl, "Trait", this.form.traits, (e) => (this.form.traits = e));
    addRepeatableSection(contentEl, "Action", this.form.actions, (e) => (this.form.actions = e));
    addRepeatableSection(contentEl, "Reaction", this.form.reactions, (e) => (this.form.reactions = e));
    addRepeatableSection(contentEl, "Legendary Action", this.form.legendary, (e) => (this.form.legendary = e));

    // Insert button
    const btnContainer = contentEl.createDiv({ cls: "archivist-modal-buttons" });
    const insertBtn = btnContainer.createEl("button", {
      text: "Insert monster block",
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

    if (this.form.size) obj.size = this.form.size;
    if (this.form.type) obj.type = this.form.type;
    if (this.form.subtype) obj.subtype = this.form.subtype;
    if (this.form.alignment) obj.alignment = this.form.alignment;
    if (this.form.cr) obj.cr = this.form.cr;

    // AC
    if (this.form.ac) {
      const acObj: Record<string, unknown> = { ac: Number(this.form.ac) };
      if (this.form.acFrom) {
        acObj.from = this.form.acFrom.split(",").map((s) => s.trim());
      }
      obj.ac = [acObj];
    }

    // HP
    if (this.form.hpAverage) {
      const hpObj: Record<string, unknown> = {
        average: Number(this.form.hpAverage),
      };
      if (this.form.hpFormula) hpObj.formula = this.form.hpFormula;
      obj.hp = hpObj;
    }

    // Speed
    const speed: Record<string, number> = {};
    if (this.form.speedWalk) speed.walk = Number(this.form.speedWalk);
    if (this.form.speedFly) speed.fly = Number(this.form.speedFly);
    if (this.form.speedSwim) speed.swim = Number(this.form.speedSwim);
    if (this.form.speedClimb) speed.climb = Number(this.form.speedClimb);
    if (this.form.speedBurrow) speed.burrow = Number(this.form.speedBurrow);
    if (Object.keys(speed).length > 0) obj.speed = speed;

    // Abilities
    const abilities: Record<string, number> = {};
    if (this.form.str) abilities.str = Number(this.form.str);
    if (this.form.dex) abilities.dex = Number(this.form.dex);
    if (this.form.con) abilities.con = Number(this.form.con);
    if (this.form.int) abilities.int = Number(this.form.int);
    if (this.form.wis) abilities.wis = Number(this.form.wis);
    if (this.form.cha) abilities.cha = Number(this.form.cha);
    if (Object.keys(abilities).length > 0) obj.abilities = abilities;

    // Saves (parse "dex: 4, con: 2" format)
    if (this.form.saves) {
      const saves: Record<string, number> = {};
      this.form.saves.split(",").forEach((pair) => {
        const [key, val] = pair.split(":").map((s) => s.trim());
        if (key && val) saves[key] = Number(val);
      });
      if (Object.keys(saves).length > 0) obj.saves = saves;
    }

    // Skills
    if (this.form.skills) {
      const skills: Record<string, number> = {};
      this.form.skills.split(",").forEach((pair) => {
        const [key, val] = pair.split(":").map((s) => s.trim());
        if (key && val) skills[key] = Number(val);
      });
      if (Object.keys(skills).length > 0) obj.skills = skills;
    }

    // Arrays
    if (this.form.senses) {
      obj.senses = this.form.senses.split(",").map((s) => s.trim());
    }
    if (this.form.passivePerception) {
      obj.passive_perception = Number(this.form.passivePerception);
    }
    if (this.form.languages) {
      obj.languages = this.form.languages.split(",").map((s) => s.trim());
    }
    if (this.form.damageVulnerabilities) {
      obj.damage_vulnerabilities = this.form.damageVulnerabilities
        .split(",")
        .map((s) => s.trim());
    }
    if (this.form.damageResistances) {
      obj.damage_resistances = this.form.damageResistances
        .split(",")
        .map((s) => s.trim());
    }
    if (this.form.damageImmunities) {
      obj.damage_immunities = this.form.damageImmunities
        .split(",")
        .map((s) => s.trim());
    }
    if (this.form.conditionImmunities) {
      obj.condition_immunities = this.form.conditionImmunities
        .split(",")
        .map((s) => s.trim());
    }

    // Legendary
    if (this.form.legendaryActions) {
      obj.legendary_actions = Number(this.form.legendaryActions);
    }
    if (this.form.legendaryResistance) {
      obj.legendary_resistance = Number(this.form.legendaryResistance);
    }

    // Features
    const formatFeatures = (entries: { name: string; text: string }[]) =>
      entries
        .filter((e) => e.name.trim())
        .map((e) => ({ name: e.name, entries: [e.text] }));

    const traits = formatFeatures(this.form.traits);
    if (traits.length > 0) obj.traits = traits;

    const actions = formatFeatures(this.form.actions);
    if (actions.length > 0) obj.actions = actions;

    const reactions = formatFeatures(this.form.reactions);
    if (reactions.length > 0) obj.reactions = reactions;

    const legendary = formatFeatures(this.form.legendary);
    if (legendary.length > 0) obj.legendary = legendary;

    const yamlStr = toYamlString(obj);
    const block = "```monster\n" + yamlStr + "\n```\n";
    this.editor.replaceSelection(block);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
