import { Database, Sparkles, Wand2, Play, Menu, X, CircleDot, Zap } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "./ui";

export type TabKey = "builder" | "editor" | "schema" | "plan";

export const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "builder", label: "Visual Query Builder", short: "Builder" },
  { key: "editor", label: "SQL Editor", short: "Editor" },
  { key: "schema", label: "Schema Explorer", short: "Schema" },
  { key: "plan", label: "Execution Plan Analyzer", short: "Plan" },
];

export function Header({
  tab,
  onTab,
  onLoadSample,
  onFormat,
  onRunPlan,
  latency,
  busy,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  onLoadSample: () => void;
  onFormat: () => void;
  onRunPlan: () => void;
  latency: number | null;
  busy: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-obsidian/85 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1560px] px-3 sm:px-5">
        <div className="flex h-14 items-center justify-between gap-3">
          {/* brand */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative grid size-9 shrink-0 place-items-center rounded-xl border border-violet-500/40 bg-gradient-to-b from-violet-500/25 to-violet-500/5 shadow-[0_0_22px_-4px_rgba(139,92,246,0.8)]">
              <Database size={18} className="text-violet-300" strokeWidth={2.2} />
              <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-emerald-400 ring-2 ring-obsidian" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[15px] font-semibold tracking-tight text-white">
                  Query<span className="text-violet-300">Pulse</span>
                </h1>
                <span className="hidden rounded border border-line bg-panel-2 px-1.5 py-px font-mono text-[9.5px] tracking-wide text-faint sm:inline-block">
                  v2.4.1
                </span>
              </div>
              <p className="hidden truncate font-mono text-[10px] text-faint sm:block">
                sql workspace · builder · plan tuner
              </p>
            </div>
          </div>

          {/* status */}
          <div className="hidden items-center gap-2 lg:flex">
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1.5">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[11px] text-emerald-300">
                SQL Engine: Connected <span className="text-emerald-400/60">·</span> PostgreSQL 16
              </span>
            </div>
            {latency !== null ? (
              <Badge tone={latency < 50 ? "emerald" : latency < 120 ? "amber" : "rose"}>
                <Zap size={10} /> last {latency.toFixed(1)}ms
              </Badge>
            ) : (
              <Badge tone="slate">
                <CircleDot size={10} /> idle
              </Badge>
            )}
          </div>

          {/* actions */}
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              icon={Sparkles}
              onClick={onLoadSample}
              className="hidden xl:inline-flex"
              title="Load a sample database & query"
            >
              Load Sample
            </Button>
            <Button variant="outline" size="sm" icon={Wand2} onClick={onFormat} title="Format the current SQL (Ctrl/⌘ + Shift + F)">
              <span className="hidden sm:inline">Format</span>
            </Button>
            <Button variant="primary" size="sm" icon={Play} onClick={onRunPlan} disabled={busy} title="Run execution plan (Ctrl/⌘ + Enter)">
              <span className="hidden sm:inline">{busy ? "Running…" : "Run Plan"}</span>
            </Button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation"
              aria-expanded={mobileOpen}
              className="ml-0.5 grid size-9 place-items-center rounded-lg border border-line bg-panel-2 text-slate-300 md:hidden"
            >
              {mobileOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* tabs */}
        <nav aria-label="Workspace sections" className="hidden md:block">
          <div className="qp-no-scrollbar -mb-px flex items-end gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTab(t.key)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative shrink-0 px-3 py-2.5 text-[12.5px] font-medium transition-colors ${
                    active ? "text-white" : "text-muted hover:text-slate-200"
                  }`}
                >
                  {t.label}
                  <span
                    className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-all ${
                      active ? "bg-violet-400 shadow-[0_0_12px_1px_rgba(139,92,246,0.7)]" : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* mobile nav sheet */}
      {mobileOpen ? (
        <div className="animate-sheet border-t border-line bg-panel/95 px-3 py-2 backdrop-blur-xl md:hidden">
          <div className="grid grid-cols-2 gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  onTab(t.key);
                  setMobileOpen(false);
                }}
                className={`rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors ${
                  tab === t.key
                    ? "border-violet-500/40 bg-violet-500/15 text-violet-100"
                    : "border-line bg-panel-2/60 text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1.5">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-[10.5px] text-emerald-300">PostgreSQL 16 · Connected</span>
          </div>
        </div>
      ) : null}
    </header>
  );
}
