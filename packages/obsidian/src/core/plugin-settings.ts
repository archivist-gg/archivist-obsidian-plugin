/**
 * D&D-content settings for the Archivist plugin.
 */
export interface ArchivistSettings {
  compendiumRoot: string;
  userEntityFolder: string;
  srdImported: boolean;
  ttrpgRootDir: string;
  externalContextPaths: string[];
  defaultMultiColumn: boolean;
  multiColumnThreshold: number;
  playerCharactersFolder: string;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  compendiumRoot: "Compendium",
  userEntityFolder: "me",
  srdImported: false,
  ttrpgRootDir: "/",
  externalContextPaths: [],
  defaultMultiColumn: false,
  multiColumnThreshold: 20,
  playerCharactersFolder: "PlayerCharacters",
};
