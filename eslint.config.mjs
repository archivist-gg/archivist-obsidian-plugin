import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import comments from "@eslint-community/eslint-plugin-eslint-comments";

// Default acronyms recognised by obsidianmd/ui/sentence-case. Supplying a
// custom `acronyms` option REPLACES the defaults, so we reproduce them here
// before appending project-specific ones.
const defaultAcronyms = [
  "API", "HTTP", "HTTPS", "URL", "DNS", "TCP", "IP", "SSH", "TLS", "SSL",
  "FTP", "SFTP", "SMTP",
  "JSON", "XML", "HTML", "CSS", "PDF", "CSV", "YAML", "SQL",
  "PNG", "JPG", "JPEG", "GIF", "SVG",
  "2FA", "MFA", "OAuth", "JWT", "LDAP", "SAML",
  "SDK", "IDE", "CLI", "GUI", "CRUD", "SOAP",
  "CPU", "GPU", "RAM", "SSD", "USB",
  "UI", "OK",
  "RSS", "S3",
  "ID", "UUID", "GUID",
  "SHA", "MD5", "ASCII", "UTF-8", "UTF-16",
  "DOM", "CDN", "FAQ", "AI", "ML", "LLM",
];

// D&D- and project-specific acronyms the sentence-case rule should keep uppercase.
const projectAcronyms = [
  "SRD",   // D&D System Reference Document
  "MCP",   // Model Context Protocol
  "DnD",
  "D&D",
  "NPC",
  "HP",
  "AC",
  "XP",
  "CR",
  "DM",
  "GM",
];

// Rules the Obsidian Review Bot forbids disabling via inline directives.
const restrictedDisableRules = [
  "obsidianmd/*",
  "no-console",
  "no-restricted-globals",
  "no-restricted-imports",
  "no-alert",
  "@typescript-eslint/no-deprecated",
  "@typescript-eslint/no-explicit-any",
  "@microsoft/sdl/no-document-write",
  "@microsoft/sdl/no-eval",
  "@microsoft/sdl/no-inner-html",
  "import/no-nodejs-modules",
  "!obsidianmd/ui/sentence-case",
];

export default defineConfig([
  {
    ignores: [
      "main.js",
      "node_modules/**",
      "dist/**",
      "scripts/**",
      "tests/**",
      "test-vault/**",
      "docs/**",
      "esbuild.config.mjs",
      "vitest.config.ts",
    ],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["**/*.ts"],
    plugins: {
      "@eslint-community/eslint-comments": comments,
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: "./tsconfig.json" },
    },
    rules: {
      "no-undef": "off",
      // Match the Obsidian Review Bot's additional checks so we can reproduce
      // them locally before pushing.
      "require-await": "error",
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        ...restrictedDisableRules,
      ],
      "@eslint-community/eslint-comments/no-unused-disable": "error",
      // Override sentence-case to recognise project acronyms so UI text like
      // "Importing SRD..." isn't flagged.
      "obsidianmd/ui/sentence-case": [
        "error",
        {
          enforceCamelCaseLower: true,
          acronyms: [...defaultAcronyms, ...projectAcronyms],
        },
      ],
    },
  },
  // Dev CLI tools: progress logging to stdout/stderr is intended behaviour, so
  // narrow the no-console rule here rather than littering the code with
  // forbidden eslint-disable comments. `no-console` remains enforced
  // everywhere else (in obsidianmd's recommended config it is implemented via
  // `obsidianmd/rule-custom-message`, which wraps `no-console`).
  {
    files: ["tools/**/*.ts"],
    rules: {
      "no-console": "off",
      "obsidianmd/rule-custom-message": "off",
    },
  },
]);
