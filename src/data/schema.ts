export type ColumnType =
  | "uuid"
  | "text"
  | "varchar"
  | "integer"
  | "bigint"
  | "numeric"
  | "boolean"
  | "timestamp"
  | "date"
  | "jsonb";

export interface Column {
  name: string;
  type: ColumnType;
  pk?: boolean;
  fk?: { table: string; column: string };
  nullable?: boolean;
  indexed?: boolean;
  note?: string;
}

export interface IndexDef {
  name: string;
  columns: string[];
  unique?: boolean;
  method: "btree" | "hash" | "gin";
  sizeMb: number;
  usage: number;
}

export interface Table {
  name: string;
  label: string;
  rows: number;
  sizeMb: number;
  tint: "violet" | "emerald" | "amber" | "cyan" | "rose";
  columns: Column[];
  indexes: IndexDef[];
}

export const TABLES: Table[] = [
  {
    name: "users",
    label: "Accounts & identity",
    rows: 12480,
    sizeMb: 4.2,
    tint: "violet",
    columns: [
      { name: "id", type: "bigint", pk: true },
      { name: "email", type: "varchar", nullable: false, indexed: true, note: "Unique login key" },
      { name: "full_name", type: "text", nullable: true },
      { name: "plan", type: "text", nullable: false, note: "free | pro | enterprise" },
      { name: "country", type: "text", nullable: true, indexed: true },
      { name: "created_at", type: "timestamp", nullable: false, indexed: true },
    ],
    indexes: [
      { name: "users_pkey", columns: ["id"], unique: true, method: "btree", sizeMb: 0.4, usage: 128400 },
      { name: "users_email_idx", columns: ["email"], unique: true, method: "btree", sizeMb: 0.6, usage: 98210 },
      { name: "users_created_at_idx", columns: ["created_at"], method: "btree", sizeMb: 0.5, usage: 4120 },
    ],
  },
  {
    name: "orders",
    label: "Purchases & line totals",
    rows: 48620,
    sizeMb: 22.8,
    tint: "emerald",
    columns: [
      { name: "id", type: "bigint", pk: true },
      { name: "user_id", type: "bigint", nullable: false, fk: { table: "users", column: "id" }, indexed: true },
      { name: "status", type: "text", nullable: false, indexed: true, note: "pending | paid | shipped | refunded" },
      { name: "total", type: "numeric", nullable: false },
      { name: "currency", type: "text", nullable: false },
      { name: "placed_at", type: "timestamp", nullable: false, indexed: true },
    ],
    indexes: [
      { name: "orders_pkey", columns: ["id"], unique: true, method: "btree", sizeMb: 1.6, usage: 201400 },
      { name: "orders_user_id_idx", columns: ["user_id"], method: "btree", sizeMb: 1.1, usage: 154210 },
      { name: "orders_status_idx", columns: ["status"], method: "btree", sizeMb: 0.9, usage: 22110 },
      { name: "orders_placed_at_idx", columns: ["placed_at"], method: "btree", sizeMb: 1.2, usage: 18400 },
    ],
  },
  {
    name: "products",
    label: "Catalog & pricing",
    rows: 3120,
    sizeMb: 6.9,
    tint: "amber",
    columns: [
      { name: "id", type: "bigint", pk: true },
      { name: "sku", type: "varchar", nullable: false, indexed: true },
      { name: "name", type: "text", nullable: false },
      { name: "category", type: "text", nullable: false, indexed: true },
      { name: "price", type: "numeric", nullable: false },
      { name: "in_stock", type: "boolean", nullable: false },
      { name: "attributes", type: "jsonb", nullable: true, indexed: true },
    ],
    indexes: [
      { name: "products_pkey", columns: ["id"], unique: true, method: "btree", sizeMb: 0.3, usage: 87120 },
      { name: "products_sku_idx", columns: ["sku"], unique: true, method: "btree", sizeMb: 0.3, usage: 64010 },
      { name: "products_attributes_gin", columns: ["attributes"], method: "gin", sizeMb: 0.8, usage: 2200 },
    ],
  },
  {
    name: "transactions",
    label: "Payments & settlement",
    rows: 96340,
    sizeMb: 48.5,
    tint: "cyan",
    columns: [
      { name: "id", type: "bigint", pk: true },
      { name: "order_id", type: "bigint", nullable: false, fk: { table: "orders", column: "id" }, indexed: true },
      { name: "product_id", type: "bigint", nullable: true, fk: { table: "products", column: "id" }, indexed: true },
      { name: "amount", type: "numeric", nullable: false },
      { name: "method", type: "text", nullable: false, note: "card | mpesa | wire" },
      { name: "succeeded", type: "boolean", nullable: false },
      { name: "processed_at", type: "timestamp", nullable: false, indexed: true },
    ],
    indexes: [
      { name: "transactions_pkey", columns: ["id"], unique: true, method: "btree", sizeMb: 3.2, usage: 312000 },
      { name: "transactions_order_id_idx", columns: ["order_id"], method: "btree", sizeMb: 2.4, usage: 421400 },
      { name: "transactions_processed_at_idx", columns: ["processed_at"], method: "btree", sizeMb: 2.6, usage: 28010 },
    ],
  },
];

export const TABLE_BY_NAME = Object.fromEntries(TABLES.map((t) => [t.name, t])) as Record<string, Table>;

export interface Relation {
  from: string;
  fromColumn: string;
  to: string;
  toColumn: string;
}

