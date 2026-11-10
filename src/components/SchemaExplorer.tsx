import { useMemo, useState } from "react";
import {
  Braces,
  Columns3,
  Copy,
  Database,
  Fingerprint,
  GitBranch,
  KeyRound,
  Link2,
  Rows3,
  Search,
  Table2,
  Zap,
  Check,
  ChevronRight,
  Activity,
  HardDrive,
} from "lucide-react";
import { RELATIONS, TABLES, type Column, type Table } from "../data/schema";
import { Badge, Button, Card, ProgressBar, SectionTitle, TextInput, type Tone } from "./ui";

const TINT: Record<Table["tint"], Tone> = {
  violet: "violet",
  emerald: "emerald",
  amber: "amber",
  cyan: "cyan",
  rose: "rose",
};

/* --------------------------- ER diagram --------------------------- */

const NODE_W = 186;
const HEADER_H = 30;
const ROW_H = 17;

export function ErDiagram({
  selected,
  onSelect,
  highlighted,
}: {
  selected: string;
  onSelect: (t: string) => void;
  highlighted: string | null;
}) {
  const layout = useMemo(() => {
    const positions: Record<string, { x: number; y: number }> = {
      users: { x: 24, y: 20 },
      orders: { x: 300, y: 20 },
      products: { x: 300, y: 210 },
      transactions: { x: 576, y: 120 },
    };
    return TABLES.map((t) => ({
      table: t,
      x: positions[t.name]?.x ?? 0,
      y: positions[t.name]?.y ?? 0,
      h: HEADER_H + t.columns.length * ROW_H + 10,
    }));
  }, []);

  const width = 800;
  const height = Math.max(...layout.map((n) => n.y + n.h)) + 20;

  const anchor = (table: string, column: string, side: "l" | "r") => {
    const node = layout.find((n) => n.table.name === table);
    if (!node) return { x: 0, y: 0 };
    const idx = node.table.columns.findIndex((c) => c.name === column);
    return { x: side === "r" ? node.x + NODE_W : node.x, y: node.y + HEADER_H + Math.max(0, idx) * ROW_H + ROW_H / 2 - 5 };
  };

  return (
    <div className="qp-scroll-x -mx-1 rounded-xl border border-line bg-[#070c16] p-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[620px]"
        role="img"
        aria-label="Entity relationship diagram"
      >
        <defs>
          <pattern id="erd-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0v24" fill="none" stroke="#131d33" strokeWidth="1" />
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 10 5 0 10z" fill="#22d3ee" />
          </marker>
        </defs>
        <rect width={width} height={height} fill="url(#erd-grid)" opacity="0.55" />

        {RELATIONS.map((r, i) => {
          const fromNode = layout.find((n) => n.table.name === r.from)!;
          const toNode = layout.find((n) => n.table.name === r.to)!;
          const goingLeft = toNode.x < fromNode.x;
          const a = anchor(r.from, r.fromColumn, goingLeft ? "l" : "r");
          const b = anchor(r.to, r.toColumn, goingLeft ? "r" : "l");
          const midX = (a.x + b.x) / 2;
          const active = selected === r.from || selected === r.to;
          const color = active ? "#8b5cf6" : "#22d3ee";
          return (
            <g key={`${r.from}-${r.to}-${i}`} opacity={selected && !active ? 0.25 : 1}>
              <path
                d={`M${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`}
                fill="none"
                stroke={color}
                strokeWidth={active ? 1.9 : 1.2}
                strokeDasharray={active ? "0" : "4 3"}
                markerEnd="url(#arrow)"
              />
              <circle cx={a.x} cy={a.y} r={2.4} fill={color} />
              <text
                x={midX}
                y={(a.y + b.y) / 2 - 5}
                textAnchor="middle"
                className="fill-slate-500 font-mono"
                fontSize="8"
              >
                {r.fromColumn} → {r.toColumn}
              </text>
            </g>
          );
        })}

        {layout.map(({ table, x, y, h }) => {
          const isSel = selected === table.name;
          const dim = highlighted !== null && highlighted !== table.name && selected !== table.name;
          const tone = TINT[table.tint];
          const stroke = isSel ? "#8b5cf6" : "#1e2b45";
          const accent =
            table.tint === "violet" ? "#a78bfa" : table.tint === "emerald" ? "#34d399" : table.tint === "amber" ? "#fbbf24" : table.tint === "cyan" ? "#22d3ee" : "#fb7185";
          return (
            <g
              key={table.name}
              transform={`translate(${x},${y})`}
              opacity={dim ? 0.4 : 1}
              onClick={() => onSelect(table.name)}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`${table.name} table, ${table.rows} rows`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelect(table.name);
              }}
            >
              <rect
                x={0}
                y={0}
                width={NODE_W}
                height={h}
                rx={9}
                fill="#0f172a"
                stroke={stroke}
                strokeWidth={isSel ? 1.8 : 1}
                filter={isSel ? "drop-shadow(0 0 10px rgba(139,92,246,0.35))" : undefined}
              />
              <rect x={0} y={0} width={NODE_W} height={HEADER_H} rx={9} fill={accent} opacity={0.12} />
              <rect x={0} y={0} width={NODE_W} height={HEADER_H} rx={9} fill="none" stroke={stroke} strokeWidth={1} />
              <circle cx={13} cy={HEADER_H / 2} r={3.4} fill={accent} />
              <text x={23} y={HEADER_H / 2 + 3.6} className="fill-slate-100 font-mono" fontSize="10.5" fontWeight="600">
                {table.name}
              </text>
              <text x={NODE_W - 9} y={HEADER_H / 2 + 3.6} textAnchor="end" className="fill-slate-500 font-mono" fontSize="8">
                {table.rows > 9999 ? `${Math.round(table.rows / 1000)}k` : table.rows} rows
              </text>
              {table.columns.map((c, ci) => (
                <g key={c.name} transform={`translate(0,${HEADER_H + ci * ROW_H})`}>
                  {ci % 2 === 0 ? <rect x={1} y={0} width={NODE_W - 2} height={ROW_H} fill="#131d33" opacity={0.45} /> : null}
                  {c.pk ? (
                    <text x={9} y={12} fontSize="7.5" className="fill-amber-300 font-mono">PK</text>
                  ) : c.fk ? (
                    <text x={9} y={12} fontSize="7.5" className="fill-cyan-300 font-mono">FK</text>
                  ) : (
                    <text x={9} y={12} fontSize="7.5" className="fill-slate-600 font-mono">··</text>
                  )}
                  <text x={30} y={12} fontSize="9" className="fill-slate-200 font-mono">
                    {c.name}
                  </text>
                  <text x={NODE_W - 9} y={12} textAnchor="end" fontSize="7.5" className="fill-slate-500 font-mono">
                    {c.type}
                  </text>
                  {c.indexed ? <circle cx={NODE_W - 52} cy={8.5} r={1.8} fill={tone === "amber" ? "#fbbf24" : "#34d399"} /> : null}
                </g>
              ))}
              <line
                x1={0}
                x2={NODE_W}
                y1={HEADER_H + table.columns.length * ROW_H}
                y2={HEADER_H + table.columns.length * ROW_H}
                stroke="#1e2b45"
              />
              <text x={9} y={HEADER_H + table.columns.length * ROW_H + 13} fontSize="7.5" className="fill-slate-500 font-mono">
                {table.indexes.length} indexes · {table.sizeMb} MB
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* --------------------------- Column row --------------------------- */

function ColumnRow({ col, table }: { col: Column; table: Table }) {
  const [copied, setCopied] = useState(false);
  const ref = `${table.name}.${col.name}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };
  return (
    <tr className="group transition-colors hover:bg-violet-500/[0.05]">
      <td className="py-1 pl-2 pr-1">
        <div className="flex items-center gap-1.5">
          {col.pk ? (
            <KeyRound size={11} className="shrink-0 text-amber-300" />
          ) : col.fk ? (
            <Link2 size={11} className="shrink-0 text-cyan-300" />
          ) : (
            <span className="ml-[3px] size-1 shrink-0 rounded-full bg-slate-600" />
          )}
          <span className="font-mono text-[11.5px] text-slate-200">{col.name}</span>
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${ref}`}
            className="rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-violet-300 group-hover:opacity-100 focus-visible:opacity-100"
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
          </button>
        </div>
      </td>
      <td className="px-1 py-1">
        <span className="font-mono text-[10.5px] text-violet-300/90">{col.type}</span>
      </td>
      <td className="px-1 py-1">
        {col.fk ? (
          <Badge tone="cyan">
            → {col.fk.table}.{col.fk.column}
          </Badge>
        ) : col.pk ? (
          <Badge tone="amber">primary key</Badge>
        ) : (
          <span className="font-mono text-[10px] text-faint/60">{col.nullable ? "nullable" : "not null"}</span>
        )}
      </td>
      <td className="px-1 py-1 text-right">
        {col.indexed ? (
          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300">
            <Zap size={9} /> indexed
          </span>
        ) : (
          <span className="font-mono text-[10px] text-faint/50">—</span>
        )}
      </td>
    </tr>
  );
}

/* --------------------------- Main --------------------------- */

export function SchemaExplorer({
  selected,
  onSelect,
  onUseTable,
}: {
  selected: string;
  onSelect: (t: string) => void;
  onUseTable: (t: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ orders: true, users: true });
  const [tab, setTab] = useState<"columns" | "indexes" | "ddl">("columns");

  const table = TABLES.find((t) => t.name === selected) ?? TABLES[0]!;
  const filtered = TABLES.filter(
    (t) =>
      !query.trim() ||
      t.name.includes(query.toLowerCase()) ||
      t.columns.some((c) => c.name.includes(query.toLowerCase())),
  );

  const totalRows = TABLES.reduce((a, t) => a + t.rows, 0);
  const totalSize = TABLES.reduce((a, t) => a + t.sizeMb, 0);

  const ddl = useMemo(() => {
    const cols = table.columns.map((c) => {
      let s = `  ${c.name} ${c.type.toUpperCase()}`;
      if (c.pk) s += " PRIMARY KEY";
      if (!c.nullable && !c.pk) s += " NOT NULL";
      if (c.fk) s += ` REFERENCES ${c.fk.table}(${c.fk.column})`;
      return s;
    });
    return `CREATE TABLE ${table.name} (\n${cols.join(",\n")}\n);\n\n${table.indexes
      .filter((i) => !i.name.endsWith("_pkey"))
      .map((i) => `CREATE ${i.unique ? "UNIQUE " : ""}INDEX ${i.name}\n  ON ${table.name} USING ${i.method} (${i.columns.join(", ")});`)
      .join("\n")}`;
  }, [table]);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[300px_minmax(0,1fr)]">
      {/* schema tree */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-3 py-2">
            <SectionTitle icon={Database} title="Schema Tree" subtitle="public · 4 relations" />
            <div className="relative mt-2">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-faint" />
              <TextInput
                value={query}
                onChange={setQuery}
                placeholder="search tables or columns…"
                ariaLabel="Search schema"
                className="pl-7"
                mono={false}
              />
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto p-1.5">
            <div className="flex items-center gap-1.5 px-1.5 py-1 font-mono text-[10.5px] text-faint">
              <ChevronRight size={11} className="rotate-90" /> public
            </div>
            {filtered.map((t) => {
              const open = expanded[t.name] ?? false;
              const active = t.name === selected;
              return (
                <div key={t.name}>
                  <div
                    className={`flex items-center gap-1 rounded-md px-1.5 py-1 transition-colors ${
                      active ? "bg-violet-500/12 ring-1 ring-inset ring-violet-500/30" : "hover:bg-white/[0.04]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => ({ ...e, [t.name]: !open }))}
                      aria-label={`${open ? "Collapse" : "Expand"} ${t.name}`}
                      className="rounded p-0.5 text-faint hover:text-slate-200"
                    >
                      <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
                    </button>
                    <button type="button" onClick={() => onSelect(t.name)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                      <Table2 size={12} className={active ? "text-violet-300" : "text-slate-500"} />
                      <span className={`truncate font-mono text-[11.5px] ${active ? "text-violet-200" : "text-slate-300"}`}>
                        {t.name}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-[9.5px] text-faint/70">{t.columns.length}</span>
                    </button>
                  </div>
                  {open ? (
                    <div className="ml-[18px] border-l border-line/70 pl-1.5">
                      {t.columns.map((c) => (
                        <div key={c.name} className="flex items-center gap-1.5 rounded px-1 py-[3px] hover:bg-white/[0.03]">
                          {c.pk ? (
                            <KeyRound size={9} className="text-amber-300" />
                          ) : c.fk ? (
                            <Link2 size={9} className="text-cyan-300" />
                          ) : (
                            <Columns3 size={9} className="text-slate-600" />
                          )}
                          <span className="truncate font-mono text-[10.5px] text-slate-400">{c.name}</span>
                          <span className="ml-auto shrink-0 font-mono text-[9px] text-faint/60">{c.type}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="px-2 py-4 text-center font-mono text-[10.5px] text-faint">no relations matched</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-1.5 border-t border-line p-2">
            <div className="rounded-lg bg-obsidian-2/70 px-2 py-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-faint">total rows</p>
              <p className="font-mono text-[13px] font-semibold text-violet-300">{totalRows.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-obsidian-2/70 px-2 py-1.5">
              <p className="font-mono text-[9px] uppercase tracking-wider text-faint">disk size</p>
              <p className="font-mono text-[13px] font-semibold text-cyan-300">{totalSize.toFixed(1)} MB</p>
            </div>
          </div>
        </Card>

        <Card className="p-3">
          <SectionTitle icon={Activity} title="Table Health" subtitle="bloat & vacuum status" tone="emerald" />
          <div className="mt-2.5 space-y-2">
            {TABLES.map((t) => {
              const bloat = t.name === "transactions" ? 18 : t.name === "orders" ? 9 : 3;
              return (
                <div key={t.name}>
                  <div className="flex items-center justify-between font-mono text-[10.5px]">
                    <span className="text-slate-300">{t.name}</span>
                    <span className={bloat > 15 ? "text-amber-300" : "text-emerald-300"}>{bloat}% bloat</span>
                  </div>
                  <ProgressBar value={bloat * 4} tone={bloat > 15 ? "amber" : "emerald"} className="mt-1" />
                </div>
              );
            })}
          </div>
          <p className="mt-2.5 rounded border border-line bg-obsidian-2/60 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-faint">
            VACUUM ANALYZE recommended on <span className="text-amber-300">transactions</span>
          </p>
        </Card>
      </div>

      {/* detail + ER */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <SectionTitle
              icon={Table2}
              title={`public.${table.name}`}
              subtitle={table.label}
              right={
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="subtle" icon={GitBranch} onClick={() => onUseTable(table.name)}>
                    Query this
                  </Button>
                  <Button size="sm" variant="subtle" icon={Braces} onClick={() => setTab("ddl")}>
                    DDL
                  </Button>
                </div>
              }
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone={TINT[table.tint]}>
              <Rows3 size={10} /> {table.rows.toLocaleString()} rows
            </Badge>
            <Badge tone="cyan">
              <HardDrive size={10} /> {table.sizeMb} MB
            </Badge>
            <Badge tone="violet">
              <Columns3 size={10} /> {table.columns.length} columns
            </Badge>
            <Badge tone="emerald">
              <Zap size={10} /> {table.indexes.length} indexes
            </Badge>
            <Badge tone="amber">
              <KeyRound size={10} /> {table.columns.filter((c) => c.pk).length} pk
            </Badge>
            <Badge tone="cyan">
              <Fingerprint size={10} /> {table.columns.filter((c) => c.fk).length} fk
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-1 border-b border-line">
            {(["columns", "indexes", "ddl"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`-mb-px border-b-2 px-2.5 py-1.5 font-mono text-[11px] capitalize transition-colors ${
                  tab === k ? "border-violet-400 text-violet-200" : "border-transparent text-faint hover:text-slate-300"
                }`}
              >
                {k}
              </button>
            ))}
          </div>

          {tab === "columns" ? (
            <div className="mt-1 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead>
                  <tr className="font-mono text-[9.5px] uppercase tracking-wider text-faint">
                    <th className="py-1 pl-2 font-medium">column</th>
                    <th className="px-1 py-1 font-medium">type</th>
                    <th className="px-1 py-1 font-medium">constraint</th>
                    <th className="px-1 py-1 text-right font-medium">index</th>
                  </tr>
                </thead>
                <tbody className="qp-table-grid">
                  {table.columns.map((c) => (
                    <ColumnRow key={c.name} col={c} table={table} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : tab === "indexes" ? (
            <div className="mt-1.5 space-y-1.5">
              {table.indexes.map((i) => (
                <div key={i.name} className="rounded-lg border border-line bg-obsidian-2/60 px-2.5 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Zap size={11} className="text-emerald-300" />
                    <span className="font-mono text-[11px] text-slate-200">{i.name}</span>
                    {i.unique ? <Badge tone="amber">unique</Badge> : null}
                    <Badge tone="violet">{i.method}</Badge>
                    <span className="ml-auto font-mono text-[10px] text-faint">{i.sizeMb} MB</span>
                  </div>
                  <p className="mt-1 font-mono text-[10.5px] text-faint">
                    ({i.columns.join(", ")}) · {i.usage.toLocaleString()} scans
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={Math.min(100, (i.usage / 4300) * 1)} tone={i.usage > 100000 ? "emerald" : "slate"} />
                    <span className="shrink-0 font-mono text-[9.5px] text-faint">
                      {i.usage > 150000 ? "hot" : i.usage > 20000 ? "warm" : "cold"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <pre className="qp-code mt-1.5 max-h-[280px] overflow-auto rounded-lg border border-line bg-[#080d18] p-2.5 text-[11px] leading-relaxed text-slate-300">
              {ddl}
            </pre>
          )}
        </Card>

        <Card className="p-3">
          <SectionTitle
            icon={GitBranch}
            title="Entity-Relationship Map"
            subtitle="click a table to inspect · arrows follow foreign keys"
            tone="cyan"
            right={
              <div className="hidden items-center gap-2 sm:flex">
                <span className="flex items-center gap-1 font-mono text-[9.5px] text-faint">
                  <span className="size-1.5 rounded-full bg-amber-400" /> PK
                </span>
                <span className="flex items-center gap-1 font-mono text-[9.5px] text-faint">
                  <span className="size-1.5 rounded-full bg-emerald-400" /> indexed
                </span>
              </div>
            }
          />
          <div className="mt-2.5">
            <ErDiagram selected={selected} onSelect={onSelect} highlighted={selected} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {RELATIONS.map((r) => (
              <span
                key={`${r.from}.${r.fromColumn}`}
                className="rounded border border-line bg-obsidian-2/70 px-1.5 py-0.5 font-mono text-[9.5px] text-faint"
              >
                {r.from}.{r.fromColumn} <span className="text-cyan-400">→</span> {r.to}.{r.toColumn}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
