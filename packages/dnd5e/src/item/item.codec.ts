import type { DocCodec, EntityDoc, ParseResult } from "@archivist/core";
import yaml from "js-yaml";
import type { ItemEntity } from "./item.types";
import { parseItem } from "./item.parser";

export const itemCodec: DocCodec<ItemEntity> = {
  parse(doc: EntityDoc): ParseResult<ItemEntity> {
    return parseItem(doc.body);
  },
  serialize(item: ItemEntity): string {
    return yaml.dump(item, { lineWidth: -1, sortKeys: false });
  },
};
