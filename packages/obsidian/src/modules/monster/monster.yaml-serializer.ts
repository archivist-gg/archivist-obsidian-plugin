import * as yaml from "js-yaml";
import type { EditableMonster } from "./monster.edit-state";
import { editableToMonster } from "./monster.edit-state";

export function editableToYaml(editable: EditableMonster): string {
  const monster = editableToMonster(editable);
  return yaml.dump(monster, {
    lineWidth: -1,
    quotingType: '"',
    forceQuotes: false,
    sortKeys: false,
    noRefs: true,
  });
}
