import { aggregateRows, sampleRows, TABLE_BY_NAME, TABLES, type Row } from "../data/schema";

export type AggFn = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export interface SelectField {
  id: string;
  table: string;
  column: string;
  agg: AggFn | null;
  alias: string;
}

export type JoinType = "INNER" | "LEFT" | "RIGHT" | "FULL";

export interface JoinClause {
  id: string;
  type: JoinType;
  table: string;
  left: string;
  right: string;
}

export interface WhereCond {
  id: string;
  conj: "AND" | "OR";
  table: string;
  column: string;
  op: string;
  value: string;
  kind: "text" | "number" | "boolean" | "list" | "null";
}

export interface OrderTerm {
  id: string;
  expr: string;
  dir: "ASC" | "DESC";
}

export interface HavingTerm {
  id: string;
  agg: AggFn;
  column: string;
  op: string;
  value: string;
}

export interface CteConfig {
  enabled: boolean;
  name: string;
  filter: string;
}

export interface QueryState {
  baseTable: string;
  distinct: boolean;
  selectFields: SelectField[];
  joins: JoinClause[];
  wheres: WhereCond[];
  groupBy: string[];
  having: HavingTerm[];
  orderBy: OrderTerm[];
  limit: number | null;
  cte: CteConfig;
}

let seq = 0;
export const uid = (prefix = "n") => `${prefix}-${Date.now().toString(36)}-${(seq += 1).toString(36)}`;

const COL = (table: string, column: string) => `${table}.${column}`;
const splitCol = (ref: string): [string, string] => {
  const [t, c] = ref.split(".");
  return [t ?? "", c ?? ""];
};

export function columnTypeOf(ref: string): string | undefined {
  const [t, c] = splitCol(ref);
  return TABLE_BY_NAME[t]?.columns.find((col) => col.name === c)?.type;
}

export type IndexSet = Set<string>;

export function isIndexed(ref: string, extra?: IndexSet): boolean {
  if (extra?.has(ref)) return true;
  const [t, c] = splitCol(ref);
  const table = TABLE_BY_NAME[t];
  if (!table) return false;
  return table.columns.find((col) => col.name === c)?.indexed === true;
}

export const DEFAULT_QUERY: QueryState = {
  baseTable: "orders",
  distinct: false,
  selectFields: [
    { id: "sf-1", table: "orders", column: "id", agg: null, alias: "" },
    { id: "sf-2", table: "orders", column: "status", agg: null, alias: "" },
    { id: "sf-3", table: "orders", column: "total", agg: null, alias: "" },
  ],
  joins: [
    {
      id: "jn-1",
      type: "INNER",
      table: "users",
      left: COL("orders", "user_id"),
      right: COL("users", "id"),
    },
  ],
  wheres: [
    {
      id: "wh-1",
      conj: "AND",
      table: "orders",
      column: "status",
      op: "=",
      value: "paid",
      kind: "text",
    },
  ],
  groupBy: [],
  having: [],
  orderBy: [{ id: "ob-1", expr: COL("orders", "total"), dir: "DESC" }],
  limit: 50,
  cte: { enabled: false, name: "recent_orders", filter: "placed_at > now() - interval '30 days'" },
};

export const SAMPLE_QUERIES: { name: string; description: string; state: QueryState }[] = [
  {
    name: "Revenue by status",
    description: "Aggregate paid orders per status with a hash join on users.",
    state: {
      ...DEFAULT_QUERY,
      distinct: false,
      selectFields: [
        { id: uid("sf"), table: "orders", column: "status", agg: null, alias: "" },
        { id: uid("sf"), table: "orders", column: "total", agg: "SUM", alias: "revenue" },
        { id: uid("sf"), table: "orders", column: "id", agg: "COUNT", alias: "order_count" },
      ],
      groupBy: [COL("orders", "status")],
      orderBy: [{ id: uid("ob"), expr: "revenue", dir: "DESC" }],
      limit: null,
      wheres: [],
    },
  },
  {
    name: "Top customers",
    description: "Join users with their paid orders and rank by lifetime spend.",
    state: {
      ...DEFAULT_QUERY,
      selectFields: [
        { id: uid("sf"), table: "users", column: "full_name", agg: null, alias: "" },
        { id: uid("sf"), table: "users", column: "plan", agg: null, alias: "" },
        { id: uid("sf"), table: "orders", column: "total", agg: "SUM", alias: "lifetime_value" },
      ],
      joins: [
        { id: uid("jn"), type: "INNER", table: "users", left: COL("orders", "user_id"), right: COL("users", "id") },
      ],
      wheres: [
        { id: uid("wh"), conj: "AND", table: "orders", column: "status", op: "=", value: "paid", kind: "text" },
      ],
      groupBy: [COL("users", "full_name"), COL("users", "plan")],
      having: [{ id: uid("hv"), agg: "SUM", column: COL("orders", "total"), op: ">", value: "5000" }],
      orderBy: [{ id: uid("ob"), expr: "lifetime_value", dir: "DESC" }],
      limit: 25,
    },
  },
  {
    name: "Failed transactions",
    description: "Scan the transactions ledger for declined payments in the last quarter.",
    state: {
      baseTable: "transactions",
      distinct: false,
      selectFields: [
        { id: uid("sf"), table: "transactions", column: "id", agg: null, alias: "" },
        { id: uid("sf"), table: "transactions", column: "amount", agg: null, alias: "" },
        { id: uid("sf"), table: "transactions", column: "method", agg: null, alias: "" },
        { id: uid("sf"), table: "transactions", column: "processed_at", agg: null, alias: "" },
      ],
      joins: [
        { id: uid("jn"), type: "LEFT", table: "orders", left: COL("transactions", "order_id"), right: COL("orders", "id") },
      ],
      wheres: [
        { id: uid("wh"), conj: "AND", table: "transactions", column: "succeeded", op: "=", value: "false", kind: "boolean" },
      ],
      groupBy: [],
      having: [],
      orderBy: [{ id: uid("ob"), expr: COL("transactions", "amount"), dir: "DESC" }],
      limit: 100,
      cte: { enabled: true, name: "declined_tx", filter: "succeeded = false" },
    },
  },
  {
    name: "Catalog deep dive",
    description: "Inspect products joined to transactions with a JSONB filter.",
    state: {
      baseTable: "products",
      distinct: true,
      selectFields: [
        { id: uid("sf"), table: "products", column: "name", agg: null, alias: "" },
        { id: uid("sf"), table: "products", column: "category", agg: null, alias: "" },
        { id: uid("sf"), table: "transactions", column: "amount", agg: "AVG", alias: "avg_ticket" },
      ],
      joins: [
        { id: uid("jn"), type: "INNER", table: "transactions", left: COL("products", "id"), right: COL("transactions", "product_id") },
      ],
      wheres: [
        { id: uid("wh"), conj: "AND", table: "products", column: "in_stock", op: "=", value: "true", kind: "boolean" },
      ],
      groupBy: [COL("products", "name"), COL("products", "category")],
      having: [],
      orderBy: [{ id: uid("ob"), expr: "avg_ticket", dir: "DESC" }],
      limit: 20,
      cte: { enabled: false, name: "recent_orders", filter: "" },
    },
  },
];

