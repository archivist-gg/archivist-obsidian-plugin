// tests/migrate-formula-tags.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { migrateMonsterFile } from "../scripts/migrate-formula-tags";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "phase05-migrate-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("migrateMonsterFile", () => {
  it("converts the legacy Hit format on a Knight-like monster", () => {
    const md = `---
archivist: true
entity_type: monster
slug: knight
name: Knight
compendium: Me
---

\`\`\`monster
name: Knight
slug: knight
abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 }
challenge_rating: 3
actions:
  - name: Greatsword
    entries:
      - "Melee Weapon Attack: +5 to hit, reach 5 ft. Hit: 10 (2d6 + 3) slashing damage."
\`\`\`
`;
    const filePath = path.join(tmpDir, "Knight.md");
    fs.writeFileSync(filePath, md);
    const changed = migrateMonsterFile(filePath);
    expect(changed).toBe(true);
    const after = fs.readFileSync(filePath, "utf-8");
    expect(after).toContain("atk:STR+PB");
    expect(after).toContain("dmg:2d6+STR");
  });

  it("returns false when no migration is needed (already in tag form, idempotent)", () => {
    const md = `---
archivist: true
entity_type: monster
---

\`\`\`monster
name: Already Migrated
slug: already-migrated
abilities: { str: 16, dex: 11, con: 14, int: 11, wis: 11, cha: 15 }
challenge_rating: 3
actions:
  - name: Greatsword
    entries:
      - "Already converted prose with no recognizable patterns."
\`\`\`
`;
    const filePath = path.join(tmpDir, "Already.md");
    fs.writeFileSync(filePath, md);
    const result = migrateMonsterFile(filePath);
    expect(result).toBe(false);
  });
});
