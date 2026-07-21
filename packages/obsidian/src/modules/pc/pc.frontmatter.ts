/**
 * Pure, byte-preserving read/splice helpers for the leading YAML frontmatter
 * fence of a PC markdown file (the `---`...`---` block above the `pc` code
 * block). Zero imports, no Obsidian API — callers own the vault I/O.
 */

/** Fence bounds: line 0 must be exactly `---`, closing = next line that is exactly `---`. */
function findFence(lines: string[]): { closeIdx: number } | null {
  if (lines[0] !== "---") return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") return { closeIdx: i };
  }
  return null;
}

function unescapeDoubleQuoted(inner: string): string {
  let out = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "\\" && (inner[i + 1] === "\\" || inner[i + 1] === '"')) {
      out += inner[i + 1];
      i++;
      continue;
    }
    out += c;
  }
  return out;
}

function parseScalar(value: string): string | null {
  if (value.length === 0) return null;
  if (value.length >= 2 && value[0] === '"' && value[value.length - 1] === '"') {
    return unescapeDoubleQuoted(value.slice(1, -1));
  }
  if (value.length >= 2 && value[0] === "'" && value[value.length - 1] === "'") {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

/**
 * First occurrence of `key:` inside the leading `---` fence. Unquotes/
 * unescapes double-quoted scalars, strips single quotes (`''`→`'`), trims
 * bare scalars. `null` when there's no fence, no key, or an empty value.
 */
export function readFrontmatterValue(raw: string, key: string): string | null {
  const lines = raw.split(/\r?\n/);
  const fence = findFence(lines);
  if (!fence) return null;
  const prefix = `${key}:`;
  for (let i = 1; i < fence.closeIdx; i++) {
    const line = lines[i];
    if (line.startsWith(prefix)) {
      return parseScalar(line.slice(prefix.length).trim());
    }
  }
  return null;
}

/** A `key:` line plus any more-indented continuation lines that follow it. */
function occurrenceRanges(lines: string[], key: string, bodyEnd: number): Array<[number, number]> {
  const prefix = `${key}:`;
  const ranges: Array<[number, number]> = [];
  for (let i = 1; i < bodyEnd; i++) {
    if (lines[i].startsWith(prefix)) {
      let end = i + 1;
      while (end < bodyEnd && /^[ \t]/.test(lines[end])) end++;
      ranges.push([i, end]);
      i = end - 1;
    }
  }
  return ranges;
}

function escapeDoubleQuoted(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Splices `key` inside the leading `---` fence. `value: null` removes every
 * occurrence (no-op if absent). Otherwise the first occurrence is replaced
 * in place (its line plus any indented continuation lines), further
 * duplicates are dropped, and a missing key is added immediately before the
 * closing fence as `key: "escaped"`. Returns `null` when `raw` has no
 * leading `---` fence. Lines are split on `/\r?\n/` and rejoined with `"\n"`
 * (same CRLF normalization as `spliceCodeBlock`); every unrelated line is
 * byte-preserved.
 */
export function spliceFrontmatterKey(raw: string, key: string, value: string | null): string | null {
  const lines = raw.split(/\r?\n/);
  const fence = findFence(lines);
  if (!fence) return null;
  const ranges = occurrenceRanges(lines, key, fence.closeIdx);

  let result: string[];
  if (value === null) {
    result = [];
    let cursor = 0;
    for (const [start, end] of ranges) {
      result.push(...lines.slice(cursor, start));
      cursor = end;
    }
    result.push(...lines.slice(cursor));
  } else {
    const newLine = `${key}: "${escapeDoubleQuoted(value)}"`;
    if (ranges.length === 0) {
      result = [...lines.slice(0, fence.closeIdx), newLine, ...lines.slice(fence.closeIdx)];
    } else {
      result = [];
      let cursor = 0;
      ranges.forEach(([start, end], idx) => {
        result.push(...lines.slice(cursor, start));
        if (idx === 0) result.push(newLine);
        cursor = end;
      });
      result.push(...lines.slice(cursor));
    }
  }
  return result.join("\n");
}
