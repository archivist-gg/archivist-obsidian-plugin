export interface ExtractedCodeBlock {
  yaml: string;
  startLine: number;   // 1-indexed line of the opening ```pc
  endLine: number;     // 1-indexed line of the closing ```
}

/**
 * Pulls the first fenced code block whose info-string is exactly `pc` (or
 * starts with `pc ` / `pc\t`) out of a PC markdown file. Returns null if no
 * such block exists. Only the FIRST match is returned — PC files are
 * expected to contain exactly one `pc` block.
 */
export function extractPCCodeBlock(fileContents: string): ExtractedCodeBlock | null {
  const lines = fileContents.split(/\r?\n/);
  const fenceRe = /^(```+)\s*pc(?:\s|$)/;
  let inBlock = false;
  let fence = "";
  let startLine = 0;
  const buf: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock) {
      const m = line.match(fenceRe);
      if (m) {
        inBlock = true;
        fence = m[1];
        startLine = i + 1;
      }
    } else {
      // Closing fence is any line starting with the same-or-longer backtick run.
      const closeRe = new RegExp(`^${fence}+\\s*$`);
      if (closeRe.test(line)) {
        return { yaml: buf.join("\n"), startLine, endLine: i + 1 };
      }
      buf.push(line);
    }
  }
  return null;
}

/**
 * Splice a new YAML body into the markdown file's `pc` code block, leaving
 * frontmatter and markdown tail byte-identical. `range.startLine` is the
 * 1-indexed line number of the opening ```pc fence; `range.endLine` is the
 * 1-indexed line of the closing ``` — both as returned by
 * `extractPCCodeBlock`. A single trailing newline on `newYamlBody` is
 * stripped so that callers can pass `js-yaml.dump()` output directly.
 */
export function spliceCodeBlock(
  raw: string,
  range: { startLine: number; endLine: number },
  newYamlBody: string,
): string {
  const lines = raw.split(/\r?\n/);
  const before = lines.slice(0, range.startLine);       // includes ```pc fence line
  const after  = lines.slice(range.endLine - 1);        // includes closing ``` line
  const body   = newYamlBody.replace(/\n$/, "").split("\n");
  return [...before, ...body, ...after].join("\n");
}
