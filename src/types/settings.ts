export interface ArchivistSettings {
  ttrpgRootDir: string;
  permissionMode: "auto" | "safe";
  defaultModel: string;
  maxConversations: number;
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  ttrpgRootDir: "/",
  permissionMode: "safe",
  defaultModel: "claude-sonnet-4-6",
  maxConversations: 50,
};
