import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Database, X } from "lucide-react";
import { Header, TABS, type TabKey } from "./components/Header";
import { QueryEditor } from "./components/QueryEditor";
import { SchemaExplorer } from "./components/SchemaExplorer";
import { PlanAnalyzer } from "./components/PlanAnalyzer";
import { SqlEditor } from "./components/SqlEditor";
import { Button, ToastStack, type ToastMsg } from "./components/ui";
import {
  buildPlan,
  buildSql,
  DEFAULT_QUERY,
  parseSqlToQuery,
  runQuery,
  runRawSql,
  SAMPLE_QUERIES,
  type ExecutionResult,
  type IndexSet,
  type QueryState,
} from "./lib/query";
import { formatSql } from "./lib/sql";
import { TABLES, TABLE_BY_NAME } from "./data/schema";

export default function App() {
  const [tab, setTab] = useState<TabKey>("builder");
  const [query, setQuery] = useState<QueryState>(DEFAULT_QUERY);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [editorSql, setEditorSql] = useState(() => formatSql(buildSql(DEFAULT_QUERY, true)));
  const [selectedTable, setSelectedTable] = useState("orders");
  const [appliedIndexes, setAppliedIndexes] = useState<{ ddl: string; refs: string[]; label: string }[]>([]);
  const extraIndexes: IndexSet = useMemo(() => new Set(appliedIndexes.flatMap((a) => a.refs)), [appliedIndexes]);
  const [ranAt, setRanAt] = useState(0);
  const sqlTouchedRef = useRef(false);

  const toast = useCallback((tone: ToastMsg["tone"], title: string, description?: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, tone, title, description }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const dismiss = (id: string) => setToasts((t) => t.filter((x) => x.id !== id));

  const patch = (p: Partial<QueryState>) => {
    sqlTouchedRef.current = false;
    setQuery((q) => ({ ...q, ...p }));
  };

  const generatedSql = useMemo(() => formatSql(buildSql(query, true)), [query]);

  // keep the editor buffer in sync with the builder unless the user edited it manually
  useEffect(() => {
    if (!sqlTouchedRef.current) setEditorSql(generatedSql);
  }, [generatedSql]);

  const executeBuilder = useCallback(
    async (silent = false) => {
      setBusy(true);
      try {
        const result = await runQuery(query, { extraIndexes });
        setExecution(result);
        setRanAt(Date.now());
        if (result.error) {
          toast("error", "Query failed", result.error);
        } else if (!silent) {
          toast("success", `Query executed in ${result.latencyMs.toFixed(0)}ms`, `${result.rowCount} rows returned · ${result.rowsAffected} rows affected`);
        }
      } finally {
        setBusy(false);
      }
    },
    [query, toast, extraIndexes],
  );

  const executeRaw = useCallback(
    async (sql: string) => {
      setBusy(true);
      try {
        const result = await runRawSql(sql);
        setExecution(result);
        if (result.error) toast("error", "Query failed", result.error);
        else toast("success", `Executed in ${result.latencyMs.toFixed(1)}ms`, `${result.rowCount} rows · cold cache`);
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const runPlan = () => {
    const previous = buildPlan(query, extraIndexes);
    setTab("plan");
    setRanAt(Date.now());
    toast(
      previous.usesSeqScan ? "warn" : "info",
      `Execution plan built — cost ${previous.totalCost.toFixed(1)}`,
      `${previous.nodes.length} nodes · ${
        previous.usesSeqScan ? `${previous.indexMisses.length || 1} unindexed predicate(s)` : "all scans index-backed"
      }`,
    );
  };

  const loadSample = () => {
    const sample = SAMPLE_QUERIES[0]!;
    setQuery(sample.state);
    sqlTouchedRef.current = false;
    setSelectedTable(sample.state.baseTable);
    setExecution(null);
    toast("success", "Sample database loaded", "4 relations · 158k rows · 12 indexes ready for querying");
  };

  const formatCurrent = () => {
    if (tab === "editor") {
      setEditorSql(formatSql(editorSql));
      toast("info", "Query formatted", "Clause boundaries, indentation and boolean chains normalised.");
    } else {
      setQuery((q) => ({ ...q }));
      toast("info", "Query formatted", "Builder output re-rendered with canonical formatting.");
    }
  };

  const useTable = (name: string) => {
    const table = TABLE_BY_NAME[name]!;
    const next: QueryState = {
      baseTable: name,
      distinct: false,
      selectFields: table.columns.slice(0, 3).map((c, i) => ({
        id: `sf-t-${i}`,
        table: name,
        column: c.name,
        agg: null,
        alias: "",
      })),
      joins: [],
      wheres: [],
      groupBy: [],
      having: [],
      orderBy: [],
      limit: 50,
      cte: { enabled: false, name: "recent_orders", filter: "" },
    };
    setQuery(next);
    sqlTouchedRef.current = false;
    setSelectedTable(name);
    setExecution(null);
    setTab("builder");
    toast("info", `Querying public.${name}`, `${table.rows.toLocaleString()} rows · ${table.columns.length} columns projected into SELECT`);
  };

  const applyIndex = (ddl: string, label: string, refs: string[]) => {
    if (appliedIndexes.some((a) => a.ddl === ddl)) return;
    setAppliedIndexes((a) => [...a, { ddl, refs, label }]);
    setRanAt(Date.now());
    toast("success", `Index created on ${label}`, "CONCURRENTLY · planner re-costed the statement with the new access path.");
  };

  const handleEditorRun = (sql: string) => {
    sqlTouchedRef.current = true;
    void executeRaw(sql);
  };

  const pushToBuilder = (sql: string) => {
    const parsed = parseSqlToQuery(sql);
    if (!parsed) {
      toast("error", "Could not map SQL to builder blocks", "Only single SELECT statements over the sample schema are supported.");
      return;
    }
    setQuery(parsed);
    setSelectedTable(parsed.baseTable);
    sqlTouchedRef.current = false;
    setExecution(null);
    setTab("builder");
    toast(
      "success",
      "SQL parsed into builder blocks",
      `${parsed.selectFields.length} projections · ${parsed.joins.length} join(s) · ${parsed.wheres.length} filter(s)`,
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (tab === "editor") void executeRaw(editorSql);
        else void executeBuilder();
      }
      if (e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        formatCurrent();
      }
      if (e.key.toLowerCase() === "k" && !e.shiftKey) {
        e.preventDefault();
        loadSample();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, editorSql, executeRaw, executeBuilder]);

  const activeTab = TABS.find((t) => t.key === tab)!;
  const plan = useMemo(() => buildPlan(query, extraIndexes), [query, extraIndexes, ranAt]);

  // initial simulated execution so the workspace is never empty
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await runQuery(DEFAULT_QUERY, { cached: true });
      if (!cancelled) setExecution(r);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // re-execute against the live cache whenever the query or index set changes
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const r = await runQuery(query, { cached: true, extraIndexes });
      if (!cancelled) setExecution(r);
    }, 420);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, extraIndexes]);

  return (
    <div className="qp-grid-bg min-h-dvh bg-obsidian">
      <Header
        tab={tab}
        onTab={setTab}
        onLoadSample={loadSample}
        onFormat={formatCurrent}
        onRunPlan={runPlan}
        latency={execution && !execution.error ? execution.latencyMs : null}
        busy={busy}
      />

      <main className="mx-auto w-full max-w-[1560px] px-3 pb-10 pt-3 sm:px-5">
        {/* status ribbon */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel/70 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-md bg-violet-500/15 text-violet-300">
              <Database size={13} />
            </span>
            <div className="leading-tight">
              <p className="font-mono text-[11px] text-slate-200">
                {activeTab.label}
                <span className="text-faint"> / sample_ecommerce</span>
              </p>
              <p className="hidden font-mono text-[9.5px] text-faint sm:block">
                {TABLES.length} relations · {TABLES.reduce((a, t) => a + t.columns.length, 0)} columns ·{" "}
                {TABLES.reduce((a, t) => a + t.indexes.length, 0)} indexes · ~{plan.scannedRows.toLocaleString()} rows scanned
              </p>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="hidden rounded border border-line bg-obsidian-2/70 px-1.5 py-0.5 font-mono text-[10px] text-faint md:inline">
              base: <span className="text-violet-300">{query.baseTable}</span>
            </span>
            <span className="rounded border border-line bg-obsidian-2/70 px-1.5 py-0.5 font-mono text-[10px] text-faint">
              plan cost: <span className={plan.totalCost < 400 ? "text-emerald-300" : "text-amber-300"}>{plan.totalCost.toFixed(1)}</span>
            </span>
            <span className="hidden rounded border border-line bg-obsidian-2/70 px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline">
              latency:{" "}
              <span
                className={
                  execution && !execution.error
                    ? execution.latencyMs < 20
                      ? "text-emerald-300"
                      : "text-amber-300"
                    : "text-faint"
                }
              >
                {execution && !execution.error ? `${execution.latencyMs.toFixed(1)}ms` : "—"}
              </span>
            </span>
            <span className="hidden rounded border border-line bg-obsidian-2/70 px-1.5 py-0.5 font-mono text-[10px] text-faint lg:inline">
              indexes added: <span className="text-cyan-300">{appliedIndexes.length}</span>
            </span>
          </div>
        </div>

        {tab === "builder" ? (
          <QueryEditor
            state={query}
            patch={patch}
            execution={execution}
            busy={busy}
            onRun={() => void executeBuilder()}
            onFormat={formatCurrent}
            extraIndexes={extraIndexes}
          />
        ) : null}

        {tab === "editor" ? (
          <SqlEditor
            state={query}
            sql={editorSql}
            setSql={(v) => {
              sqlTouchedRef.current = true;
              setEditorSql(v);
            }}
            execution={execution}
            busy={busy}
            onRun={handleEditorRun}
            onPushBuilder={pushToBuilder}
          />
        ) : null}

        {tab === "schema" ? (
          <SchemaExplorer selected={selectedTable} onSelect={setSelectedTable} onUseTable={useTable} />
        ) : null}

        {tab === "plan" ? (
          <PlanAnalyzer
            state={query}
            onRun={() => void executeBuilder(true)}
            serviceBusy={busy}
            onApplyIndex={applyIndex}
            appliedIndexes={appliedIndexes.map((a) => a.ddl)}
            extraIndexes={extraIndexes}
            ranAt={ranAt}
          />
        ) : null}

        <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 font-mono text-[10px] text-faint">
          <span>
            QueryPulse · interactive SQL workspace · simulated PostgreSQL 16 planner
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-line px-1">⌘</kbd>
            <kbd className="rounded border border-line px-1">↵</kbd> execute ·
            <kbd className="rounded border border-line px-1">⌘</kbd>
            <kbd className="rounded border border-line px-1">K</kbd> sample data
          </span>
        </footer>
      </main>

      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* mobile floating run button */}
      <div className="fixed inset-x-3 bottom-3 z-30 md:hidden">
        <Button
          variant="primary"
          icon={busy ? X : Database}
          className="w-full shadow-2xl"
          onClick={() => void (tab === "editor" ? executeRaw(editorSql) : executeBuilder())}
          disabled={busy}
        >
          {busy ? "Executing…" : tab === "editor" ? "Run SQL" : "Execute Query"}
        </Button>
      </div>
    </div>
  );
}