/* ------------------------------------------------------------------ */
/* SQL generation                                                      */
/* ------------------------------------------------------------------ */

export function quoteLiteral(cond: WhereCond): string {
  if (cond.kind === "null") return "NULL";
  if (cond.kind === "list") {
    const parts = cond.value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => (/^-?\d+(\.\d+)?$/.test(v) ? v : `'${v.replace(/'/g, "''")}'`));
    return `(${parts.length ? parts.join(", ") : "''"})`;
  }
  if (cond.kind === "number") return cond.value.trim() || "0";
  if (cond.kind === "boolean") return cond.value === "true" ? "true" : "false";
  if (cond.op === "IN") return `('${cond.value}')`;
  return `'${cond.value.replace(/'/g, "''")}'`;
}

export function selectExpression(field: SelectField): string {
  const base = field.column === "*" ? "*" : COL(field.table, field.column);
  const expr = field.agg ? `${field.agg}(${base})` : base;
  return field.alias.trim() ? `${expr} AS ${field.alias.trim()}` : expr;
}

export function aliasOf(ref: string): string {
  const [, c] = splitCol(ref);
  return c || ref;
}

export function buildSql(q: QueryState, pretty = true): string {
  const nl = pretty ? "\n" : " ";
  const from = q.cte.enabled ? q.cte.name : q.baseTable;
  const lines: string[] = [];

  const selectList = q.selectFields.length
    ? q.selectFields.map((f) => `  ${selectExpression(f)}`)
    : ["  *"];

  const selectBody: string[] = [];
  selectBody.push(`SELECT ${q.distinct ? "DISTINCT " : ""}`);
  selectBody.push(selectList.join(`,${nl}`));
  selectBody.push(`FROM ${from}`);

  q.joins.forEach((j) => {
    selectBody.push(`${j.type} JOIN ${j.table} ON ${j.left} = ${j.right}`);
  });

  if (q.wheres.length) {
    const whereLines = q.wheres.map(
      (w, i) => `  ${i === 0 ? "" : `${w.conj} `}${COL(w.table, w.column)} ${w.op} ${quoteLiteral(w)}`,
    );
    selectBody.push(`WHERE${nl}${whereLines.join(nl)}`);
  }

  if (q.groupBy.length) {
    selectBody.push(`GROUP BY ${q.groupBy.join(", ")}`);
  }

  if (q.having.length) {
    selectBody.push(
      `HAVING${nl}${q.having
        .map((h, i) => `  ${i === 0 ? "" : "AND "}${h.agg}(${h.column}) ${h.op} ${h.value}`)
        .join(nl)}`,
    );
  }

  if (q.orderBy.length) {
    selectBody.push(`ORDER BY ${q.orderBy.map((o) => `${o.expr} ${o.dir}`).join(", ")}`);
  }

  if (q.limit && q.limit > 0) selectBody.push(`LIMIT ${q.limit}`);

  if (q.cte.enabled) {
    lines.push(`WITH ${q.cte.name} AS (`);
    lines.push(`  SELECT *`);
    lines.push(`  FROM ${q.baseTable}`);
    if (q.cte.filter.trim()) {
      lines.push(`  WHERE ${q.cte.filter.trim()}`);
    }
    lines.push(`)`);
    lines.push(selectBody.join(nl));
  } else {
    lines.push(selectBody.join(nl));
  }

  return lines.join(nl) + ";";
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export interface Problem {
  severity: "error" | "warning" | "info";
  message: string;
  hint?: string;
}

export function validateQuery(q: QueryState): Problem[] {
  const problems: Problem[] = [];
  const available = new Set([q.baseTable, ...q.joins.map((j) => j.table)]);

  if (!q.selectFields.length) {
    problems.push({ severity: "error", message: "SELECT list is empty", hint: "Add at least one column to project." });
  }

  q.selectFields.forEach((f) => {
    if (!available.has(f.table)) {
      problems.push({
        severity: "error",
        message: `Unknown table alias "${f.table}" in select list`,
        hint: "Add the table to FROM / JOIN or remove the column.",
      });
    }
  });

  q.joins.forEach((j) => {
    if (!TABLE_BY_NAME[j.table]) {
      problems.push({ severity: "error", message: `Unknown relation "${j.table}" in JOIN` });
    }
    if (!j.left || !j.right) {
      problems.push({ severity: "error", message: `JOIN on ${j.table} is missing a predicate`, hint: "Set both sides of the ON clause." });
    }
  });

  const hasAgg = q.selectFields.some((f) => f.agg);
  const nonAgg = q.selectFields.filter((f) => !f.agg && f.column !== "*");
  if (hasAgg && q.groupBy.length === 0 && nonAgg.length > 0) {
    problems.push({
      severity: "error",
      message: "Column must appear in the GROUP BY clause or be used in an aggregate function",
      hint: `Add ${nonAgg.map((f) => COL(f.table, f.column)).join(", ")} to GROUP BY.`,
    });
  }
  if (hasAgg && q.groupBy.length > 0) {
    const missing = nonAgg.filter((f) => !q.groupBy.includes(COL(f.table, f.column)));
    if (missing.length) {
      problems.push({
        severity: "error",
        message: "GROUP BY is missing a projected column",
        hint: `Add ${missing.map((f) => COL(f.table, f.column)).join(", ")} to GROUP BY.`,
      });
    }
  }
  if (!hasAgg && q.groupBy.length) {
    problems.push({ severity: "warning", message: "GROUP BY has no aggregate in the select list" });
  }
  if (q.having.length && !hasAgg) {
    problems.push({ severity: "warning", message: "HAVING without aggregates behaves like WHERE — consider MOVING it." });
  }
  if (q.limit === null && !hasAgg) {
    problems.push({ severity: "info", message: "No LIMIT — unbounded scans may return a large result set" });
  }
  q.wheres.forEach((w) => {
    if (w.op !== "IS NULL" && w.op !== "IS NOT NULL" && !w.value.trim()) {
      problems.push({ severity: "error", message: `Filter on ${COL(w.table, w.column)} has an empty value` });
    }
    if (w.op === "IN" && w.kind !== "list") {
      problems.push({ severity: "info", message: "IN works best with a comma separated list" });
    }
  });

  return problems;
}

/** Validates a raw SQL string against the sample schema. */
export function lintSql(sql: string): Problem[] {
  const problems: Problem[] = [];
  const trimmed = sql.trim();
  if (!trimmed) return [{ severity: "error", message: "Empty statement", hint: "Write a SELECT statement or load a sample query." }];

  const openParens = (trimmed.match(/\(/g) ?? []).length;
  const closeParens = (trimmed.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    problems.push({ severity: "error", message: `Unbalanced parentheses (${openParens} open, ${closeParens} close)` });
  }
  if ((trimmed.match(/'/g) ?? []).length % 2 !== 0) {
    problems.push({ severity: "error", message: "Unterminated string literal", hint: "Escape quotes by doubling them: '' " });
  }
  if (!/\bselect\b/i.test(trimmed)) {
    problems.push({ severity: "error", message: "Statement must contain SELECT", hint: "This simulator supports read-only SELECT queries." });
  }
  if (!/\bfrom\b/i.test(trimmed)) {
    problems.push({ severity: "error", message: "Missing FROM clause" });
  }

  const cteNames = new Set(
    [...trimmed.matchAll(/\bwith\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((m) => m[1]!.toLowerCase()),
  );

  const referencedTables = new Set<string>();
  for (const m of trimmed.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_]*)/gi)) {
    const name = m[1]!.toLowerCase();
    if (!TABLE_BY_NAME[name] && !cteNames.has(name)) {
      problems.push({ severity: "error", message: `relation "${name}" does not exist`, hint: `Available: ${TABLES.map((t) => t.name).join(", ")}.` });
    } else {
      referencedTables.add(name);
    }
  }

  // column references like table.column
  for (const m of trimmed.matchAll(/\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi)) {
    const [, t, c] = m;
    const table = TABLE_BY_NAME[t!.toLowerCase()];
    if (!table) continue;
    if (!table.columns.some((col) => col.name === c!.toLowerCase())) {
      problems.push({ severity: "error", message: `column ${t}.${c} does not exist` });
    }
  }

  if (/\bupdate\b\s|\bdelete\b\s+from\b|\bdrop\b\s/i.test(trimmed)) {
    problems.push({ severity: "warning", message: "Destructive statement detected — simulator runs read-only." });
  }
  if (/\bselect\s+\*\s+from\s+/i.test(trimmed)) {
    problems.push({ severity: "info", message: "SELECT * forces a full row fetch; project only the columns you need." });
  }
  if (/\border by\b/i.test(trimmed) && !/\blimit\b/i.test(trimmed)) {
    problems.push({ severity: "info", message: "ORDER BY without LIMIT sorts the whole result set." });
  }
  if (/\blike\s+'%/i.test(trimmed)) {
    problems.push({ severity: "warning", message: "Leading wildcard LIKE cannot use a B-tree index." });
  }
  if (!problems.some((p) => p.severity === "error")) {
    problems.push({ severity: "info", message: `Plan cache warm — ${referencedTables.size} relation(s) resolved.` });
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* Execution planning                                                  */
/* ------------------------------------------------------------------ */

export type PlanKind =
  | "Seq Scan"
  | "Index Scan"
  | "Index Only Scan"
  | "Hash Join"
  | "Nested Loop"
  | "Merge Join"
  | "HashAggregate"
  | "GroupAggregate"
  | "Sort"
  | "Limit"
  | "CTE Scan"
  | "Materialize";

export interface PlanNode {
  id: string;
  kind: PlanKind;
  target: string;
  detail: string;
  rows: number;
  width: number;
  startup: number;
  total: number;
  actualMs: number;
  hot?: "fast" | "warn" | "slow";
  children: PlanNode[];
}

const OPS_SELECTIVITY: Record<string, number> = {
  "=": 0.012,
  ">": 0.3,
  "<": 0.3,
  ">=": 0.34,
  "<=": 0.34,
  "<>": 0.9,
  "!=": 0.9,
  LIKE: 0.06,
  ILIKE: 0.06,
  IN: 0.08,
  "IS NULL": 0.02,
  "IS NOT NULL": 0.98,
};

export interface PlanResult {
  root: PlanNode;
  totalCost: number;
  estimatedMs: number;
  scannedRows: number;
  nodes: PlanNode[];
  usesSeqScan: boolean;
  indexHits: string[];
  indexMisses: string[];
}

export function buildPlan(q: QueryState, extraIndexes?: IndexSet): PlanResult {
  const baseTable = TABLE_BY_NAME[q.baseTable]!;
  const sources = [
    { table: q.baseTable, rows: baseTable.rows, width: baseTable.columns.length * 8 },
    ...q.joins.map((j) => {
      const t = TABLE_BY_NAME[j.table]!;
      return { table: j.table, rows: t.rows, width: t.columns.length * 8 };
    }),
  ];

  const indexHits: string[] = [];
  const indexMisses: string[] = [];
  let usesSeqScan = false;

  const scanFor = (table: string, rows: number, width: number): PlanNode => {
    const filters = q.wheres.filter((w) => w.table === table);
    let selectivity = 1;
    filters.forEach((f) => {
      const sel = OPS_SELECTIVITY[f.op] ?? 0.2;
      selectivity *= f.conj === "OR" ? Math.min(0.95, sel + 0.35) : sel;
      const ref = COL(f.table, f.column);
      if (!isIndexed(ref, extraIndexes)) indexMisses.push(ref);
    });
    const filtered = Math.max(1, Math.round(rows * selectivity));
    const canIndex = filters.some(
      (f) => isIndexed(COL(f.table, f.column), extraIndexes) && (f.op === "=" || f.op === ">" || f.op === "<"),
    );
    const kind: PlanKind = canIndex ? "Index Scan" : "Seq Scan";
    if (canIndex) {
      filters
        .filter((f) => isIndexed(COL(f.table, f.column), extraIndexes))
        .forEach((f) => indexHits.push(COL(f.table, f.column)));
    } else if (filters.length === 0) {
      usesSeqScan = true;
    } else {
      usesSeqScan = true;
    }
    const pages = Math.max(8, Math.round(rows / 90));
    const total = canIndex ? 2.4 + filtered * 0.0018 : pages * 0.85 + rows * 0.0009;
    const actualMs = canIndex ? 0.6 + filtered * 0.00012 : pages * 0.021 + rows * 0.00003;
    const cond = filters.map((f) => `${f.table}.${f.column} ${f.op} ${quoteLiteral(f)}`).join(" AND ");
    return {
      id: uid("plan"),
      kind,
      target: `on ${table}`,
      detail: cond ? `Filter: ${cond}` : `Sequential read of all ${rows.toLocaleString()} rows`,
      rows: filtered,
      width,
      startup: canIndex ? 0.3 : 0,
      total: Number(total.toFixed(2)),
      actualMs: Number(actualMs.toFixed(2)),
      hot: canIndex ? (actualMs < 1.2 ? "fast" : "warn") : actualMs < 3 ? "warn" : "slow",
      children: [],
    };
  };

  const scans = sources.map((s) => scanFor(s.table, s.rows, s.width));
  let root = scans[0]!;

  // joins
  q.joins.forEach((j, idx) => {
    const right = scans[idx + 1]!;
    const rightTable = TABLE_BY_NAME[j.table]!;
    const joinIndexed = isIndexed(j.left, extraIndexes) || isIndexed(j.right, extraIndexes);
    const smallTable = rightTable.rows < 5000;
    const kind: PlanKind = !joinIndexed ? "Nested Loop" : smallTable ? "Merge Join" : "Hash Join";
    const rows = Math.max(1, Math.round(Math.sqrt(root.rows * right.rows) * (joinIndexed ? 0.55 : 0.95)));
    const total = kind === "Hash Join" ? right.rows * 0.011 + 24 : kind === "Merge Join" ? root.rows * 0.008 + 12 : root.rows * right.rows * 0.00004;
    const actualMs = kind === "Hash Join" ? 1.8 + right.rows * 0.00012 : kind === "Merge Join" ? 1.1 + root.rows * 0.00008 : 4.4 + root.rows * 0.0004;
    const hot: PlanNode["hot"] = kind === "Nested Loop" ? "slow" : joinIndexed ? "fast" : "warn";
    if (!joinIndexed) indexMisses.push(j.left, j.right);
    root = {
      id: uid("plan"),
      kind,
      target: `with ${j.table}`,
      detail: `Join Filter: ${j.left} = ${j.right}`,
      rows,
      width: root.width + right.width,
      startup: Number((total * 0.6).toFixed(2)),
      total: Number(total.toFixed(2)),
      actualMs: Number(actualMs.toFixed(2)),
      hot,
      children: [root, right],
    };
  });

  const hasAgg = q.selectFields.some((f) => f.agg) || q.groupBy.length > 0;
  if (hasAgg) {
    const grouped = q.groupBy.length ? Math.max(2, Math.round(root.rows * 0.02)) : 1;
    root = {
      id: uid("plan"),
      kind: q.groupBy.length ? "GroupAggregate" : "HashAggregate",
      target: q.groupBy.length ? `by ${q.groupBy.map(aliasOf).join(", ")}` : "single bucket",
      detail: `Output: ${q.selectFields.filter((f) => f.agg).map((f) => `${f.agg}(${f.table}.${f.column})`).join(", ") || "count"}`,
      rows: grouped,
      width: root.width,
      startup: Number((root.total * 0.7).toFixed(2)),
      total: Number((root.total * 1.35).toFixed(2)),
      actualMs: Number((root.actualMs + grouped * 0.012).toFixed(2)),
      hot: "fast",
      children: [root],
    };
  }

  if (q.orderBy.length) {
    const firstSort = q.orderBy[0]!;
    const sortIndexed =
      firstSort.expr.includes(".") && isIndexed(firstSort.expr, extraIndexes) && !hasAgg;
    root = {
      id: uid("plan"),
      kind: "Sort",
      target: `by ${q.orderBy.map((o) => `${o.expr} ${o.dir}`).join(", ")}`,
      detail: sortIndexed
        ? `Incremental Sort — index on ${firstSort.expr} already provides the ordering (presorted_keys=1)`
        : "Sort Method: quicksort  Memory: 1024kB  ·  external merge required above 4MB",
      rows: root.rows,
      width: root.width,
      startup: Number((root.total * (sortIndexed ? 1.05 : 1.4)).toFixed(2)),
      total: Number((root.total * (sortIndexed ? 1.08 : 1.9)).toFixed(2)),
      actualMs: Number(
        (
          root.actualMs +
          (sortIndexed
            ? Math.max(0.08, root.rows / 40000)
            : Math.max(0.4, (root.rows * Math.log2(root.rows || 2)) / 6000))
        ).toFixed(2),
      ),
      hot: sortIndexed ? "fast" : "warn",
      children: [root],
    };
  }

  if (q.cte.enabled) {
    root = {
      id: uid("plan"),
      kind: "CTE Scan",
      target: `on ${q.cte.name}`,
      detail: `Inlined CTE — ${q.cte.filter || "no filter"}`,
      rows: root.rows,
      width: root.width,
      startup: 0,
      total: Number((root.total * 1.05).toFixed(2)),
      actualMs: Number((root.actualMs + 0.15).toFixed(2)),
      hot: "fast",
      children: [root],
    };
  }

  if (q.limit) {
    root = {
      id: uid("plan"),
      kind: "Limit",
      target: `first ${q.limit} rows`,
      detail: "Execution stops early once the row budget is met",
      rows: Math.min(q.limit, root.rows),
      width: root.width,
      startup: 0,
      total: Number((root.total * 0.98).toFixed(2)),
      actualMs: Number((root.actualMs * 0.92).toFixed(2)),
      hot: "fast",
      children: [root],
    };
  }

  const nodes: PlanNode[] = [];
  const walk = (n: PlanNode) => {
    nodes.push(n);
    n.children.forEach(walk);
  };
  walk(root);

  return {
    root,
    totalCost: root.total,
    estimatedMs: Number(root.actualMs.toFixed(2)),
    scannedRows: sources.reduce((a, s) => a + s.rows, 0),
    nodes,
    usesSeqScan,
    indexHits,
    indexMisses: [...new Set(indexMisses)],
  };
}

/* ------------------------------------------------------------------ */
/* Index advisor                                                       */
/* ------------------------------------------------------------------ */

export interface IndexSuggestion {
  id: string;
  table: string;
  columns: string[];
  ddl: string;
  reason: string;
  gain: number;
  impact: "high" | "medium" | "low";
  scanBefore: string;
  scanAfter: string;
}

export function suggestIndexes(q: QueryState, plan: PlanResult, extraIndexes?: IndexSet): IndexSuggestion[] {
  const suggestions: IndexSuggestion[] = [];
  const covered = (table: string, column: string) =>
    extraIndexes?.has(`${table}.${column}`) ||
    (TABLE_BY_NAME[table]?.indexes.some((idx) => idx.columns[0] === column) ?? false);

  q.wheres.forEach((w) => {
    if (covered(w.table, w.column)) return;
    const table = TABLE_BY_NAME[w.table];
    if (!table) return;
    suggestions.push({
      id: uid("idx"),
      table: w.table,
      columns: [w.column],
      ddl: `CREATE INDEX CONCURRENTLY idx_${w.table}_${w.column}\n  ON ${w.table} USING btree (${w.column});`,
      reason: `Filter predicate on ${w.table}.${w.column} currently falls back to a sequential scan.`,
      gain: w.op === "=" ? 0.86 : 0.52,
      impact: w.op === "=" ? "high" : "medium",
      scanBefore: `Seq Scan · ${table.rows.toLocaleString()} rows`,
      scanAfter: `Index Scan · ~${Math.max(1, Math.round(table.rows * 0.012)).toLocaleString()} rows`,
    });
  });

  q.orderBy.forEach((o) => {
    const [table, column] = splitCol(o.expr);
    if (!TABLE_BY_NAME[table] || !column || covered(table, column)) return;
    suggestions.push({
      id: uid("idx"),
      table,
      columns: [column],
      ddl: `CREATE INDEX CONCURRENTLY idx_${table}_${column}_sort\n  ON ${table} USING btree (${column} ${o.dir});`,
      reason: `ORDER BY ${o.expr} ${o.dir} forces an explicit Sort node over the joined set.`,
      gain: 0.34,
      impact: "medium",
      scanBefore: "Sort · quicksort in memory",
      scanAfter: "Incremental Sort · index ordered",
    });
  });

  q.joins.forEach((j) => {
    const [table, column] = splitCol(j.left);
    const [rTable, rColumn] = splitCol(j.right);
    [([table, column, rTable, rColumn] as const), ([rTable, rColumn, table, column] as const)].forEach(
      ([t, c, ot, oc]) => {
        if (!t || !c || covered(t, c)) return;
        if (suggestions.some((s) => s.table === t && s.columns[0] === c)) return;
        suggestions.push({
          id: uid("idx"),
          table: t,
          columns: [c],
          ddl: `CREATE INDEX CONCURRENTLY idx_${t}_${c}_fk\n  ON ${t} USING btree (${c});`,
          reason: `Foreign key ${t}.${c} → ${ot}.${oc} is not indexed; the planner must hash or loop.`,
          gain: 0.61,
          impact: "high",
          scanBefore: "Nested Loop · repeated inner scan",
          scanAfter: "Index Scan · memoised lookups",
        });
      },
    );
  });

  if (plan.indexMisses.length === 0 && suggestions.length === 0) {
    suggestions.push({
      id: uid("idx"),
      table: q.baseTable,
      columns: ["status", "placed_at"],
      ddl: `CREATE INDEX CONCURRENTLY idx_${q.baseTable}_status_placed_at\n  ON ${q.baseTable} USING btree (status, placed_at DESC);`,
      reason: "Composite index can serve the status filter and the recency ordering in one pass.",
      gain: 0.24,
      impact: "low",
      scanBefore: "Index Scan + Sort",
      scanAfter: "Index Only Scan · covering",
    });
  }

  return suggestions.slice(0, 4);
}

/* ------------------------------------------------------------------ */
/* Execution simulation                                                */
/* ------------------------------------------------------------------ */

export interface ExecutionResult {
  columns: string[];
  rows: Row[];
  rowCount: number;
  latencyMs: number;
  rowsAffected: number;
  plan: PlanResult;
  problems: Problem[];
  cacheHit: boolean;
  bytes: number;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runQuery(
  q: QueryState,
  opts: { cached?: boolean; extraIndexes?: IndexSet } = {},
): Promise<ExecutionResult> {
  const problems = validateQuery(q);
  const plan = buildPlan(q, opts.extraIndexes);
  const hasError = problems.some((p) => p.severity === "error");

  await sleep(opts.cached ? 120 : 420 + Math.random() * 380);

  if (hasError) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      latencyMs: 0,
      rowsAffected: 0,
      plan,
      problems,
      cacheHit: false,
      bytes: 0,
      error: problems.find((p) => p.severity === "error")?.message ?? "Syntax error",
    };
  }

  const aggs = q.selectFields.filter((f) => f.agg);
  let rows: Row[] = [];
  let columns: string[] = [];

  if (aggs.length) {
    rows = aggregateRows(
      { groupBy: q.groupBy, measures: aggs.map((a) => ({ metric: a.agg!, column: COL(a.table, a.column) })) },
      q.limit ?? 12,
    );
    columns = rows.length ? Object.keys(rows[0]!) : q.selectFields.map((f) => f.alias || `${f.agg}_${f.column}`);
  } else {
    const projected = q.selectFields.filter((f) => f.column !== "*");
    const star = q.selectFields.find((f) => f.column === "*");
    const base = sampleRows(q.baseTable, Math.min(q.limit ?? 12, 12));
    const sideTables = [...new Set(projected.map((f) => f.table).filter((t) => t !== q.baseTable))];
    const sideRows = Object.fromEntries(sideTables.map((t) => [t, sampleRows(t, base.length)]));

    rows = base.map((r, i) => {
      const out: Row = {};
      if (star) Object.assign(out, r);
      projected.forEach((f) => {
        const source = f.table === q.baseTable ? r : sideRows[f.table]?.[i % (sideRows[f.table]?.length ?? 1)];
        out[f.alias.trim() || f.column] = (source?.[f.column] as Row[string]) ?? null;
      });
      return out;
    });
    columns = rows.length ? Object.keys(rows[0]!) : projected.map((f) => f.alias.trim() || f.column);
  }

  const rowCount = rows.length;
  const latency = Math.max(0.4, plan.estimatedMs * (opts.cached ? 0.62 : 1));
  const bytes = rowCount * Math.max(1, columns.length) * 24;

  return {
    columns,
    rows,
    rowCount,
    latencyMs: Number(latency.toFixed(1)),
    rowsAffected: 0,
    plan,
    problems,
    cacheHit: !!opts.cached,
    bytes,
  };
}

/** Executes an arbitrary SQL string against the simulator. */
export async function runRawSql(sql: string, cached = false): Promise<ExecutionResult> {
  const problems = lintSql(sql);
  const lower = sql.toLowerCase();
  const tableMatch = /\bfrom\s+([a-z_][a-z0-9_]*)/i.exec(sql);
  const table = tableMatch?.[1]?.toLowerCase();
  const known = table && TABLE_BY_NAME[table] ? table : "orders";
  const plan = buildPlan({
    ...DEFAULT_QUERY,
    baseTable: known,
    joins: [],
    selectFields: [{ id: "sf", table: known, column: "*", agg: null, alias: "" }],
    wheres: [],
    groupBy: [],
    having: [],
    orderBy: [],
    limit: null,
    cte: { enabled: false, name: "", filter: "" },
  });

  await sleep(cached ? 140 : 520 + Math.random() * 420);

  if (problems.some((p) => p.severity === "error")) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      latencyMs: 0,
      rowsAffected: 0,
      plan,
      problems,
      cacheHit: false,
      bytes: 0,
      error: problems.find((p) => p.severity === "error")?.message,
    };
  }

  const rows = sampleRows(known, 10);
  const columns = rows.length ? Object.keys(rows[0]!) : [];

  return {
    columns,
    rows,
    rowCount: rows.length,
    latencyMs: Number((plan.estimatedMs * (cached ? 0.6 : 1.1)).toFixed(1)),
    rowsAffected: 0,
    plan,
    problems,
    cacheHit: cached,
    bytes: rows.length * columns.length * 24,
    ...(/limit\s+0\b/i.test(lower) ? { rows: [], rowCount: 0, columns } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Light SQL -> builder parser (best effort)                           */
/* ------------------------------------------------------------------ */

const stripComments = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/;\s*$/, " ")
    .replace(/\s+/g, " ")
    .trim();

function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote = false;
  let current = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (ch === "'") quote = !quote;
    if (!quote) {
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (depth === 0 && input.slice(i, i + sep.length).toLowerCase() === sep) {
        out.push(current.trim());
        current = "";
        i += sep.length - 1;
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function parseSqlToQuery(sqlInput: string): QueryState | null {
  let sql = stripComments(sqlInput);
  if (!sql) return null;

  // unwrap a leading CTE
  let cte: CteConfig = { enabled: false, name: "recent_orders", filter: "" };
  let cteSourceTable = "";
  const cteMatch = /^with\s+([a-z_][a-z0-9_]*)\s+as\s*\(([\s\S]*?)\)\s*(select[\s\S]*)$/i.exec(sql);
  if (cteMatch) {
    const [, name, body, rest] = cteMatch;
    const bodyTable = /\bfrom\s+([a-z_][a-z0-9_]*)/i.exec(body!)?.[1];
    if (bodyTable) cteSourceTable = bodyTable.toLowerCase();
    const filter = /\bwhere\s+([\s\S]*)$/i.exec(body!)?.[1]?.trim() ?? "";
    cte = { enabled: true, name: name!.toLowerCase(), filter };
    sql = rest!.trim();
    if (!/\bfrom\s+/i.test(sql) && bodyTable) sql = `SELECT * FROM ${bodyTable}`;
  }

  const fromMatch = /\bfrom\s+([a-z_][a-z0-9_]*)(?:\s+(?:as\s+)?([a-z_][a-z0-9_]*))?/i.exec(sql);
  if (!fromMatch) return null;
  let baseTable = fromMatch[1]!.toLowerCase();
  if (!TABLE_BY_NAME[baseTable] && cte.enabled && baseTable === cte.name && TABLE_BY_NAME[cteSourceTable]) {
    baseTable = cteSourceTable;
  }
  if (!TABLE_BY_NAME[baseTable]) return null;

  const selectPart = /select\s+(distinct\s+)?([\s\S]*?)\s+from\s/i.exec(sql);
  if (!selectPart) return null;
  const distinct = !!selectPart[1];
  const rawFields = splitTopLevel(selectPart[2]!, ",");

  const parseRef = (raw: string, fallback: string): { table: string; column: string } => {
    const cleaned = raw.trim().replace(/^\(|\)$/g, "");
    if (cleaned.includes(".")) {
      const [t, c] = cleaned.split(".");
      const table = (t ?? fallback).replace(/["`]/g, "");
      return { table: TABLE_BY_NAME[table] ? table : fallback, column: (c ?? "*").replace(/["`]/g, "") };
    }
    const column = cleaned.replace(/["`]/g, "") || "*";
    return { table: fallback, column };
  };

  const selectFields: SelectField[] = [];
  rawFields.forEach((raw, i) => {
    const m = /^([a-z_][a-z0-9_]*)\(\s*(distinct\s+)?([^)]*)\)\s*(?:as\s+([a-z_][a-z0-9_]*))?$/i.exec(raw.trim());
    if (m && ["count", "sum", "avg", "min", "max"].includes(m[1]!.toLowerCase())) {
      const ref = parseRef(m[3]!.trim(), baseTable);
      selectFields.push({
        id: `sf-p-${i}`,
        table: TABLE_BY_NAME[ref.table] ? ref.table : baseTable,
        column: ref.column,
        agg: m[1]!.toUpperCase() as AggFn,
        alias: m[4] ?? "",
      });
      return;
    }
    const aliasMatch = /^([\s\S]+?)\s+as\s+([a-z_][a-z0-9_]*)$/i.exec(raw.trim());
    const expr = aliasMatch ? aliasMatch[1]! : raw;
    const ref = parseRef(expr, baseTable);
    selectFields.push({
      id: `sf-p-${i}`,
      table: TABLE_BY_NAME[ref.table] ? ref.table : baseTable,
      column: ref.column,
      agg: null,
      alias: aliasMatch ? aliasMatch[2]! : "",
    });
  });

  const joins: JoinClause[] = [];
  for (const m of sql.matchAll(/(inner|left|right|full)?\s*(?:outer\s+)?join\s+([a-z_][a-z0-9_]*)\s+(?:as\s+)?[a-z_]*\s*on\s+([a-z_][a-z0-9_.]*)\s*=\s*([a-z_][a-z0-9_.]*)/gi)) {
    const table = m[2]!.toLowerCase();
    if (!TABLE_BY_NAME[table]) continue;
    joins.push({
      id: `jn-p-${joins.length}`,
      type: ((m[1]?.toUpperCase() as JoinType) ?? "INNER") as JoinType,
      table,
      left: m[3]!,
      right: m[4]!,
    });
  }

  const wheres: WhereCond[] = [];
  const wherePart = /\bwhere\s+([\s\S]*?)(?=\bgroup\s+by\b|\bhaving\b|\border\s+by\b|\blimit\b|$)/i.exec(sql)?.[1];
  if (wherePart) {
    splitTopLevel(wherePart, " and ").forEach((chunk, i) => {
      const orParts = splitTopLevel(chunk, " or ");
      orParts.forEach((piece, oi) => {
        const m = /^\(?\s*([a-z_][a-z0-9_.]*)\s*(=|<>|!=|>=|<=|>|<|like|ilike|in|is\s+not\s+null|is\s+null)\s*([\s\S]*?)\)?$/i.exec(piece.trim());
        if (!m) return;
        const ref = parseRef(m[1]!, baseTable);
        const op = m[2]!.toUpperCase().replace(/\s+/g, " ");
        const rawVal = (m[3] ?? "").trim().replace(/^\(|\)$/g, "").replace(/'/g, "");
        const type = TABLE_BY_NAME[ref.table]?.columns.find((c) => c.name === ref.column)?.type;
        const kind: WhereCond["kind"] =
          op === "IS NULL" || op === "IS NOT NULL"
            ? "null"
            : op === "IN"
              ? "list"
              : type === "boolean"
                ? "boolean"
                : type === "bigint" || type === "integer" || type === "numeric"
                  ? "number"
                  : "text";
        wheres.push({
          id: `wh-p-${i}-${oi}`,
          conj: oi > 0 ? "OR" : i > 0 ? "AND" : "AND",
          table: ref.table,
          column: ref.column,
          op,
          value: rawVal,
          kind,
        });
      });
    });
  }

  const groupBy = (/\bgroup\s+by\s+([\s\S]*?)(?=\bhaving\b|\border\s+by\b|\blimit\b|$)/i.exec(sql)?.[1] ?? "")
    .split(",")
    .map((g) => g.trim())
    .filter(Boolean)
    .map((g) => {
      const ref = parseRef(g, baseTable);
      return `${ref.table}.${ref.column}`;
    });

  const having: HavingTerm[] = [];
  const havingPart = /\bhaving\s+([\s\S]*?)(?=\border\s+by\b|\blimit\b|$)/i.exec(sql)?.[1];
  if (havingPart) {
    splitTopLevel(havingPart, " and ").forEach((chunk, i) => {
      const m = /^([a-z_]*)\(([^)]*)\)\s*(>=|<=|<>|!=|=|>|<)\s*([\d.]+)$/i.exec(chunk.trim());
      if (!m) return;
      having.push({
        id: `hv-p-${i}`,
        agg: (m[1]!.toUpperCase() as AggFn) || "COUNT",
        column: parseRef(m[2]!, baseTable).table + "." + parseRef(m[2]!, baseTable).column,
        op: m[3]!,
        value: m[4]!,
      });
    });
  }

  const orderBy: OrderTerm[] = (/\border\s+by\s+([\s\S]*?)(?=\blimit\b|$)/i.exec(sql)?.[1] ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .map((o, i) => {
      const m = /^([\s\S]+?)\s+(asc|desc)$/i.exec(o);
      const dir = (m?.[2]?.toUpperCase() as "ASC" | "DESC") ?? "ASC";
      const expr = (m?.[1] ?? o).trim();
      const ref = parseRef(expr, baseTable);
      const isAlias = selectFields.some((f) => f.alias.trim() === expr);
      return { id: `ob-p-${i}`, expr: isAlias ? expr : `${ref.table}.${ref.column}`, dir };
    });

  const limitRaw = /\blimit\s+(\d+)/i.exec(sql)?.[1];
  const limit = limitRaw ? Number(limitRaw) : null;

  return {
    baseTable,
    distinct,
    selectFields,
    joins,
    wheres,
    groupBy,
    having,
    orderBy,
    limit,
    cte,
  };
}
