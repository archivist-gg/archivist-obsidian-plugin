/**
 * D&D-content settings for the Archivist plugin.
 */
export interface ArchivistSettings {
  compendiumRoot: string;
  srdImported: boolean;
  defaultMultiColumn: boolean;
  multiColumnThreshold: number;
  playerCharactersFolder: string;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  srdImported: false,
  defaultMultiColumn: false,
  multiColumnThreshold: 20,
  playerCharactersFolder: "PlayerCharacters",
};
