/** A single alternate casting mode for a spell (e.g. a different shape, range,
 *  or scaling). Lives in dnd5e so the build-time SRD spell merger can consume
 *  it without a tools→obsidian reverse edge; obsidian `spell.types` re-exports
 *  it for the renderer/parser. */
export interface CastingOption {
  type: string;
  damage_roll?: string;
  target_count?: number;
  duration?: string;
  range?: number;
  concentration?: boolean;
  shape_size?: number;
  desc?: string;
}
