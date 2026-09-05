import { describe, it, expect, vi } from "vitest";
import { CharacterEditState } from "../packages/obsidian/src/modules/pc/pc.edit-state";
import type { Character } from "@archivist-gg/dnd5e/pc/pc.types";

/** The constructor idiom of tests/pc-edit-state-prepare.test.ts, minus the parser: this
 *  file asserts on the OVERRIDES OBJECT the writer mutates, so a hand-built literal is
 *  the honest fixture. The 4th constructor parameter (`registry`) defaults to `null`. */
const makeChar = (): Character => ({ overrides: {} } as unknown as Character);
const state = (char: Character) =>
  new CharacterEditState(char, () => ({ resolved: { definition: char } as never, derived: { hp: { max: 0 } } as never }), vi.fn(), null);

describe("CharacterEditState.setToolProficiency (R4-G4 §9.3, UR1)", () => {
  it("RED FIRST: expertise persists under overrides.tools.proficiency by SLUG (U+2019 and U+0027 fold to one key)", () => {
    const char = makeChar();
    state(char).setToolProficiency("Thieves’ tools", "expertise");
    expect(char.overrides.tools).toEqual({ proficiency: { "thieves'-tools": "expertise" } });
  });

  it("none persists; proficient deletes the key and prunes the empty container", () => {
    const char = makeChar(); const es = state(char);
    es.setToolProficiency("thieves'-tools", "none");
    expect(char.overrides.tools).toEqual({ proficiency: { "thieves'-tools": "none" } });
    es.setToolProficiency("thieves'-tools", "proficient");
    expect(char.overrides.tools).toBeUndefined();
  });

  it("proficient leaves a sibling add[] alone (the container is pruned only when EMPTY)", () => {
    const char = makeChar();
    (char.overrides as { tools?: unknown }).tools = { add: ["Runic Cipher"] };
    const es = state(char);
    es.setToolProficiency("thieves'-tools", "expertise");
    es.setToolProficiency("thieves'-tools", "proficient");
    expect(char.overrides.tools).toEqual({ add: ["Runic Cipher"] });
  });

  it("notifies on every write, including the one that only prunes", () => {
    // The house rule for every mutator on this class: exactly one `onChange()` at the
    // end. A writer that returned early on the delete path would leave the sheet
    // showing the old tri until some other edit repainted it.
    const char = makeChar(); const onChange = vi.fn();
    const es = new CharacterEditState(char, () => ({ resolved: { definition: char } as never, derived: { hp: { max: 0 } } as never }), onChange, null);
    es.setToolProficiency("thieves'-tools", "expertise");
    expect(onChange).toHaveBeenCalledTimes(1);
    es.setToolProficiency("thieves'-tools", "proficient");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("addProficiency on a none-suppressed DATA grant clears the tri and leaves no add[] (the candidate row's pip restores it)", () => {
    // A real grant is needed for isEffective to read true once the tri is gone: the
    // Rogue's fixed thieves' tools. Without the clearance the pip would stack an
    // `add[]` entry on top of a live `none`, which the engine still suppresses · the
    // tool would never come back and the note would not return to its original bytes.
    const char = { overrides: { tools: { proficiency: { "thieves'-tools": "none" } } } } as unknown as Character;
    const resolved = {
      definition: char,
      classes: [{ entity: { slug: "rogue", name: "Rogue", proficiencies: { tools: { fixed: ["thieves' tools"] } } }, subclass: null, level: 1, choices: {} }],
      race: null, background: null, feats: [], features: [], pools: [], state: {},
    };
    const es = new CharacterEditState(char, () => ({ resolved: resolved as never, derived: { hp: { max: 0 } } as never }), vi.fn(), null);
    es.addProficiency("tools", "thieves' tools");
    expect(char.overrides.tools).toBeUndefined();   // tri cleared, container pruned, NO add[]
  });
});
