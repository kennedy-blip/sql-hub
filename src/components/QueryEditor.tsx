import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDownUp,
  ChevronDown,
  Copy,
  Database,
  Filter,
  GitMerge,
  GripVertical,
  Layers,
  ListChecks,
  Play,
  Plus,
  Rows3,
  Sigma,
  TableProperties,
  Trash2,
  TriangleAlert,
  Wand2,
  X,
  Check,
  CircleCheck,
  Info,
  Clock3,
  HardDrive,
  Gauge,
  Braces,
} from "lucide-react";
import {
  buildSql,
  columnTypeOf,
  isIndexed,
  type IndexSet,
  quoteLiteral,
  type AggFn,
  type ExecutionResult,
  type JoinType,
  type Problem,
  type QueryState,
  type SelectField,
  type WhereCond,
  uid,
} from "../lib/query";
import { TABLE_BY_NAME, TABLES, type Row } from "../data/schema";
import { SqlHighlight } from "./SqlBlock";
import { Badge, Button, Card, EmptyState, IconButton, SectionTitle, Select, TextInput, Toggle, type Tone } from "./ui";

const AGG_OPTIONS: (AggFn | "")[] = ["", "COUNT", "SUM", "AVG", "MIN", "MAX"];
const OPS = ["=", "<>", ">", ">=", "<", "<=", "LIKE", "IN", "IS NULL", "IS NOT NULL"];

type Patch = (p: Partial<QueryState>) => void;

/* ------------------------------------------------------------------ */

