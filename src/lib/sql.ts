export type TokenType =
  | "keyword"
  | "function"
  | "string"
  | "number"
  | "comment"
  | "operator"
  | "ident"
  | "param"
  | "punct";

export interface Token {
  type: TokenType;
  value: string;
}

const KEYWORDS = new Set(
  [
    "select","from","where","group","by","order","having","limit","offset","join","inner","left","right","full",
    "outer","cross","on","and","or","not","in","is","null","as","distinct","count","sum","avg","min","max",
    "case","when","then","else","end","with","union","all","asc","desc","exists","between","like","ilike",
    "using","returning","insert","into","update","set","delete","values","create","index","unique","table",
    "primary","key","references","foreign","default","materialized","view","explain","analyze","coalesce",
    "nullif","cast","interval","true","false","date","timestamp","numeric","varchar","text","bigint","integer",
    "boolean","jsonb","serial","over","partition","row_number","rank","filter","lateral","recursive","if",
  ],
);

const FUNCTIONS = new Set([
  "count","sum","avg","min","max","coalesce","nullif","round","now","date_trunc","to_char","lower","upper",
  "length","extract","greatest","least","percentile_cont","jsonb_agg","array_agg","row_number","rank",
]);

const OPERATORS = new Set(["=", ">", "<", ">=", "<=", "<>", "!=", "+", "-", "*", "/", "%", "||", "::", "@>", "->>", "->"]);

const WORD_RE = /[A-Za-z_][A-Za-z0-9_]*/;
const NUM_RE = /\d+(\.\d+)?/;

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = input;

  while (i < s.length) {
    const ch = s[i]!;
    const rest = s.slice(i);

    if (/\s/.test(ch)) {
      let j = i;
      while (j < s.length && /\s/.test(s[j]!)) j += 1;
      tokens.push({ type: "punct", value: s.slice(i, j) });
      i = j;
      continue;
    }

    if (rest.startsWith("--")) {
      const end = s.indexOf("\n", i);
      const stop = end === -1 ? s.length : end;
      tokens.push({ type: "comment", value: s.slice(i, stop) });
      i = stop;
      continue;
    }

    if (rest.startsWith("/*")) {
      const end = s.indexOf("*/", i + 2);
      const stop = end === -1 ? s.length : end + 2;
      tokens.push({ type: "comment", value: s.slice(i, stop) });
      i = stop;
      continue;
    }

    if (ch === "'") {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === "'" && s[j + 1] === "'") j += 2;
        else if (s[j] === "'") {
          j += 1;
          break;
        } else j += 1;
      }
      tokens.push({ type: "string", value: s.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      const end = s.indexOf('"', i + 1);
      const stop = end === -1 ? s.length : end + 1;
      tokens.push({ type: "ident", value: s.slice(i, stop) });
      i = stop;
      continue;
    }

    if (ch === "$") {
      const m = /^\$\d+/.exec(rest);
      if (m) {
        tokens.push({ type: "param", value: m[0] });
        i += m[0].length;
        continue;
      }
    }

    if (/\d/.test(ch) || (ch === "." && /\d/.test(s[i + 1] ?? ""))) {
      const m = NUM_RE.exec(rest);
      if (m) {
        tokens.push({ type: "number", value: m[0] });
        i += m[0].length;
        continue;
      }
    }

    if (WORD_RE.test(ch)) {
      const m = WORD_RE.exec(rest)!;
      const raw = m[0];
      const lower = raw.toLowerCase();
      const prev = tokens.filter((t) => !(t.type === "punct" && /^\s+$/.test(t.value))).at(-1);
      const nextChar = s[i + raw.length] ?? "";
      if (KEYWORDS.has(lower)) {
        tokens.push({ type: "keyword", value: raw });
      } else if (FUNCTIONS.has(lower) || (nextChar === "(" && !KEYWORDS.has(lower))) {
        tokens.push({ type: "function", value: raw });
      } else if (prev?.type === "punct" && prev.value === "." ) {
        tokens.push({ type: "ident", value: raw });
      } else {
        tokens.push({ type: "ident", value: raw });
      }
      i += raw.length;
      continue;
    }

    const two = s.slice(i, i + 2);
    if (OPERATORS.has(two)) {
      tokens.push({ type: "operator", value: two });
      i += 2;
      continue;
    }
    if (OPERATORS.has(ch)) {
      tokens.push({ type: "operator", value: ch });
      i += 1;
      continue;
    }

    tokens.push({ type: "punct", value: ch });
    i += 1;
  }

  return tokens;
}

