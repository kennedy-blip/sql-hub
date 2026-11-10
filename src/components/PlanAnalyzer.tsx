import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  Database,
  Gauge,
  GitCompareArrows,
  Layers,
  Lightbulb,
  Play,
  ScanLine,
  Sparkles,
  SquareStack,
  TrendingDown,
  Wand2,
  Zap,
  CheckCircle2,
  HardDrive,
  Network,
  Sigma,
} from "lucide-react";
import { buildPlan, suggestIndexes, type IndexSet, type PlanKind, type PlanNode, type QueryState } from "../lib/query";
import { Badge, Button, Card, ProgressBar, SectionTitle, type Tone } from "./ui";

const KIND_META: Record<PlanKind, { tone: Tone; icon: typeof ScanLine; label: string }> = {
  "Seq Scan": { tone: "amber", icon: ScanLine, label: "sequential scan" },
  "Index Scan": { tone: "emerald", icon: Zap, label: "index scan" },
  "Index Only Scan": { tone: "emerald", icon: Zap, label: "index only scan" },
  "Hash Join": { tone: "violet", icon: GitCompareArrows, label: "hash join" },
  "Nested Loop": { tone: "rose", icon: Network, label: "nested loop" },
  "Merge Join": { tone: "cyan", icon: GitCompareArrows, label: "merge join" },
  HashAggregate: { tone: "violet", icon: Sigma, label: "hash aggregate" },
  GroupAggregate: { tone: "violet", icon: Layers, label: "group aggregate" },
  Sort: { tone: "amber", icon: TrendingDown, label: "sort" },
  Limit: { tone: "emerald", icon: Clock3, label: "limit" },
  "CTE Scan": { tone: "cyan", icon: SquareStack, label: "cte scan" },
  Materialize: { tone: "cyan", icon: HardDrive, label: "materialize" },
};

const TONE_TEXT: Record<Tone, string> = {
  violet: "text-violet-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  cyan: "text-cyan-300",
  slate: "text-slate-300",
};
const TONE_BORDER: Record<Tone, string> = {
  violet: "border-violet-500/40",
  emerald: "border-emerald-500/40",
  amber: "border-amber-500/40",
  rose: "border-rose-500/40",
  cyan: "border-cyan-500/40",
  slate: "border-line",
};
const TONE_BG: Record<Tone, string> = {
  violet: "bg-violet-500/10",
  emerald: "bg-emerald-500/10",
  amber: "bg-amber-500/10",
  rose: "bg-rose-500/10",
  cyan: "bg-cyan-500/10",
  slate: "bg-white/[0.04]",
};

function TreeNode({
  node,
  depth,
  selected,
  onSelect,
  maxCost,
  expanded,
  onToggle,
}: {
  node: PlanNode;
  depth: number;
  selected: string;
  onSelect: (id: string) => void;
  maxCost: number;
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const meta = KIND_META[node.kind];
  const Icon = meta.icon;
  const isSel = selected === node.id;
  const open = expanded[node.id] ?? true;
  const hasKids = node.children.length > 0;
  const share = maxCost > 0 ? (node.total / maxCost) * 100 : 0;

  return (
    <div className="relative">
      {depth > 0 ? (
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full border-l border-dashed border-line/80"
          style={{ marginLeft: `${(depth - 1) * 18 + 9}px` }}
        />
      ) : null}
      <div className="relative" style={{ paddingLeft: `${depth * 18}px` }}>
        {depth > 0 ? (
          <span aria-hidden className="absolute top-[22px] h-px bg-line/80" style={{ left: `${(depth - 1) * 18 + 9}px`, width: "9px" }} />
        ) : null}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          aria-pressed={isSel}
          className={`mb-1.5 w-full rounded-lg border px-2 py-1.5 text-left transition-all ${
            isSel ? `${TONE_BORDER[meta.tone]} ${TONE_BG[meta.tone]} shadow-[0_0_18px_-8px_rgba(139,92,246,0.7)]` : "border-line bg-panel-2/40 hover:bg-panel-2/80"
          }`}
        >
          <div className="flex items-center gap-1.5">
            {hasKids ? (
              <span
                role="button"
                tabIndex={0}
                aria-label={open ? "Collapse node" : "Expand node"}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(node.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    onToggle(node.id);
                  }
                }}
                className="rounded p-0.5 text-faint hover:text-slate-200"
              >
                <ChevronRight size={12} className={`transition-transform ${open ? "rotate-90" : ""}`} />
              </span>
            ) : (
              <span className="w-[17px]" />
            )}
            <Icon size={13} className={TONE_TEXT[meta.tone]} />
            <span className={`font-mono text-[11.5px] font-semibold ${TONE_TEXT[meta.tone]}`}>{node.kind}</span>
            <span className="truncate font-mono text-[10.5px] text-faint">{node.target}</span>
            <span className="ml-auto flex shrink-0 items-center gap-1.5 font-mono text-[10px]">
              <span className="text-slate-400">cost {node.total.toFixed(1)}</span>
              <span className={node.actualMs < 1.5 ? "text-emerald-300" : node.actualMs < 5 ? "text-amber-300" : "text-rose-300"}>
                {node.actualMs.toFixed(2)}ms
              </span>
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 pl-[30px]">
            <ProgressBar value={share} tone={meta.tone} className="max-w-[180px]" />
            <span className="shrink-0 font-mono text-[9.5px] text-faint">
              {node.rows.toLocaleString()} rows · w={node.width}
            </span>
          </div>
        </button>
        {hasKids && open
          ? node.children.map((c) => (
              <TreeNode
                key={c.id}
                node={c}
                depth={depth + 1}
                selected={selected}
                onSelect={onSelect}
                maxCost={maxCost}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))
          : null}
      </div>
    </div>
  );
}

