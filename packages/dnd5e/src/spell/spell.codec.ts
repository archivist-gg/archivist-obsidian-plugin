import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { Spell } from "./spell.types";
import { parseSpell } from "./spell.parser";

export const spellCodec: DocCodec<Spell> = {
  parse(doc: EntityDoc): ParseResult<Spell> {
    return parseSpell(doc.body);
  },
  serialize(spell: Spell): string {
    return yaml.dump(spell, { lineWidth: -1, sortKeys: false });
  },
};
