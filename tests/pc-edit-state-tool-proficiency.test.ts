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

  /** A character whose ROGUE class fixed-grants thieves' tools, over hand-authored overrides.
   *  A real grant is what makes `isEffective` read true once a tri is cleared, so the pip does
   *  not fall through to `add[]`. */
  const rogueGranting = (overrides: Record<string, unknown>) => {
    const char = { overrides } as unknown as Character;
    const resolved = {
      definition: char,
      classes: [{ entity: { slug: "rogue", name: "Rogue", proficiencies: { tools: { fixed: ["thieves' tools"] } } }, subclass: null, level: 1, choices: {} }],
      race: null, background: null, feats: [], features: [], pools: [], state: {},
    };
    return { char, es: new CharacterEditState(char, () => ({ resolved: resolved as never, derived: { hp: { max: 0 } } as never }), vi.fn(), null) };
  };

  it("addProficiency on a none-suppressed DATA grant clears the tri and leaves no add[] (the candidate row's pip restores it)", () => {
    // Without the clearance the pip would stack an `add[]` entry on top of a live `none`,
    // which the engine still suppresses · the tool would never come back and the note would
    // not return to its original bytes.
    const { char, es } = rogueGranting({ tools: { proficiency: { "thieves'-tools": "none" } } });
    es.addProficiency("tools", "thieves' tools");
    expect(char.overrides.tools).toBeUndefined();   // tri cleared, container pruned, NO add[]
  });

  it("RED FIRST: addProficiency clears a HAND-TYPED none key, not only the slug spelling", () => {
    // Review I-2 / probe E3. The ENGINE normalises every tri key with `toProfSlug` on read
    // (`computeEffectiveProficiencies`), so a hand-edited note may spell the key any way and the
    // suppression still applies. A writer that indexed by the slug alone found nothing to clear
    // here and pushed `add: ["thieves' tools"]` beside the live `none` · the engine went on
    // suppressing the tool, the add was inert, and the candidate row's pip became a dead end no
    // further click could undo. Measured before the fix:
    //   {"proficiency":{"Thieves' Tools":"none"},"add":["thieves' tools"]}
    const { char, es } = rogueGranting({ tools: { proficiency: { "Thieves' Tools": "none" } } });
    es.addProficiency("tools", "thieves' tools");
    expect(char.overrides.tools).toBeUndefined();
  });

  it("RED FIRST: setToolProficiency REPAIRS a hand-typed key instead of adding a second one beside it", () => {
    // Review I-2 / probes E4-E5, the same root cause's second face. The engine honours the
    // hand-typed key, so the chip renders `expertise`; a writer that wrote by slug added a
    // SECOND key and the tool was stuck on an expertise <-> none cycle it could never leave,
    // leaving a duplicate behind on every pass. Measured before the fix:
    //   {"proficiency":{"Thieves' Tools":"expertise","thieves'-tools":"none"}}
    const char = { overrides: { tools: { proficiency: { "Thieves' Tools": "expertise" } } } } as unknown as Character;
    state(char).setToolProficiency("thieves'-tools", "none");
    expect(Object.keys(char.overrides.tools!.proficiency!)).toEqual(["Thieves' Tools"]);
    expect(char.overrides.tools!.proficiency!["Thieves' Tools"]).toBe("none");
  });

  it("RED FIRST: a hand-authored empty proficiency record is pruned, not kept", () => {
    // Review M-3 / probe I1. `pruneProfOverride` READ the record rather than emptying it, and
    // `{}` is truthy, so the container survived where the pre-T10 code deleted it. No plugin
    // writer produces `{}` (`setToolProficiency` runs its own emptiness delete), so this is
    // hand-edit residue · but the note is what the user reads, and a container that used to
    // disappear must go on disappearing.
    const { char, es } = rogueGranting({ tools: { proficiency: {} } });
    es.addProficiency("tools", "thieves' tools");
    expect(char.overrides.tools).toBeUndefined();
  });
});