export function PlanAnalyzer({
  state,
  onRun,
  serviceBusy,
  onApplyIndex,
  appliedIndexes,
  extraIndexes,
  ranAt,
}: {
  state: QueryState;
  onRun: () => void;
  serviceBusy: boolean;
  onApplyIndex: (ddl: string, label: string, refs: string[]) => void;
  appliedIndexes: string[];
  extraIndexes: IndexSet;
  ranAt: number;
}) {
  const plan = useMemo(() => buildPlan(state, extraIndexes), [state, extraIndexes, ranAt]);
  const suggestions = useMemo(() => suggestIndexes(state, plan, extraIndexes), [state, plan, extraIndexes]);
  const [selected, setSelected] = useState<string>("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    setSelected(plan.root.id);
    setExpanded(Object.fromEntries(plan.nodes.map((n) => [n.id, true])));
  }, [plan]);

  const node = plan.nodes.find((n) => n.id === selected) ?? plan.root;
  const meta = KIND_META[node.kind];

  const totalActual = plan.nodes.filter((n) => !n.children.length).reduce((a, n) => a + n.actualMs, 0);
  const seqNodes = plan.nodes.filter((n) => n.kind === "Seq Scan");
  const health = Math.max(
    4,
    Math.min(99, Math.round(100 - plan.totalCost / 40 - seqNodes.length * 12 - (plan.indexMisses.length ? 8 : 0))),
  );
  const healthTone: Tone = health > 75 ? "emerald" : health > 45 ? "amber" : "rose";

  const textPlan = useMemo(() => {
    const lines: string[] = [];
    const walk = (n: PlanNode, indent: number) => {
      const prefix = indent === 0 ? "" : "  ".repeat(indent - 1) + "->  ";
      lines.push(
        `${prefix}${n.kind} ${n.target}  (cost=0.00..${n.total.toFixed(2)} rows=${n.rows} width=${n.width}) (actual time=${n.actualMs.toFixed(3)} rows=${n.rows} loops=1)`,
      );
      if (n.detail) lines.push(`${"  ".repeat(indent + 1)}${n.detail}`);
      n.children.forEach((c) => walk(c, indent + 1));
    };
    walk(plan.root, 0);
    lines.push(`Planning Time: 0.312 ms`);
    lines.push(`Execution Time: ${plan.estimatedMs.toFixed(3)} ms`);
    return lines.join("\n");
  }, [plan]);

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      {/* tree */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="p-3">
          <SectionTitle
            icon={SquareStack}
            title="Execution Plan"
            subtitle="EXPLAIN (ANALYZE, BUFFERS) — simulated planner output"
            right={
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" icon={Cpu} onClick={() => setShowText((v) => !v)}>
                  {showText ? "Visual" : "Text"}
                </Button>
                <Button size="sm" variant="primary" icon={Play} onClick={onRun} disabled={serviceBusy}>
                  {serviceBusy ? "Running…" : "Re-run"}
                </Button>
              </div>
            }
          />

          <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[
              { icon: Gauge, label: "total cost", value: plan.totalCost.toFixed(1), tone: plan.totalCost < 400 ? "emerald" : plan.totalCost < 1200 ? "amber" : "rose" },
              { icon: Clock3, label: "exec time", value: `${plan.estimatedMs.toFixed(2)}ms`, tone: plan.estimatedMs < 20 ? "emerald" : plan.estimatedMs < 60 ? "amber" : "rose" },
              { icon: Database, label: "scanned", value: `${(plan.scannedRows / 1000).toFixed(1)}k`, tone: "cyan" },
              { icon: Layers, label: "nodes", value: String(plan.nodes.length), tone: "violet" },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border ${TONE_BORDER[s.tone as Tone]} ${TONE_BG[s.tone as Tone]} px-2 py-1.5`}>
                <div className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-faint">
                  <s.icon size={9} />
                  {s.label}
                </div>
                <p className={`mt-0.5 font-mono text-[14px] font-semibold ${TONE_TEXT[s.tone as Tone]}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {showText ? (
            <pre className="qp-code mt-2.5 max-h-[420px] overflow-auto rounded-lg border border-line bg-[#080d18] p-2.5 text-[10.5px] leading-relaxed text-slate-300">
              {textPlan}
            </pre>
          ) : (
            <div className="mt-3 rounded-lg border border-line bg-[#080c15] p-2">
              <TreeNode
                node={plan.root}
                depth={0}
                selected={selected}
                onSelect={setSelected}
                maxCost={Math.max(...plan.nodes.map((n) => n.total), 1)}
                expanded={expanded}
                onToggle={(id) => setExpanded((e) => ({ ...e, [id]: !(e[id] ?? true) }))}
              />
            </div>
          )}
        </Card>

        <Card className="p-3">
          <SectionTitle
            icon={ScanLine}
            title="Node Inspector"
            subtitle="cold vs warm buffers, filtering and row estimates"
            tone={meta.tone}
            right={<Badge tone={meta.tone}>{meta.label}</Badge>}
          />
          <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-obsidian-2/60 p-2">
              <p className="font-mono text-[9.5px] uppercase tracking-wider text-faint">operation</p>
              <p className={`mt-0.5 font-mono text-[12px] ${TONE_TEXT[meta.tone]}`}>{node.kind}</p>
              <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-muted">{node.detail}</p>
            </div>
            <div className="space-y-1.5">
              {[
                { k: "startup cost", v: node.startup.toFixed(2) },
                { k: "total cost", v: node.total.toFixed(2) },
                { k: "rows (est.)", v: node.rows.toLocaleString() },
                { k: "row width", v: `${node.width} B` },
                { k: "actual time", v: `${node.actualMs.toFixed(3)} ms` },
              ].map((r) => (
                <div key={r.k} className="flex items-center justify-between rounded border border-line-soft bg-panel-2/40 px-2 py-1">
                  <span className="font-mono text-[10px] text-faint">{r.k}</span>
                  <span className="font-mono text-[10.5px] text-slate-200">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="cyan">
              <HardDrive size={9} /> shared hit {Math.round(node.rows / 12)}
            </Badge>
            <Badge tone="violet">
              <HardDrive size={9} /> read {Math.round(node.rows / 60)}
            </Badge>
            <Badge tone={node.hot === "slow" ? "rose" : node.hot === "warn" ? "amber" : "emerald"}>
              <CircleDot size={9} /> {node.hot === "slow" ? "hot path" : node.hot === "warn" ? "moderate" : "fast path"}
            </Badge>
            {node.children.length ? <Badge tone="slate">{node.children.length} child node(s)</Badge> : <Badge tone="slate">leaf</Badge>}
          </div>
        </Card>
      </div>

      {/* right column: health + advisor */}
      <div className="flex min-w-0 flex-col gap-3">
        <Card className="p-3">
          <SectionTitle icon={Activity} title="Query Health" subtitle="planner score based on cost & scans" tone={healthTone} />
          <div className="mt-2.5 flex items-end gap-3">
            <div className="relative grid size-[68px] shrink-0 place-items-center">
              <svg viewBox="0 0 36 36" className="absolute size-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#1e2b45" strokeWidth="3.4" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke={health > 75 ? "#10b981" : health > 45 ? "#f59e0b" : "#f43f5e"}
                  strokeWidth="3.4"
                  strokeLinecap="round"
                  strokeDasharray={`${(health / 100) * 97.4} 97.4`}
                  className="transition-[stroke-dasharray] duration-700"
                />
              </svg>
              <span className={`font-mono text-[15px] font-bold ${TONE_TEXT[healthTone]}`}>{health}</span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-mono text-[10.5px] text-muted">
                {seqNodes.length > 0
                  ? `${seqNodes.length} sequential scan(s) detected`
                  : "all table access is index-backed"}
              </p>
              <p className="font-mono text-[10.5px] text-faint">
                leaf execution {totalActual.toFixed(2)}ms · {plan.indexHits.length} index hit(s)
              </p>
              <div className="flex flex-wrap gap-1 pt-0.5">
                {plan.indexMisses.slice(0, 3).map((m) => (
                  <Badge key={m} tone="amber">
                    <AlertTriangle size={9} /> {m}
                  </Badge>
                ))}
                {plan.indexMisses.length === 0 ? (
                  <Badge tone="emerald">
                    <CheckCircle2 size={9} /> no missing indexes
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-2.5 space-y-1.5">
            <p className="font-mono text-[9.5px] uppercase tracking-wider text-faint">cost distribution</p>
            {plan.nodes
              .filter((n) => n.kind !== "Limit")
              .slice(0, 5)
              .map((n) => {
                const m = KIND_META[n.kind];
                return (
                  <div key={n.id} className="flex items-center gap-2">
                    <span className="w-[104px] shrink-0 truncate font-mono text-[10px] text-slate-300">{n.kind}</span>
                    <ProgressBar value={(n.total / Math.max(plan.totalCost, 1)) * 100} tone={m.tone} />
                    <span className="w-10 shrink-0 text-right font-mono text-[9.5px] text-faint">{n.total.toFixed(0)}</span>
                  </div>
                );
              })}
          </div>
        </Card>

        <Card className="p-3">
          <SectionTitle
            icon={Lightbulb}
            title="Index Advisor"
            subtitle={`${suggestions.length} automated recommendation(s)`}
            tone="amber"
            right={
              <Badge tone="amber">
                <Sparkles size={10} /> auto
              </Badge>
            }
          />
          <div className="mt-2.5 space-y-2">
            {suggestions.map((s) => {
              const applied = appliedIndexes.includes(s.ddl);
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-2 transition-colors ${
                    applied ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-line bg-obsidian-2/60"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={s.impact === "high" ? "rose" : s.impact === "medium" ? "amber" : "slate"}>
                      {s.impact} impact
                    </Badge>
                    <span className="font-mono text-[11px] text-slate-200">
                      {s.table}({s.columns.join(", ")})
                    </span>
                    <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-emerald-300">
                      <TrendingDown size={10} /> −{Math.round(s.gain * 100)}%
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted">{s.reason}</p>
                  <pre className="qp-code mt-1.5 overflow-x-auto rounded border border-line bg-[#080d18] p-1.5 text-[9.5px] leading-relaxed text-cyan-200/90">
{s.ddl}
                  </pre>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="font-mono text-[9.5px] text-rose-300/80">{s.scanBefore}</span>
                    <ArrowRight size={9} className="text-faint" />
                    <span className="font-mono text-[9.5px] text-emerald-300/90">{s.scanAfter}</span>
                    <Button
                      size="sm"
                      variant={applied ? "subtle" : "outline"}
                      icon={applied ? CheckCircle2 : Wand2}
                      className="ml-auto"
                      onClick={() =>
                        onApplyIndex(
                          s.ddl,
                          `${s.table}(${s.columns.join(",")})`,
                          s.columns.map((c) => `${s.table}.${c}`),
                        )
                      }
                      disabled={applied}
                    >
                      {applied ? "Applied" : "Apply"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-3">
          <SectionTitle icon={Database} title="Index Usage" subtitle="top scanned indexes across the schema" tone="cyan" />
          <div className="mt-2 space-y-1.5">
            {[
              { name: "transactions_order_id_idx", scans: 421400, size: 2.4, table: "transactions" },
              { name: "transactions_pkey", scans: 312000, size: 3.2, table: "transactions" },
              { name: "orders_pkey", scans: 201400, size: 1.6, table: "orders" },
              { name: "orders_user_id_idx", scans: 154210, size: 1.1, table: "orders" },
            ].map((i) => (
              <div key={i.name} className="flex items-center gap-2">
                <Zap size={10} className="shrink-0 text-cyan-300" />
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-300">{i.name}</span>
                <span className="shrink-0 font-mono text-[9.5px] text-faint">{i.size} MB</span>
                <div className="w-16 shrink-0">
                  <ProgressBar value={(i.scans / 421400) * 100} tone="cyan" />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[9.5px] text-cyan-300/80">
                  {(i.scans / 1000).toFixed(0)}k
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
