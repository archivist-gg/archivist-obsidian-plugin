/**
 * Tiny DSL for Resource.max_formula and Resource.recovery[].amount (SP4d). Grammar:
 *   expr   := term (('+' | '-') term)*
 *   term   := factor (('*' | '/') factor)*
 *   factor := number | ident | '{' ident '}' | fn '(' expr ')' | '(' expr ')'
 *   fn     := 'ceil' | 'floor'
 *   ident  := level | class_level | prof | <abil>_mod
 * '*' and '/' bind tighter than '+'/'-'. '/' is real division; wrap in
 * ceil()/floor() for integer results (e.g. "ceil({class_level}/2)").
 * `999` is the at-will sentinel; it evaluates as the literal 999.
 */
export interface FormulaBindings {
  level: number;
  class_level: number;
  prof: number;
  str_mod: number; dex_mod: number; con_mod: number;
  int_mod: number; wis_mod: number; cha_mod: number;
}

const IDENTS = new Set([
  "level", "class_level", "prof",
  "str_mod", "dex_mod", "con_mod", "int_mod", "wis_mod", "cha_mod",
]);
const FUNCS = new Set(["ceil", "floor"]);

type Tok =
  | { kind: "num"; value: number }
  | { kind: "id"; name: string }
  | { kind: "fn"; name: "ceil" | "floor" }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(input: string): Tok[] | null {
  input = input.trim();
  const tokens: Tok[] = [];
  const re = /\s*(\{[a-z_]+\}|[a-z_]+|\d+|[+\-*/()])/y;
  let i = 0;
  while (i < input.length) {
    re.lastIndex = i;
    const m = re.exec(input);
    if (!m || m.index !== i) return null;
    const raw = m[1];
    i = re.lastIndex;
    if (/^\d+$/.test(raw)) tokens.push({ kind: "num", value: parseInt(raw, 10) });
    else if (raw === "(") tokens.push({ kind: "lparen" });
    else if (raw === ")") tokens.push({ kind: "rparen" });
    else if (raw === "+" || raw === "-" || raw === "*" || raw === "/") tokens.push({ kind: "op", op: raw });
    else {
      const braced = raw.startsWith("{");
      const name = braced ? raw.slice(1, -1) : raw;
      if (!braced && FUNCS.has(name)) tokens.push({ kind: "fn", name: name as "ceil" | "floor" });
      else if (IDENTS.has(name)) tokens.push({ kind: "id", name });
      else return null;
    }
  }
  return tokens.length > 0 ? tokens : null;
}

function evalTokens(tokens: Tok[], b: FormulaBindings): number | null {
  let pos = 0;
  const peek = () => tokens[pos];
  const factor = (): number | null => {
    const t = peek();
    if (!t) return null;
    if (t.kind === "num") { pos++; return t.value; }
    if (t.kind === "id") {
      const val = (b as unknown as Record<string, number>)[t.name];
      if (val === undefined) return null;
      pos++;
      return val;
    }
    if (t.kind === "fn") {
      pos++;
      if (peek()?.kind !== "lparen") return null;
      pos++;
      const inner = expr();
      if (inner === null) return null;
      if (peek()?.kind !== "rparen") return null;
      pos++;
      return t.name === "ceil" ? Math.ceil(inner) : Math.floor(inner);
    }
    if (t.kind === "lparen") {
      pos++;
      const inner = expr();
      if (inner === null) return null;
      if (peek()?.kind !== "rparen") return null;
      pos++;
      return inner;
    }
    return null;
  };
  const term = (): number | null => {
    let v = factor();
    if (v === null) return null;
    while (peek()?.kind === "op" && ((peek() as { op: string }).op === "*" || (peek() as { op: string }).op === "/")) {
      const op = (peek() as { op: string }).op;
      pos++;
      const r = factor();
      if (r === null) return null;
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    if (v === null) return null;
    while (peek()?.kind === "op" && ((peek() as { op: string }).op === "+" || (peek() as { op: string }).op === "-")) {
      const op = (peek() as { op: "+" | "-" }).op;
      pos++;
      const r = term();
      if (r === null) return null;
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const result = expr();
  if (result === null || pos !== tokens.length) return null;
  return result;
}

const ZERO: FormulaBindings = {
  level: 1, class_level: 1, prof: 2,
  str_mod: 0, dex_mod: 0, con_mod: 0, int_mod: 0, wis_mod: 0, cha_mod: 0,
};

export function isValidMaxFormula(formula: string): boolean {
  const toks = tokenize(formula);
  if (!toks) return false;
  return evalTokens(toks, ZERO) !== null;
}

export function evaluateMaxFormula(formula: string, bindings: FormulaBindings): number {
  const toks = tokenize(formula);
  if (!toks) throw new Error(`invalid max_formula: ${JSON.stringify(formula)}`);
  const v = evalTokens(toks, bindings);
  if (v === null) throw new Error(`invalid max_formula: ${JSON.stringify(formula)}`);
  return v;
}
