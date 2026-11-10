import { useEffect, useMemo, useRef, useState } from "react";
import {
  Play,
  Wand2,
  Copy,
  Check,
  TriangleAlert,
  CircleCheck,
  Info,
  Terminal,
  Braces,
  Clock3,
  History,
  FileCode2,
  RotateCcw,
  Sparkles,
  ArrowDownUp,
  Sigma,
  Layers,
  Gauge,
  Database,
} from "lucide-react";
import { lintSql, SAMPLE_QUERIES, buildSql } from "../lib/query";
import type { ExecutionResult, Problem, QueryState } from "../lib/query";
import { formatSql, tokenize, TOKEN_CLASS } from "../lib/sql";
import { Badge, Button, Card, SectionTitle, type Tone } from "./ui";

interface HistoryEntry {
  id: string;
  sql: string;
  latency: number;
  rows: number;
  at: string;
  ok: boolean;
}

export function SqlEditor({
  state,
  sql,
  setSql,
  execution,
  busy,
  onRun,
  onPushBuilder,
}: {
  state: QueryState;
  sql: string;
  setSql: (v: string) => void;
  execution: ExecutionResult | null;
  busy: boolean;
  onRun: (raw: string) => void;
  onPushBuilder: (sql: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [editorHeight, setEditorHeight] = useState(380);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutRef = useRef<HTMLDivElement>(null);
  const lastRunRef = useRef<string>("");

  const problems: Problem[] = useMemo(() => lintSql(sql), [sql]);
  const errCount = problems.filter((p) => p.severity === "error").length;
  const warnCount = problems.filter((p) => p.severity === "warning").length;
  const tokens = useMemo(() => tokenize(sql), [sql]);
  const lineCount = sql.split("\n").length;

  const sortedRows = useMemo(() => {
    if (!execution || !sortKey) return execution?.rows ?? [];
    const dir = 1;
    return [...execution.rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : Number(av);
      const bn = typeof bv === "number" ? bv : Number(bv);
      const cmp = !Number.isNaN(an) && !Number.isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [execution, sortKey]);

  useEffect(() => {
    const el = areaRef.current;
    const pre = preRef.current;
    if (!el || !pre) return;
    const sync = () => {
      pre.scrollTop = el.scrollTop;
      pre.scrollLeft = el.scrollLeft;
      if (gutRef.current) gutRef.current.scrollTop = el.scrollTop;
    };
    el.addEventListener("scroll", sync);
    sync();
    return () => el.removeEventListener("scroll", sync);
  }, [sql]);

  const run = () => {
    onRun(sql);
    if (sql !== lastRunRef.current) {
      lastRunRef.current = sql;
      setHistory((h) =>
        [
          {
            id: `${Date.now()}`,
            sql: sql.trim().split("\n")[0]!.slice(0, 70),
            latency: Math.max(0.4, (execution?.latencyMs ?? 0) || Number((8 + Math.random() * 40).toFixed(1))),
            rows: execution?.rowCount ?? 0,
            at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            ok: errCount === 0,
          },
          ...h,
        ].slice(0, 6),
      );
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "Enter") {
      e.preventDefault();
      run();
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
      e.preventDefault();
      setSql(formatSql(sql));
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = `${sql.slice(0, start)}  ${sql.slice(end)}`;
      setSql(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  const toneOf = (p: Problem): { tone: Tone; icon: typeof Info } =>
    p.severity === "error"
      ? { tone: "rose", icon: TriangleAlert }
      : p.severity === "warning"
        ? { tone: "amber", icon: TriangleAlert }
        : { tone: "emerald", icon: CircleCheck };

  const plan = execution?.plan;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="flex flex-col overflow-hidden">
          {/* toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-violet-500/15 text-violet-300">
                <Terminal size={13} />
              </span>
              <span className="font-mono text-[11.5px] text-slate-200">query.sql</span>
              <Badge tone={errCount ? "rose" : warnCount ? "amber" : "emerald"}>
                {errCount ? `${errCount} error${errCount > 1 ? "s" : ""}` : warnCount ? `${warnCount} warning${warnCount > 1 ? "s" : ""}` : "valid"}
              </Badge>
              <span className="hidden font-mono text-[10px] text-faint sm:inline">{lineCount} lines</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" icon={copied ? Check : Copy} onClick={copy}>
                <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
              </Button>
              <Button size="sm" variant="outline" icon={Wand2} onClick={() => setSql(formatSql(sql))}>
                <span className="hidden sm:inline">Format</span>
              </Button>
              <Button size="sm" variant="subtle" icon={Braces} onClick={() => onPushBuilder(sql)}>
                <span className="hidden sm:inline">To Builder</span>
              </Button>
              <Button size="sm" variant="primary" icon={Play} onClick={run} disabled={busy}>
                {busy ? "Running…" : "Run"}
              </Button>
            </div>
          </div>

          {/* editor */}
          <div className="relative flex overflow-hidden bg-[#080d18]" style={{ height: editorHeight }}>
            <div
              ref={gutRef}
              aria-hidden
              className="qp-no-scrollbar w-10 shrink-0 overflow-hidden border-r border-line/70 bg-[#070c16] py-2.5 text-right font-mono text-[11.5px] leading-[1.6] text-faint/50"
            >
              {Array.from({ length: Math.max(lineCount, 16) }, (_, i) => (
                <div key={i} className="px-1.5">
                  {i + 1}
                </div>
              ))}
            </div>
            <div className="relative min-w-0 flex-1">
              <pre
                ref={preRef}
                aria-hidden
                className="qp-code pointer-events-none absolute inset-0 overflow-auto whitespace-pre px-3 py-2.5 text-[12.5px] leading-[1.6]"
              >
                {tokens.map((t, i) => (
                  <span key={i} className={TOKEN_CLASS[t.type]}>
                    {t.value}
                  </span>
                ))}
                {"\n\n"}
              </pre>
              <textarea
                ref={areaRef}
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                aria-label="SQL editor"
                className="qp-code absolute inset-0 size-full resize-none overflow-auto whitespace-pre bg-transparent px-3 py-2.5 text-[12.5px] leading-[1.6] text-transparent caret-violet-300 outline-none selection:bg-violet-500/30"
              />
            </div>
          </div>

          {/* resize handle */}
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize editor"
            tabIndex={0}
            onPointerDown={(e) => {
              const startY = e.clientY;
              const startH = editorHeight;
              const move = (ev: PointerEvent) => {
                setEditorHeight(Math.max(160, Math.min(720, startH + (ev.clientY - startY))));
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
              };
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
            className="group flex h-2 cursor-row-resize items-center justify-center border-y border-line bg-obsidian-2/60 hover:bg-violet-500/10"
          >
            <span className="h-0.5 w-8 rounded-full bg-line group-hover:bg-violet-400/70" />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-obsidian-2/60 px-3 py-1.5 font-mono text-[10px] text-faint">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line px-1">⌘</kbd>+<kbd className="rounded border border-line px-1">↵</kbd> run
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-line px-1">⌘</kbd>+
              <kbd className="rounded border border-line px-1">⇧</kbd>+
              <kbd className="rounded border border-line px-1">F</kbd> format
            </span>
            <span className="ml-auto">
              {execution && !execution.error
                ? `last run · ${execution.latencyMs.toFixed(1)}ms · ${execution.rowCount} rows`
                : "idle"}
            </span>
          </div>
        </Card>

        {/* results */}
        <Card className="flex flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
            <SectionTitle
              icon={Terminal}
              title="Result Set"
              subtitle={
                execution
                  ? execution.error
                    ? "statement failed"
                    : `${execution.rowCount} rows · ${execution.columns.length} columns`
                  : "no statement executed"
              }
              tone={execution?.error ? "rose" : "emerald"}
            />
            {execution && !execution.error ? (
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="emerald">
                  <Check size={9} /> success
                </Badge>
                <Badge tone={execution.latencyMs < 20 ? "emerald" : "amber"}>
                  <Clock3 size={9} /> {execution.latencyMs.toFixed(1)}ms
                </Badge>
                <Badge tone="violet">
                  <Sigma size={9} /> cost {execution.plan.totalCost.toFixed(0)}
                </Badge>
              </div>
            ) : null}
          </div>

          {busy ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <div className="relative h-1 w-40 overflow-hidden rounded bg-panel-3">
                <div className="absolute inset-y-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
              </div>
              <p className="font-mono text-[11px] text-faint">awaiting server…</p>
            </div>
          ) : !execution ? (
            <pre className="qp-code m-2.5 rounded-lg border border-line bg-[#080d18] p-2.5 text-[11px] leading-relaxed text-faint">
{`-- QueryPulse SQL console
-- Try: SELECT status, SUM(total) FROM orders GROUP BY status;
-- Read-only session · statement timeout 5s`}
            </pre>
          ) : execution.error ? (
            <div className="m-2.5 space-y-2">
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/[0.07] p-2.5">
                <p className="font-mono text-[12px] font-semibold text-rose-200">ERROR: {execution.error}</p>
                <p className="mt-1 font-mono text-[10.5px] text-rose-300/70">
                  {execution.problems.find((p) => p.severity === "error")?.hint ?? "Review the statement and try again."}
                </p>
              </div>
              <pre className="qp-code overflow-x-auto rounded-lg border border-line bg-[#080d18] p-2.5 text-[10.5px] leading-relaxed text-faint">
{`LINE 1: …
        ^
SQLSTATE: 42601
HINT: clause order is SELECT → FROM → JOIN → WHERE → GROUP BY → HAVING → ORDER BY → LIMIT`}
              </pre>
            </div>
          ) : (
            <>
              <div className="qp-scroll-x max-h-[300px] overflow-y-auto">
                <table className="qp-table-grid w-full min-w-[380px] text-left">
                  <thead className="sticky top-0 z-10 bg-panel">
                    <tr>
                      <th className="w-9 px-2 py-1.5 text-right font-mono text-[9px] uppercase tracking-wider text-faint">#</th>
                      {execution.columns.map((c) => (
                        <th key={c} className="whitespace-nowrap px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => setSortKey((k) => (k === c ? null : c))}
                            className="flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-wider text-faint hover:text-violet-300"
                          >
                            {c}
                            <ArrowDownUp size={9} className={sortKey === c ? "text-violet-400" : "text-faint/50"} />
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-violet-500/[0.05]">
                        <td className="px-2 py-1 text-right font-mono text-[10px] text-faint/50">{i + 1}</td>
                        {execution.columns.map((c) => (
                          <td key={c} className="whitespace-nowrap px-2.5 py-1 font-mono text-[11px] text-slate-300">
                            {r[c] === null || r[c] === undefined ? (
                              <span className="italic text-faint/60">NULL</span>
                            ) : typeof r[c] === "number" ? (
                              <span className="text-amber-200/90">{String(r[c])}</span>
                            ) : (
                              String(r[c])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-obsidian-2/60 px-3 py-1.5">
                <p className="font-mono text-[10.5px] text-emerald-300/90">
                  Query executed in {execution.latencyMs.toFixed(0)}ms ({execution.rowsAffected} rows affected)
                </p>
                <span className="ml-auto font-mono text-[10px] text-faint">
                  {(execution.bytes / 1024).toFixed(1)} kB · {execution.plan.nodes.length} plan nodes
                </span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* sidebar */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="overflow-hidden">
          <div className="border-b border-line px-3 py-2">
            <SectionTitle
              icon={TriangleAlert}
              title="Diagnostics"
              subtitle={`${problems.length} message(s) from the analyzer`}
              tone={errCount ? "rose" : warnCount ? "amber" : "emerald"}
              right={<Badge tone={errCount ? "rose" : warnCount ? "amber" : "emerald"}>{problems.length}</Badge>}
            />
          </div>
          <div className="max-h-[250px] space-y-1.5 overflow-auto p-2.5">
            {problems.map((p, i) => {
              const { tone, icon: Icon } = toneOf(p);
              const box =
                tone === "rose"
                  ? "border-rose-500/25 bg-rose-500/[0.06]"
                  : tone === "amber"
                    ? "border-amber-500/25 bg-amber-500/[0.06]"
                    : "border-emerald-500/25 bg-emerald-500/[0.06]";
              const text = tone === "rose" ? "text-rose-200" : tone === "amber" ? "text-amber-200" : "text-emerald-200";
              const ic = tone === "rose" ? "text-rose-400" : tone === "amber" ? "text-amber-400" : "text-emerald-400";
              return (
                <div key={i} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${box}`}>
                  <Icon size={13} className={`mt-0.5 shrink-0 ${ic}`} />
                  <div className="min-w-0">
                    <p className={`font-mono text-[11px] ${text}`}>{p.message}</p>
                    {p.hint ? <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted">{p.hint}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {plan ? (
          <Card className="p-3">
            <SectionTitle icon={Gauge} title="Plan Snapshot" subtitle="top node of the executed plan" tone="violet" />
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between rounded border border-line-soft bg-obsidian-2/50 px-2 py-1">
                <span className="font-mono text-[10px] text-faint">root node</span>
                <span className="font-mono text-[10.5px] text-violet-300">{plan.root.kind}</span>
              </div>
              <div className="flex items-center justify-between rounded border border-line-soft bg-obsidian-2/50 px-2 py-1">
                <span className="font-mono text-[10px] text-faint">total cost</span>
                <span className="font-mono text-[10.5px] text-amber-300">{plan.totalCost.toFixed(1)}</span>
              </div>
              <div className="flex items-center justify-between rounded border border-line-soft bg-obsidian-2/50 px-2 py-1">
                <span className="font-mono text-[10px] text-faint">scanned rows</span>
                <span className="font-mono text-[10.5px] text-cyan-300">{plan.scannedRows.toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {plan.nodes.slice(0, 5).map((n) => (
                  <Badge key={n.id} tone={n.kind === "Seq Scan" ? "amber" : n.kind.includes("Join") ? "violet" : "slate"}>
                    <Layers size={9} /> {n.kind}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        ) : null}

        <Card className="p-3">
          <SectionTitle icon={Sparkles} title="Snippets" subtitle="one click to load a statement" tone="violet" />
          <div className="mt-2 space-y-1.5">
            {SAMPLE_QUERIES.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => setSql(formatSql(buildSql(s.state, true)))}
                className="group flex w-full items-start gap-2 rounded-lg border border-line bg-obsidian-2/60 px-2 py-1.5 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.07]"
              >
                <FileCode2 size={13} className="mt-0.5 shrink-0 text-violet-300" />
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-slate-200 group-hover:text-violet-200">{s.name}</p>
                  <p className="text-[10.5px] leading-snug text-faint">{s.description}</p>
                </div>
              </button>
            ))}
            <Button
              size="sm"
              variant="subtle"
              icon={RotateCcw}
              className="w-full"
              onClick={() => setSql(formatSql(buildSql(state, true)))}
            >
              Reset to builder SQL
            </Button>
          </div>
        </Card>

        <Card className="p-3">
          <SectionTitle icon={History} title="Session History" subtitle="most recent statements" tone="cyan" />
          <div className="mt-2 space-y-1">
            {history.length === 0 ? (
              <p className="rounded border border-dashed border-line px-2 py-3 text-center font-mono text-[10.5px] text-faint">
                no statements executed yet
              </p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSql(h.sql)}
                  className="flex w-full items-center gap-2 rounded border border-line-soft bg-obsidian-2/50 px-2 py-1 text-left hover:border-cyan-500/30"
                >
                  <span className={`size-1.5 shrink-0 rounded-full ${h.ok ? "bg-emerald-400" : "bg-rose-400"}`} />
                  <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-300">{h.sql}</span>
                  <span className="shrink-0 font-mono text-[9.5px] text-faint">{h.at}</span>
                  <span className={`shrink-0 font-mono text-[9.5px] ${h.latency < 20 ? "text-emerald-300" : "text-amber-300"}`}>
                    {h.latency.toFixed(1)}ms
                  </span>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="p-3">
          <SectionTitle icon={Database} title="Connection" subtitle="session details" tone="emerald" />
          <div className="mt-2 space-y-1">
            {[
              ["host", "qp-primary.internal"],
              ["database", "sample_ecommerce"],
              ["user", "readonly_analyst"],
              ["server", "PostgreSQL 16.2"],
              ["ssl", "required"],
              ["timeout", "5000 ms"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-1">
                <span className="font-mono text-[10px] text-faint">{k}</span>
                <span className="font-mono text-[10.5px] text-slate-300">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
