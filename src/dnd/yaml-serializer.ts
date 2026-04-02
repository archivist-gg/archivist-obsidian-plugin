import * as yaml from "js-yaml";
import type { EditableMonster } from "./editable-monster";
import { editableToMonster } from "./editable-monster";

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