export const RELATIONS: Relation[] = [
  { from: "orders", fromColumn: "user_id", to: "users", toColumn: "id" },
  { from: "transactions", fromColumn: "order_id", to: "orders", toColumn: "id" },
  { from: "transactions", fromColumn: "product_id", to: "products", toColumn: "id" },
];

/* ------------------------------------------------------------------ */
/* Sample result rows (deterministic, realistic)                       */
/* ------------------------------------------------------------------ */

export type Row = Record<string, string | number | boolean | null>;

const PLANS = ["free", "pro", "enterprise"];
const STATUSES = ["paid", "shipped", "refunded", "pending"];
const METHODS = ["card", "mpesa", "wire"];
const CATEGORIES = ["Hardware", "Compute", "Storage", "Networking"];
const CURRENCIES = ["USD", "EUR", "KES"];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function sampleRows(table: string, limit = 12): Row[] {
  const rnd = seeded(table.length * 7919 + 17);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const rows: Row[] = [];
  for (let i = 0; i < limit; i += 1) {
    const n = 1000 + i * 37 + Math.floor(rnd() * 20);
    if (table === "users") {
      rows.push({
        id: n,
        email: `dev${n}@querypulse.io`,
        full_name: pick(["Amina Wanjiru", "Leo Fischer", "Priya Raman", "Tomás Duarte", "Yuki Sato"]),
        plan: pick(PLANS),
        country: pick(["KE", "DE", "IN", "BR", "JP"]),
        created_at: `2025-${String(1 + (i % 12)).padStart(2, "0")}-14 09:2${i % 10}:00`,
      });
    } else if (table === "orders") {
      rows.push({
        id: 40000 + n,
        user_id: 1000 + (i % 9),
        status: pick(STATUSES),
        total: Number((49 + rnd() * 900).toFixed(2)),
        currency: pick(CURRENCIES),
        placed_at: `2026-0${1 + (i % 9)}-0${1 + (i % 8)} 14:0${i % 10}:11`,
      });
    } else if (table === "products") {
      rows.push({
        id: 300 + i,
        sku: `QP-${String(1000 + i * 3)}`,
        name: pick(["Edge Node 4x", "NVMe Volume 1TB", "Mesh Router", "GPU Rack Unit"]),
        category: pick(CATEGORIES),
        price: Number((19 + rnd() * 2400).toFixed(2)),
        in_stock: rnd() > 0.25,
        attributes: '{"region":"eu-west-1"}',
      });
    } else {
      rows.push({
        id: 900000 + n,
        order_id: 40000 + (i % 11),
        product_id: 300 + (i % 7),
        amount: Number((12 + rnd() * 1300).toFixed(2)),
        method: pick(METHODS),
        succeeded: rnd() > 0.12,
        processed_at: `2026-10-${String(1 + i).padStart(2, "0")} 11:4${i % 10}:02`,
      });
    }
  }
  return rows;
}

const POOLS: Record<string, string[]> = {
  "orders.status": STATUSES,
  "orders.currency": CURRENCIES,
  "orders.placed_at": ["2026-08", "2026-09", "2026-10", "2026-11"],
  "orders.id": ["40001", "40002", "40003", "40004"],
  "users.plan": PLANS,
  "users.country": ["KE", "DE", "IN", "BR", "JP", "US"],
  "users.full_name": ["Amina Wanjiru", "Leo Fischer", "Priya Raman", "Tomás Duarte", "Yuki Sato", "Noor Haddad"],
  "users.email": ["amina@qp.io", "leo@qp.io", "priya@qp.io", "tomas@qp.io", "yuki@qp.io", "noor@qp.io"],
  "products.category": CATEGORIES,
  "products.name": ["Edge Node 4x", "NVMe Volume 1TB", "Mesh Router", "GPU Rack Unit"],
  "products.sku": ["QP-1000", "QP-1003", "QP-1006", "QP-1009"],
  "transactions.method": METHODS,
  "transactions.succeeded": ["true", "false"],
  "transactions.order_id": ["40001", "40002", "40003", "40004"],
};

/** Materialised results for common aggregate shapes produced by the builder. */
export function aggregateRows(spec: AggregateSpec, limit = 12): Row[] {
  const rnd = seeded(spec.groupBy.length * 4241 + spec.measures.length * 131 + 7);
  const pools = POOLS;
  const first = spec.groupBy[0];
  const base = first ? (pools[first] ?? ["all"]) : ["all"];
  const extra = spec.groupBy.slice(1);

  return base.slice(0, limit).flatMap((value, gi) =>
    (extra.length ? (pools[extra[0]!] ?? ["—"]).slice(0, 3) : [null]).map((second, si): Row => {
      const row: Row = {};
      spec.groupBy.forEach((g, idx) => {
        row[g.split(".")[1] ?? g] = idx === 0 ? value : (second ?? "—");
      });
      spec.measures.forEach((m) => {
        const metric = m.metric;
        const label = `${metric.toLowerCase()}_${m.column === "*" ? "all" : m.column.split(".")[1]}`;
        if (metric === "COUNT") row[label] = Math.round(120 + rnd() * (gi + 1) * 2400);
        else if (metric === "SUM") row[label] = Number((800 + rnd() * (gi + 2) * 12000).toFixed(2));
        else if (metric === "AVG") row[label] = Number((18 + rnd() * 420).toFixed(2));
        else if (metric === "MAX") row[label] = Number((4200 + rnd() * 9000).toFixed(2));
        else row[label] = Number((4 + rnd() * 40 * si).toFixed(2));
      });
      return row;
    }),
  );
}

export interface AggregateSpec {
  groupBy: string[];
  measures: { metric: string; column: string }[];
}