function Clause({
  id,
  icon,
  label,
  sqlHint,
  tone,
  count,
  active,
  children,
  onAdd,
  addLabel,
}: {
  id: string;
  icon: ReactNode;
  label: string;
  sqlHint: string;
  tone: Tone;
  count: number;
  active: boolean;
  children: ReactNode;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const [open, setOpen] = useState(active || count > 0);
  const toneRing: Record<string, string> = {
    violet: "border-l-violet-500/70",
    emerald: "border-l-emerald-500/70",
    amber: "border-l-amber-500/70",
    cyan: "border-l-cyan-500/70",
    rose: "border-l-rose-500/70",
    slate: "border-l-slate-600",
  };
  return (
    <div
      className={`overflow-hidden rounded-xl border border-line bg-panel-2/40 border-l-2 ${toneRing[tone]} ${
        active ? "shadow-[0_0_0_1px_rgba(139,92,246,0.12)]" : ""
      }`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`clause-${id}`}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            size={14}
            className={`shrink-0 text-faint transition-transform ${open ? "" : "-rotate-90"}`}
          />
          <span className="shrink-0 text-slate-400">{icon}</span>
          <span className="font-mono text-[11.5px] font-semibold tracking-wide text-slate-200">{label}</span>
          {count > 0 ? (
            <span className="rounded bg-white/[0.06] px-1.5 py-px font-mono text-[10px] text-muted">{count}</span>
          ) : (
            <span className="font-mono text-[10px] text-faint/70">unset</span>
          )}
          <span className="ml-auto hidden truncate font-mono text-[10px] text-faint/70 sm:block">{sqlHint}</span>
        </button>
        {onAdd ? (
          <IconButton icon={Plus} title={addLabel ?? `Add ${label}`} onClick={onAdd} tone={tone} className="size-7" />
        ) : null}
      </div>
      {open ? (
        <div id={`clause-${id}`} className="animate-fade-up space-y-1.5 px-2.5 pb-2.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ColumnRef({
  tables,
  table,
  column,
  onTable,
  onColumn,
  showStar = true,
}: {
  tables: string[];
  table: string;
  column: string;
  onTable: (v: string) => void;
  onColumn: (v: string) => void;
  showStar?: boolean;
}) {
  const cols = TABLE_BY_NAME[table]?.columns ?? [];
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Select value={table} onChange={onTable} ariaLabel="Table" className="w-[92px] shrink-0">
        {tables.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>
      <span className="shrink-0 font-mono text-[11px] text-faint">.</span>
      <Select value={column} onChange={onColumn} ariaLabel="Column" className="min-w-0 flex-1">
        {showStar && table === (tables[0] ?? "") ? <option value="*">*</option> : null}
        {cols.map((c) => (
          <option key={c.name} value={c.name}>
            {c.name}
            {c.pk ? "  🔑" : c.fk ? "  ↗" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function QueryEditor({
  state,
  patch,
  execution,
  busy,
  onRun,
  onFormat,
  extraIndexes,
}: {
  state: QueryState;
  patch: Patch;
  execution: ExecutionResult | null;
  busy: boolean;
  onRun: () => void;
  onFormat: () => void;
  extraIndexes: IndexSet;
}) {
  const [copied, setCopied] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"sql" | "checks">("sql");

  const sql = useMemo(() => buildSql(state, true), [state]);
  const availableTables = useMemo(
    () => [state.baseTable, ...state.joins.map((j) => j.table)],
    [state.baseTable, state.joins],
  );
  const problems: Problem[] = execution?.problems ?? [];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const addSelect = (table = state.baseTable, column = "id") =>
    patch({
      selectFields: [...state.selectFields, { id: uid("sf"), table, column, agg: null, alias: "" }],
    });

  const updateSelect = (id: string, p: Partial<SelectField>) =>
    patch({ selectFields: state.selectFields.map((f) => (f.id === id ? { ...f, ...p } : f)) });

  const moveSelect = (fromId: string, toId: string) => {
    const list = [...state.selectFields];
    const from = list.findIndex((f) => f.id === fromId);
    const to = list.findIndex((f) => f.id === toId);
    if (from < 0 || to < 0) return;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item!);
    patch({ selectFields: list });
  };

  const addJoin = () => {
    const candidate = TABLES.find((t) => !availableTables.includes(t.name));
    const table = candidate?.name ?? "products";
    const fkCol = TABLE_BY_NAME[table]?.columns.find((c) => c.fk);
    const left = fkCol && fkCol.fk && availableTables.includes(fkCol.fk.table)
      ? `${fkCol.name ? table : table}.${fkCol.name}`
      : `${table}.id`;
    patch({
      joins: [
        ...state.joins,
        {
          id: uid("jn"),
          type: "INNER",
          table,
          left,
          right: `${state.baseTable}.id`,
        },
      ],
    });
  };

  const addWhere = () => {
    const table = availableTables[0] ?? state.baseTable;
    patch({
      wheres: [
        ...state.wheres,
        { id: uid("wh"), conj: "AND", table, column: TABLE_BY_NAME[table]?.columns[0]?.name ?? "id", op: "=", value: "", kind: "text" },
      ],
    });
  };

  const toggleGroupBy = (ref: string) =>
    patch({
      groupBy: state.groupBy.includes(ref) ? state.groupBy.filter((g) => g !== ref) : [...state.groupBy, ref],
    });

  const addOrder = () => {
    const first = state.selectFields[0];
    const expr = first ? (first.alias.trim() || `${first.table}.${first.column}`) : `${state.baseTable}.id`;
    patch({ orderBy: [...state.orderBy, { id: uid("ob"), expr, dir: "ASC" }] });
  };

  const addHaving = () =>
    patch({
      having: [
        ...state.having,
        { id: uid("hv"), agg: "COUNT", column: `${state.baseTable}.id`, op: ">", value: "10" },
      ],
    });

  const groupCandidates = state.selectFields
    .filter((f) => !f.agg && f.column !== "*")
    .map((f) => `${f.table}.${f.column}`);

  const errCount = problems.filter((p) => p.severity === "error").length;
  const warnCount = problems.filter((p) => p.severity === "warning").length;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ---------------------------------------------------------------- */}
      {/* LEFT: visual builder                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="p-3">
          <SectionTitle
            icon={Layers}
            title="Visual Query Builder"
            subtitle="Compose clauses as blocks — SQL updates live"
            right={
              <Badge tone="violet">
                <Braces size={10} /> {state.selectFields.length + state.joins.length + state.wheres.length + state.groupBy.length + state.orderBy.length} nodes
              </Badge>
            }
          />

          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-obsidian-2/60 px-2.5 py-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-faint">base</span>
            <Select
              value={state.baseTable}
              ariaLabel="Base table"
              className="w-[122px]"
              onChange={(v) =>
                patch({
                  baseTable: v,
                  joins: [],
                  selectFields: TABLE_BY_NAME[v]!.columns.slice(0, 3).map((c) => ({
                    id: uid("sf"),
                    table: v,
                    column: c.name,
                    agg: null,
                    alias: "",
                  })),
                  wheres: [],
                  groupBy: [],
                  having: [],
                  orderBy: [],
                })
              }
            >
              {TABLES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </Select>
            <span className="font-mono text-[10.5px] text-faint">
              {TABLE_BY_NAME[state.baseTable]?.rows.toLocaleString()} rows · {TABLE_BY_NAME[state.baseTable]?.sizeMb} MB
            </span>
            <div className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-faint">distinct</span>
              <Toggle checked={state.distinct} onChange={(v) => patch({ distinct: v })} label="Select distinct" />
            </div>
          </div>

          <div className="mt-2.5 space-y-2">
            {/* SELECT */}
            <Clause
              id="select"
              icon={<ListChecks size={14} />}
              label="SELECT"
              sqlHint={state.distinct ? "DISTINCT …" : "columns / aggregates"}
              tone="violet"
              count={state.selectFields.length}
              active
              onAdd={() => addSelect()}
              addLabel="Add column"
            >
              {state.selectFields.map((f, i) => {
                const type = columnTypeOf(`${f.table}.${f.column}`);
                return (
                  <div
                    key={f.id}
                    draggable
                    onDragStart={() => setDragId(f.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragId && dragId !== f.id) moveSelect(dragId, f.id);
                    }}
                    className={`group flex flex-wrap items-center gap-1 rounded-lg border border-line-soft bg-obsidian-2/70 px-1.5 py-1.5 transition-colors hover:border-line ${
                      dragId === f.id ? "opacity-50" : ""
                    }`}
                  >
                    <span className="flex cursor-grab items-center gap-1 pl-0.5 text-faint active:cursor-grabbing" title="Drag to reorder">
                      <GripVertical size={13} />
                      <span className="w-3 font-mono text-[10px]">{i + 1}</span>
                    </span>
                    <ColumnRef
                      tables={availableTables}
                      table={f.table}
                      column={f.column}
                      onTable={(t) =>
                        updateSelect(f.id, { table: t, column: TABLE_BY_NAME[t]?.columns[0]?.name ?? "id" })
                      }
                      onColumn={(c) => updateSelect(f.id, { column: c })}
                    />
                    <Select
                      value={f.agg ?? ""}
                      ariaLabel="Aggregate"
                      className="w-[86px] shrink-0"
                      onChange={(v) => updateSelect(f.id, { agg: (v || null) as AggFn | null })}
                    >
                      {AGG_OPTIONS.map((a) => (
                        <option key={a || "none"} value={a}>
                          {a || "— raw —"}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      value={f.alias}
                      onChange={(v) => updateSelect(f.id, { alias: v })}
                      placeholder="alias"
                      ariaLabel="Column alias"
                      className="w-[74px] shrink-0"
                    />
                    <span className="hidden shrink-0 font-mono text-[9.5px] text-faint lg:block">{type ?? ""}</span>
                    <button
                      type="button"
                      aria-label="Remove column"
                      onClick={() => patch({ selectFields: state.selectFields.filter((x) => x.id !== f.id) })}
                      className="ml-auto rounded p-1 text-faint opacity-0 transition-opacity hover:text-rose-300 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })}
              {state.selectFields.length === 0 ? (
                <p className="px-1 py-1.5 font-mono text-[11px] text-rose-300/90">
                  empty projection — query will not compile
                </p>
              ) : null}
            </Clause>

            {/* FROM (informational, base table above) */}
            <Clause
              id="from"
              icon={<TableProperties size={14} />}
              label="FROM"
              sqlHint={state.cte.enabled ? `CTE ${state.cte.name}` : `public.${state.baseTable}`}
              tone="emerald"
              count={1}
              active={false}
            >
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line-soft bg-obsidian-2/70 px-2 py-1.5">
                <Database size={12} className="text-emerald-300" />
                <span className="font-mono text-[11px] text-slate-200">public.{state.baseTable}</span>
                <span className="font-mono text-[10px] text-faint">
                  · {TABLE_BY_NAME[state.baseTable]?.columns.length} cols · {TABLE_BY_NAME[state.baseTable]?.indexes.length} idx
                </span>
                <span className="ml-auto">
                  <Badge tone="emerald">partitioned</Badge>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-2 py-1.5">
                <span className="font-mono text-[10px] text-violet-300">WITH</span>
                <Toggle
                  checked={state.cte.enabled}
                  onChange={(v) => patch({ cte: { ...state.cte, enabled: v } })}
                  label="Enable CTE"
                />
                <TextInput
                  value={state.cte.name}
                  onChange={(v) => patch({ cte: { ...state.cte, name: v.replace(/[^a-z0-9_]/gi, "_").toLowerCase() } })}
                  placeholder="cte_name"
                  ariaLabel="CTE name"
                  className="w-[112px]"
                />
                <TextInput
                  value={state.cte.filter}
                  onChange={(v) => patch({ cte: { ...state.cte, filter: v } })}
                  placeholder="placed_at > now() - interval '30 days'"
                  ariaLabel="CTE filter"
                  className="min-w-[140px] flex-1"
                />
              </div>
            </Clause>

            {/* JOIN */}
            <Clause
              id="join"
              icon={<GitMerge size={14} />}
              label="JOIN"
              sqlHint="foreign-key traversal"
              tone="cyan"
              count={state.joins.length}
              active={state.joins.length > 0}
              onAdd={addJoin}
              addLabel="Add join"
            >
              {state.joins.map((j) => (
                <div key={j.id} className="flex flex-wrap items-center gap-1 rounded-lg border border-line-soft bg-obsidian-2/70 px-1.5 py-1.5">
                  <Select
                    value={j.type}
                    ariaLabel="Join type"
                    className="w-[82px] shrink-0"
                    onChange={(v) =>
                      patch({ joins: state.joins.map((x) => (x.id === j.id ? { ...x, type: v as JoinType } : x)) })
                    }
                  >
                    {(["INNER", "LEFT", "RIGHT", "FULL"] as JoinType[]).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={j.table}
                    ariaLabel="Joined table"
                    className="w-[104px] shrink-0"
                    onChange={(v) =>
                      patch({
                        joins: state.joins.map((x) =>
                          x.id === j.id ? { ...x, table: v, left: `${v}.${TABLE_BY_NAME[v]?.columns[0]?.name ?? "id"}` } : x,
                        ),
                      })
                    }
                  >
                    {TABLES.filter((t) => t.name === j.table || !availableTables.includes(t.name) || t.name === state.baseTable).map(
                      (t) => (
                        <option key={t.name} value={t.name}>
                          {t.name}
                        </option>
                      ),
                    )}
                  </Select>
                  <span className="font-mono text-[11px] text-faint">ON</span>
                  <TextInput
                    value={j.left}
                    onChange={(v) => patch({ joins: state.joins.map((x) => (x.id === j.id ? { ...x, left: v } : x)) })}
                    ariaLabel="Join left column"
                    className="w-[118px] shrink-0"
                  />
                  <span className="font-mono text-[11px] text-rose-300/80">=</span>
                  <TextInput
                    value={j.right}
                    onChange={(v) => patch({ joins: state.joins.map((x) => (x.id === j.id ? { ...x, right: v } : x)) })}
                    ariaLabel="Join right column"
                    className="w-[118px] shrink-0"
                  />
                  <button
                    type="button"
                    aria-label="Remove join"
                    onClick={() => patch({ joins: state.joins.filter((x) => x.id !== j.id) })}
                    className="ml-auto rounded p-1 text-faint hover:text-rose-300"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {state.joins.length === 0 ? (
                <button
                  type="button"
                  onClick={addJoin}
                  className="w-full rounded-lg border border-dashed border-line py-2 font-mono text-[11px] text-faint hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  + add a join
                </button>
              ) : null}
            </Clause>

            {/* WHERE */}
            <Clause
              id="where"
              icon={<Filter size={14} />}
              label="WHERE"
              sqlHint="row filters"
              tone="amber"
              count={state.wheres.length}
              active={state.wheres.length > 0}
              onAdd={addWhere}
              addLabel="Add filter"
            >
              {state.wheres.map((w, i) => {
                const type = columnTypeOf(`${w.table}.${w.column}`);
                const kind: WhereCond["kind"] =
                  w.op === "IS NULL" || w.op === "IS NOT NULL"
                    ? "null"
                    : w.op === "IN"
                      ? "list"
                      : type === "bigint" || type === "integer" || type === "numeric"
                        ? "number"
                        : type === "boolean"
                          ? "boolean"
                          : "text";
                const indexed = isIndexed(`${w.table}.${w.column}`, extraIndexes);
                return (
                  <div key={w.id} className="rounded-lg border border-line-soft bg-obsidian-2/70 px-1.5 py-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {i === 0 ? (
                        <span className="w-[52px] shrink-0 font-mono text-[10px] uppercase tracking-wide text-faint">where</span>
                      ) : (
                        <Select
                          value={w.conj}
                          ariaLabel="Conjunction"
                          className="w-[58px] shrink-0"
                          onChange={(v) =>
                            patch({ wheres: state.wheres.map((x) => (x.id === w.id ? { ...x, conj: v as "AND" | "OR" } : x)) })
                          }
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </Select>
                      )}
                      <ColumnRef
                        tables={availableTables}
                        table={w.table}
                        column={w.column}
                        showStar={false}
                        onTable={(t) =>
                          patch({
                            wheres: state.wheres.map((x) =>
                              x.id === w.id ? { ...x, table: t, column: TABLE_BY_NAME[t]?.columns[0]?.name ?? "id" } : x,
                            ),
                          })
                        }
                        onColumn={(c) => patch({ wheres: state.wheres.map((x) => (x.id === w.id ? { ...x, column: c } : x)) })}
                      />
                      <Select
                        value={w.op}
                        ariaLabel="Operator"
                        className="w-[86px] shrink-0"
                        onChange={(v) =>
                          patch({
                            wheres: state.wheres.map((x) => {
                              if (x.id !== w.id) return x;
                              const nextKind =
                                v === "IS NULL" || v === "IS NOT NULL" ? "null" : v === "IN" ? "list" : kind;
                              return { ...x, op: v, kind: nextKind };
                            }),
                          })
                        }
                      >
                        {OPS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                      {w.op !== "IS NULL" && w.op !== "IS NOT NULL" ? (
                        w.kind === "boolean" ? (
                          <Select
                            value={w.value || "true"}
                            ariaLabel="Value"
                            className="w-[74px] shrink-0"
                            onChange={(v) => patch({ wheres: state.wheres.map((x) => (x.id === w.id ? { ...x, value: v } : x)) })}
                          >
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </Select>
                        ) : (
                          <TextInput
                            value={w.value}
                            onChange={(v) =>
                              patch({
                                wheres: state.wheres.map((x) =>
                                  x.id === w.id
                                    ? { ...x, value: v, kind: v.includes(",") && x.op === "IN" ? "list" : kind }
                                    : x,
                                ),
                              })
                            }
                            placeholder={w.op === "LIKE" ? "%pattern%" : w.op === "IN" ? "a, b, c" : "value"}
                            ariaLabel="Filter value"
                            className="min-w-[84px] flex-1"
                          />
                        )
                      ) : (
                        <span className="flex-1 font-mono text-[10.5px] text-faint">NULL check</span>
                      )}
                      <span className="shrink-0" title={indexed ? "Indexed column" : "No index"}>
                        {indexed ? (
                          <Badge tone="emerald">
                            <CircleCheck size={9} /> idx
                          </Badge>
                        ) : (
                          <Badge tone="amber">
                            <TriangleAlert size={9} /> scan
                          </Badge>
                        )}
                      </span>
                      <button
                        type="button"
                        aria-label="Remove filter"
                        onClick={() => patch({ wheres: state.wheres.filter((x) => x.id !== w.id) })}
                        className="rounded p-1 text-faint hover:text-rose-300"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <p className="mt-1 pl-[56px] font-mono text-[10px] text-faint/80">
                      {w.table}.{w.column} {w.op} {quoteLiteral(w)}
                    </p>
                  </div>
                );
              })}
            </Clause>

            {/* GROUP BY */}
            <Clause
              id="groupby"
              icon={<Rows3 size={14} />}
              label="GROUP BY"
              sqlHint="aggregation buckets"
              tone="violet"
              count={state.groupBy.length}
              active={state.groupBy.length > 0}
            >
              {groupCandidates.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {groupCandidates.map((ref) => {
                    const on = state.groupBy.includes(ref);
                    return (
                      <button
                        key={ref}
                        type="button"
                        onClick={() => toggleGroupBy(ref)}
                        aria-pressed={on}
                        className={`rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors ${
                          on
                            ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                            : "border-line bg-obsidian-2/60 text-muted hover:border-violet-500/40 hover:text-violet-200"
                        }`}
                      >
                        {ref}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="font-mono text-[10.5px] text-faint">
                  add a raw (non-aggregate) column to SELECT to enable grouping
                </p>
              )}
              {state.groupBy.filter((g) => !groupCandidates.includes(g)).map((g) => (
                <div key={g} className="flex items-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1">
                  <span className="font-mono text-[10.5px] text-rose-300">{g} — not projected</span>
                  <button
                    type="button"
                    aria-label={`Remove ${g} from group by`}
                    onClick={() => patch({ groupBy: state.groupBy.filter((x) => x !== g) })}
                    className="ml-auto text-rose-300/70 hover:text-rose-200"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-1.5">
                <span className="font-mono text-[10px] uppercase tracking-wide text-faint">having</span>
                {state.having.map((h) => (
                  <div key={h.id} className="flex items-center gap-1 rounded border border-line bg-obsidian-2/70 px-1 py-1">
                    <Select
                      value={h.agg}
                      ariaLabel="Having aggregate"
                      className="w-[74px]"
                      onChange={(v) =>
                        patch({ having: state.having.map((x) => (x.id === h.id ? { ...x, agg: v as AggFn } : x)) })
                      }
                    >
                      {(["COUNT", "SUM", "AVG", "MIN", "MAX"] as AggFn[]).map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      value={h.column}
                      onChange={(v) => patch({ having: state.having.map((x) => (x.id === h.id ? { ...x, column: v } : x)) })}
                      ariaLabel="Having column"
                      className="w-[96px]"
                    />
                    <Select
                      value={h.op}
                      ariaLabel="Having operator"
                      className="w-[54px]"
                      onChange={(v) => patch({ having: state.having.map((x) => (x.id === h.id ? { ...x, op: v } : x)) })}
                    >
                      {[">", ">=", "<", "=", "<>"].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                    <TextInput
                      value={h.value}
                      onChange={(v) => patch({ having: state.having.map((x) => (x.id === h.id ? { ...x, value: v } : x)) })}
                      ariaLabel="Having value"
                      className="w-[64px]"
                    />
                    <button
                      type="button"
                      aria-label="Remove having term"
                      onClick={() => patch({ having: state.having.filter((x) => x.id !== h.id) })}
                      className="p-0.5 text-faint hover:text-rose-300"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHaving}
                  className="rounded border border-line bg-obsidian-2/60 px-1.5 py-1 font-mono text-[10px] text-faint hover:text-violet-200"
                >
                  + HAVING
                </button>
              </div>
            </Clause>

            {/* ORDER BY + LIMIT */}
            <Clause
              id="orderby"
              icon={<ArrowDownUp size={14} />}
              label="ORDER BY"
              sqlHint="sort + limit"
              tone="emerald"
              count={state.orderBy.length}
              active={state.orderBy.length > 0}
              onAdd={addOrder}
              addLabel="Add sort"
            >
              {state.orderBy.map((o, i) => (
                <div key={o.id} className="flex items-center gap-1 rounded-lg border border-line-soft bg-obsidian-2/70 px-1.5 py-1.5">
                  <span className="w-4 font-mono text-[10px] text-faint">{i + 1}</span>
                  <TextInput
                    value={o.expr}
                    onChange={(v) => patch({ orderBy: state.orderBy.map((x) => (x.id === o.id ? { ...x, expr: v } : x)) })}
                    ariaLabel="Sort expression"
                    placeholder="column or alias"
                    className="min-w-0 flex-1"
                  />
                  <Select
                    value={o.dir}
                    ariaLabel="Sort direction"
                    className="w-[70px] shrink-0"
                    onChange={(v) =>
                      patch({ orderBy: state.orderBy.map((x) => (x.id === o.id ? { ...x, dir: v as "ASC" | "DESC" } : x)) })
                    }
                  >
                    <option value="ASC">ASC</option>
                    <option value="DESC">DESC</option>
                  </Select>
                  <button
                    type="button"
                    aria-label="Remove sort"
                    onClick={() => patch({ orderBy: state.orderBy.filter((x) => x.id !== o.id) })}
                    className="p-1 text-faint hover:text-rose-300"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 rounded-lg border border-line-soft bg-obsidian-2/70 px-2 py-1.5">
                <span className="font-mono text-[10.5px] uppercase tracking-wide text-faint">limit</span>
                <TextInput
                  value={state.limit === null ? "" : String(state.limit)}
                  onChange={(v) => {
                    const n = v.replace(/[^0-9]/g, "");
                    patch({ limit: n === "" ? null : Math.min(1000, Number(n)) });
                  }}
                  placeholder="none"
                  ariaLabel="Row limit"
                  className="w-[86px]"
                />
                <div className="ml-auto flex items-center gap-1">
                  {[10, 50, 100].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => patch({ limit: n })}
                      className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                        state.limit === n
                          ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                          : "border-line text-faint hover:text-emerald-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </Clause>
          </div>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT: SQL + results                                             */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="flex min-h-[340px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex items-center gap-1 rounded-lg bg-obsidian-2/80 p-0.5 ring-1 ring-inset ring-line">
              <button
                type="button"
                onClick={() => setPanel("sql")}
                className={`rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                  panel === "sql" ? "bg-panel-3 text-white shadow" : "text-faint hover:text-slate-200"
                }`}
              >
                generated.sql
              </button>
              <button
                type="button"
                onClick={() => setPanel("checks")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] transition-colors ${
                  panel === "checks" ? "bg-panel-3 text-white shadow" : "text-faint hover:text-slate-200"
                }`}
              >
                checks
                {errCount > 0 ? (
                  <span className="rounded bg-rose-500/25 px-1 text-[9.5px] text-rose-200">{errCount}</span>
                ) : warnCount > 0 ? (
                  <span className="rounded bg-amber-500/25 px-1 text-[9.5px] text-amber-200">{warnCount}</span>
                ) : (
                  <span className="rounded bg-emerald-500/20 px-1 text-[9.5px] text-emerald-200">
                    <Check size={9} className="inline" />
                  </span>
                )}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <IconButton icon={copied ? Check : Copy} title="Copy SQL" onClick={copy} tone="violet" />
              <Button variant="outline" size="sm" icon={Wand2} onClick={onFormat} title="Format SQL">
                Format
              </Button>
              <Button variant="primary" size="sm" icon={Play} onClick={onRun} disabled={busy}>
                {busy ? "Running…" : "Execute"}
              </Button>
            </div>
          </div>

          {panel === "sql" ? (
            <div className="relative flex-1 overflow-auto bg-[#080d18]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
              <div className="flex min-h-full">
                <div aria-hidden className="select-none border-r border-line/70 px-2 py-3 text-right font-mono text-[11px] leading-[1.65] text-faint/50">
                  {sql.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre className="min-w-0 flex-1 overflow-x-auto px-3 py-3">
                  <SqlHighlight sql={sql} />
                </pre>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-1.5 overflow-auto p-3">
              {problems.length === 0 ? (
                <EmptyState
                  icon={Info}
                  title="No checks run yet"
                  description="Execute the query to validate syntax, grouping rules and index coverage."
                />
              ) : (
                problems.map((p, i) => {
                  const s =
                    p.severity === "error"
                      ? { box: "border-rose-500/25 bg-rose-500/[0.06]", icon: "text-rose-400", text: "text-rose-200", sev: "text-rose-400/70" }
                      : p.severity === "warning"
                        ? { box: "border-amber-500/25 bg-amber-500/[0.06]", icon: "text-amber-400", text: "text-amber-200", sev: "text-amber-400/70" }
                        : { box: "border-emerald-500/25 bg-emerald-500/[0.06]", icon: "text-emerald-400", text: "text-emerald-200", sev: "text-emerald-400/70" };
                  const Icon = p.severity === "info" ? CircleCheck : TriangleAlert;
                  return (
                    <div key={i} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${s.box}`}>
                      <Icon size={14} className={`mt-0.5 shrink-0 ${s.icon}`} />
                      <div className="min-w-0">
                        <p className={`font-mono text-[11.5px] ${s.text}`}>{p.message}</p>
                        {p.hint ? <p className="mt-0.5 text-[11px] text-muted">{p.hint}</p> : null}
                      </div>
                      <span className={`ml-auto shrink-0 font-mono text-[9.5px] uppercase ${s.sev}`}>{p.severity}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line bg-obsidian-2/60 px-3 py-1.5 font-mono text-[10px] text-faint">
            <span className="flex items-center gap-1">
              <span className={`size-1.5 rounded-full ${errCount ? "bg-rose-400" : "bg-emerald-400"}`} />
              {errCount ? `${errCount} error${errCount > 1 ? "s" : ""}` : "syntax ok"}
            </span>
            <span>·</span>
            <span>{sql.split("\n").length} lines</span>
            <span>·</span>
            <span>{sql.length} chars</span>
            <span className="ml-auto hidden sm:inline">postgres 16 · read-only session</span>
          </div>
        </Card>

        {/* results */}
        <ResultsPanel execution={execution} busy={busy} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function MetricsStrip({ execution }: { execution: ExecutionResult }) {
  const { latencyMs, rowCount, plan, bytes } = execution;
  const latencyTone: Tone = latencyMs < 20 ? "emerald" : latencyMs < 80 ? "amber" : "rose";
  const items = [
    { icon: Clock3, label: "latency", value: `${latencyMs.toFixed(1)} ms`, tone: latencyTone },
    { icon: Rows3, label: "rows", value: rowCount.toLocaleString(), tone: "violet" as Tone },
    { icon: Gauge, label: "plan cost", value: plan.totalCost.toFixed(1), tone: plan.totalCost < 400 ? "emerald" : "amber" },
    { icon: HardDrive, label: "payload", value: `${(bytes / 1024).toFixed(1)} kB`, tone: "cyan" as Tone },
    { icon: Sigma, label: "nodes", value: String(plan.nodes.length), tone: plan.usesSeqScan ? "amber" : "emerald" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg border border-line bg-panel-2/40 px-2 py-1.5">
          <div className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wide text-faint">
            <it.icon size={10} className="text-slate-500" />
            {it.label}
          </div>
          <p className={`mt-0.5 font-mono text-[13px] font-semibold ${
            it.tone === "emerald" ? "text-emerald-300" : it.tone === "amber" ? "text-amber-300" : it.tone === "rose" ? "text-rose-300" : it.tone === "cyan" ? "text-cyan-300" : "text-violet-300"
          }`}>
            {it.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function CellValue({ value }: { value: Row[string] }) {
  if (value === null || value === undefined) return <span className="italic text-faint/60">NULL</span>;
  if (typeof value === "boolean")
    return (
      <span className={value ? "text-emerald-300" : "text-rose-300"}>{String(value)}</span>
    );
  if (typeof value === "number")
    return <span className="text-amber-200/90">{Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2)}</span>;
  return <span className="text-slate-200">{value}</span>;
}

function ResultsPanel({ execution, busy }: { execution: ExecutionResult | null; busy: boolean }) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    if (!execution) return [];
    if (!sortKey) return execution.rows;
    return [...execution.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [execution, sortKey, sortDir]);

  return (
    <Card className="flex min-h-[300px] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <SectionTitle
          icon={Rows3}
          title="Result Set"
          subtitle={execution ? `${execution.rowCount} rows returned` : "run a query to simulate execution"}
        />
        <div className="flex items-center gap-1.5">
          {execution && !execution.error ? (
            <>
              <Badge tone={execution.latencyMs < 20 ? "emerald" : "amber"}>
                <Clock3 size={10} /> {execution.latencyMs.toFixed(1)}ms
              </Badge>
              {execution.cacheHit ? <Badge tone="cyan">cache hit</Badge> : <Badge tone="slate">cold</Badge>}
            </>
          ) : null}
        </div>
      </div>

      {busy ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-14">
          <div className="relative h-1 w-40 overflow-hidden rounded bg-panel-3">
            <div className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-violet-400 to-transparent" />
          </div>
          <p className="font-mono text-[11px] text-faint">executing plan…</p>
        </div>
      ) : !execution ? (
        <EmptyState
          icon={Play}
          title="No results yet"
          description="Hit Execute or press ⌘/Ctrl + Enter to simulate the query against the sample database."
        />
      ) : execution.error ? (
        <div className="flex flex-1 flex-col items-start gap-2 p-4">
          <div className="flex w-full items-start gap-2 rounded-lg border border-rose-500/35 bg-rose-500/[0.08] px-3 py-2.5">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-rose-400" />
            <div className="min-w-0">
              <p className="font-mono text-[12px] font-semibold text-rose-200">ERROR: {execution.error}</p>
              <p className="mt-1 font-mono text-[10.5px] text-rose-300/70">
                {execution.problems.find((p) => p.severity === "error")?.hint ?? "Fix the query and re-run."}
              </p>
            </div>
          </div>
          <pre className="w-full overflow-x-auto rounded-lg border border-line bg-obsidian-2 p-2.5 font-mono text-[10.5px] leading-relaxed text-faint">
{`LINE 1: ...
        ^
SQL state: 42601  Character: 1
Hint: check clause order — SELECT → FROM → JOIN → WHERE → GROUP BY → ORDER BY`}
          </pre>
        </div>
      ) : (
        <>
          <div className="qp-scroll-x flex-1">
            <table className="qp-table-grid w-full min-w-[420px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr>
                  <th className="w-10 px-2 py-1.5 text-right font-mono text-[9.5px] font-medium uppercase tracking-wider text-faint">#</th>
                  {execution.columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-2.5 py-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortKey === c) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                          else {
                            setSortKey(c);
                            setSortDir("asc");
                          }
                        }}
                        className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-400 hover:text-violet-300"
                      >
                        {c}
                        <ArrowDownUp size={9} className={sortKey === c ? "text-violet-400" : "text-faint/50"} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="group transition-colors hover:bg-violet-500/[0.05]">
                    <td className="px-2 py-1 text-right font-mono text-[10px] text-faint/50">{i + 1}</td>
                    {execution.columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-2.5 py-1 font-mono text-[11.5px]">
                        <CellValue value={r[c] ?? null} />
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={execution.columns.length + 1} className="px-3 py-8 text-center font-mono text-[11px] text-faint">
                      0 rows — the predicate matched nothing
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line bg-obsidian-2/60 px-3 py-1.5">
            <MetricsStrip execution={execution} />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <p className="font-mono text-[10.5px] text-emerald-300/90">
                Query executed in {execution.latencyMs.toFixed(0)}ms ({execution.rowsAffected} rows affected)
              </p>
              {execution.plan.usesSeqScan ? (
                <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-amber-300/90">
                  <TriangleAlert size={10} /> sequential scan — see Index Advisor
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-faint">
                  <Check size={10} className="text-emerald-400" /> all filters index-backed
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