export const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: "text-violet-300 font-semibold",
  function: "text-cyan-300",
  string: "text-emerald-300",
  number: "text-amber-300",
  comment: "text-slate-500 italic",
  operator: "text-rose-300",
  ident: "text-slate-200",
  param: "text-sky-300",
  punct: "text-slate-400",
};


/**
 * Lightweight, dependency-free SQL pretty printer.
 * Normalises spacing, then breaks on top-level clauses while tracking
 * parenthesis depth so subqueries indent correctly.
 */
const CLAUSE_WORDS = new Set([
  "select","from","where","having","limit","offset","union","values","set","returning","with",
]);
const SPACE_BEFORE_PAREN = new Set([
  "as","in","and","or","not","exists","values","from","where","on","by","select","then","else","all","any","some",
  "between","like","ilike","using","returning","join","over","filter",
]);
const JOIN_MODIFIERS = new Set(["inner", "left", "right", "full", "cross", "outer", "natural"]);

type PieceKind = "word" | "keyword" | "op" | "open" | "close" | "comma" | "dot" | "string" | "comment" | "num" | "param" | "semi";

interface Piece {
  text: string;
  kind: PieceKind;
  depth: number;
  lower: string;
}

export function formatSql(input: string): string {
  const raw = tokenize(input);
  const pieces: Piece[] = [];
  let depth = 0;
  let clause = "";

  for (const t of raw) {
    if (t.type === "punct" && /^\s*$/.test(t.value)) continue;
    const lower = t.value.toLowerCase();
    if (t.value === "(") {
      pieces.push({ text: "(", kind: "open", depth, lower });
      depth += 1;
      continue;
    }
    if (t.value === ")") {
      depth = Math.max(0, depth - 1);
      pieces.push({ text: ")", kind: "close", depth, lower });
      continue;
    }
    if (t.value === ",") {
      pieces.push({ text: ",", kind: "comma", depth, lower });
      continue;
    }
    if (t.value === ".") {
      pieces.push({ text: ".", kind: "dot", depth, lower });
      continue;
    }
    if (t.value === ";") {
      pieces.push({ text: ";", kind: "semi", depth, lower });
      continue;
    }
    if (t.type === "operator") {
      pieces.push({ text: t.value, kind: "op", depth, lower });
      continue;
    }
    if (t.type === "comment") {
      pieces.push({ text: t.value, kind: "comment", depth, lower });
      continue;
    }
    if (t.type === "string") {
      pieces.push({ text: t.value, kind: "string", depth, lower });
      continue;
    }
    if (t.type === "number") {
      pieces.push({ text: t.value, kind: "num", depth, lower });
      continue;
    }
    if (t.type === "param") {
      pieces.push({ text: t.value, kind: "param", depth, lower });
      continue;
    }
    // GROUP BY / ORDER BY stay together
    if ((lower === "group" || lower === "order")) {
      const ahead = raw.slice(raw.indexOf(t) + 1).find((x) => !(x.type === "punct" && /^\s*$/.test(x.value)));
      if (ahead?.value.toLowerCase() === "by") {
        pieces.push({ text: `${t.value} ${ahead.value}`, kind: "keyword", depth, lower: `${lower} by` });
        const idx = raw.indexOf(ahead, raw.indexOf(t) + 1);
        raw.splice(idx, 1);
        continue;
      }
    }
    pieces.push({ text: t.value, kind: t.type === "keyword" ? "keyword" : "word", depth, lower });
  }

  // ---- assemble lines ----
  const lines: string[] = [];
  let line = "";
  let lineDepth = 0;
  const parenStack: string[] = [];

  const pad = (n: number) => "  ".repeat(Math.max(0, n));
  const lastChar = () => (line ? line[line.length - 1]! : "");
  const lastWord = () => {
    const m = /([A-Za-z_][A-Za-z0-9_]*)$/.exec(line.trimEnd());
    return m ? m[1]!.toLowerCase() : "";
  };

  const flush = () => {
    if (line.trim()) lines.push(pad(lineDepth) + line.replace(/^\s+/, ""));
    line = "";
  };

  const append = (text: string, kind: PieceKind) => {
    const lc = lastChar();
    if (kind === "open") {
      const spaced = line !== "" && lc !== "(" && lc !== "." && SPACE_BEFORE_PAREN.has(lastWord());
      line = `${line.replace(/\s+$/, "")}${spaced ? " " : ""}(`;
      return;
    }
    if (kind === "close" || kind === "comma" || kind === "dot" || kind === "semi") {
      line = `${line.replace(/\s+$/, "")}${text}`;
      return;
    }
    if (!line || lc === "(" || lc === ".") {
      line += text;
      return;
    }
    line = `${line.replace(/\s+$/, "")} ${text}`;
  };

  for (let i = 0; i < pieces.length; i += 1) {
    const p = pieces[i]!;
    const top = p.depth === 0;
    const nextPiece = pieces[i + 1];
    const isClauseStart =
      p.kind === "keyword" &&
      (CLAUSE_WORDS.has(p.lower) ||
        p.lower === "group by" ||
        p.lower === "order by" ||
        p.lower === "insert" ||
        p.lower === "update" ||
        p.lower === "delete" ||
        p.lower === "create");

    const isJoinStart =
      p.kind === "keyword" &&
      (p.lower === "join" || (JOIN_MODIFIERS.has(p.lower) && nextPiece?.lower !== undefined));

    // clause boundary
    if (isClauseStart && (top || (p.depth === 1 && parenStack.at(-1) === "subquery"))) {
      const word = p.lower;
      if (line.trim() && !(word === "select" && line.trim().toUpperCase() === "WITH")) {
        flush();
      }
      lineDepth = p.depth;
      line += p.text;
      if (word === "select" || word === "where" || word === "having" || word === "set" || word === "values" || word === "group by" || word === "order by" || word === "returning") {
        clause = word;
      } else {
        clause = word;
      }
      continue;
    }

    // join boundary
    if (isJoinStart && top) {
      flush();
      lineDepth = 0;
      line += p.text;
      // consume following modifier words / JOIN so "LEFT OUTER JOIN" lands on one line
      let j = i + 1;
      while (j < pieces.length && (pieces[j]!.kind === "keyword" && (JOIN_MODIFIERS.has(pieces[j]!.lower) || pieces[j]!.lower === "join"))) {
        line += ` ${pieces[j]!.text}`;
        j += 1;
      }
      i = j - 1;
      continue;
    }

    // boolean chain indentation at top level
    if (
      (p.lower === "and" || p.lower === "or") &&
      p.kind === "keyword" &&
      (clause === "where" || clause === "having") &&
      (p.depth === 0 || parenStack.at(-1) === "expr")
    ) {
      flush();
      lineDepth = p.depth + 1;
      line += p.text;
      continue;
    }

    // select-list line breaks
    if (p.kind === "comma" && top && clause === "select") {
      line = `${line.trimEnd()},`;
      flush();
      lineDepth = 1;
      continue;
    }

    if (p.kind === "comma" && (p.depth > 0 && parenStack.at(-1) === "subquery" && clause === "select")) {
      line = `${line.trimEnd()},`;
      flush();
      lineDepth = p.depth + 1;
      continue;
    }

    if (p.kind === "comma") {
      line = `${line.trimEnd()},`;
      continue;
    }

    if (p.kind === "open") {
      const next = pieces[i + 1];
      const subquery = next?.lower === "select" || next?.lower === "with";
      append("(", "open");
      parenStack.push(subquery ? "subquery" : "expr");
      if (subquery) {
        flush();
        lineDepth = p.depth + 1;
      }
      continue;
    }

    if (p.kind === "close") {
      if (parenStack.at(-1) === "subquery") {
        flush();
        lineDepth = p.depth;
      }
      while (line.endsWith(" ")) line = line.slice(0, -1);
      line += ")";
      parenStack.pop();
      continue;
    }

    if (p.kind === "comment") {
      if (line.trim() || lineDepth === 0) flush();
      lines.push(pad(lineDepth) + p.text);
      continue;
    }

    if (p.kind === "dot") {
      line = `${line.replace(/\s+$/, "")}.`;
      continue;
    }

    if (p.kind === "semi") {
      line = `${line.replace(/\s+$/, "")};`;
      continue;
    }

    if (p.kind === "op") {
      line = `${line.replace(/\s+$/, "")} ${p.text}`;
      continue;
    }

    // word / keyword / literal
    if (p.kind === "keyword" && (p.lower === "and" || p.lower === "or")) {
      line = `${line.replace(/\s+$/, "")} ${p.text}`;
      continue;
    }
    append(p.text, p.kind);
  }

  flush();

  return lines
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}
