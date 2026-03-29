export interface ArchivistSettings {
  ttrpgRootDir: string;
  permissionMode: "auto" | "safe";
  defaultModel: string;
  thinkingBudget: string;
  maxConversations: number;
  externalContextPaths: string[];
}

export const DEFAULT_SETTINGS: ArchivistSettings = {
  ttrpgRootDir: "/",
  permissionMode: "safe",
  defaultModel: "claude-sonnet-4-6",
  thinkingBudget: "auto",
  maxConversations: 50,
  externalContextPaths: [],
};
