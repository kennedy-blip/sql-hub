import { type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";

export type Tone = "violet" | "emerald" | "amber" | "rose" | "cyan" | "slate";

export const TONE_STYLES: Record<Tone, { text: string; bg: string; ring: string; dot: string; solid: string }> = {
  violet: { text: "text-violet-300", bg: "bg-violet-500/10", ring: "ring-violet-500/30", dot: "bg-violet-400", solid: "bg-violet-500" },
  emerald: { text: "text-emerald-300", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", dot: "bg-emerald-400", solid: "bg-emerald-500" },
  amber: { text: "text-amber-300", bg: "bg-amber-500/10", ring: "ring-amber-500/30", dot: "bg-amber-400", solid: "bg-amber-500" },
  rose: { text: "text-rose-300", bg: "bg-rose-500/10", ring: "ring-rose-500/30", dot: "bg-rose-400", solid: "bg-rose-500" },
  cyan: { text: "text-cyan-300", bg: "bg-cyan-500/10", ring: "ring-cyan-500/30", dot: "bg-cyan-400", solid: "bg-cyan-500" },
  slate: { text: "text-slate-300", bg: "bg-slate-500/10", ring: "ring-slate-500/30", dot: "bg-slate-400", solid: "bg-slate-500" },
};

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`qp-card ${className}`}>{children}</section>;
}

export function Badge({
  tone = "slate",
  children,
  className = "",
  mono = true,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  const t = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] leading-5 ring-1 ring-inset ${t.bg} ${t.text} ${t.ring} ${
        mono ? "font-mono" : "font-medium"
      } ${className}`}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "ghost" | "outline" | "subtle" | "danger";

export function Button({
  children,
  onClick,
  variant = "outline",
  icon: Icon,
  className = "",
  disabled,
  title,
  type = "button",
  size = "md",
}: {
  children?: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  className?: string;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  size?: "sm" | "md" | "lg";
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-violet-500 text-white hover:bg-violet-400 shadow-[0_8px_24px_-12px_rgba(139,92,246,0.9)] border border-violet-400/40",
    ghost: "text-slate-300 hover:text-white hover:bg-white/5 border border-transparent",
    outline: "bg-panel-2/60 text-slate-200 hover:bg-panel-3 hover:text-white border border-line",
    subtle: "bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white border border-white/5",
    danger: "bg-rose-500/15 text-rose-200 hover:bg-rose-500/25 border border-rose-500/40",
  };
  const sizes = {
    sm: "h-8 px-2.5 text-xs gap-1.5",
    md: "h-9 px-3 text-[13px] gap-2",
    lg: "h-10 px-4 text-sm gap-2",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition-all duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {Icon ? <Icon size={size === "sm" ? 13 : 15} strokeWidth={2.1} /> : null}
      {children}
    </button>
  );
}

export function IconButton({
  icon: Icon,
  onClick,
  title,
  tone = "slate",
  className = "",
  active = false,
}: {
  icon: LucideIcon;
  onClick?: () => void;
  title: string;
  tone?: Tone;
  className?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid size-8 place-items-center rounded-lg border transition-colors ${
        active
          ? "border-violet-500/40 bg-violet-500/15 text-violet-200"
          : `border-line bg-panel-2/50 text-slate-400 hover:bg-panel-3 hover:${TONE_STYLES[tone].text}`
      } ${className}`}
    >
      <Icon size={15} strokeWidth={2.1} />
    </button>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  subtitle,
  right,
  tone = "violet",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ${TONE_STYLES[tone].bg} ${TONE_STYLES[tone].text}`}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-[13.5px] font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 truncate text-[11.5px] text-faint">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-obsidian-2 px-1.5 py-0.5 font-mono text-[10px] text-faint">{children}</kbd>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors ${
        checked ? "border-violet-400/60 bg-violet-500/80" : "border-line bg-panel-3"
      }`}
    >
      <span
        className={`absolute size-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[19px]" : "translate-x-[3px]"}`}
      />
    </button>
  );
}

export function Select({
  value,
  onChange,
  children,
  className = "",
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="qp-input h-8 w-full cursor-pointer appearance-none truncate py-0 pl-2 pr-6 font-mono text-[11.5px] text-ink disabled:opacity-50"
      >
        {children}
      </select>
      <svg
        viewBox="0 0 12 12"
        className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-faint"
        aria-hidden
      >
        <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  className = "",
  ariaLabel,
  mono = true,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  mono?: boolean;
  onEnter?: () => void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) onEnter();
      }}
      className={`qp-input h-8 w-full px-2 text-[11.5px] ${mono ? "font-mono" : ""} placeholder:text-faint/70 ${className}`}
    />
  );
}

export interface ToastMsg {
  id: string;
  tone: "success" | "error" | "info" | "warn";
  title: string;
  description?: string;
}

const TOAST_ICON = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warn: AlertTriangle,
};

const TOAST_TONE: Record<ToastMsg["tone"], string> = {
  success: "border-emerald-500/40 text-emerald-300",
  error: "border-rose-500/40 text-rose-300",
  info: "border-violet-500/40 text-violet-300",
  warn: "border-amber-500/40 text-amber-300",
};

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMsg[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[68px] z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:!bottom-4">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.tone];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-2.5 rounded-xl border bg-panel/95 px-3 py-2.5 shadow-2xl backdrop-blur ${TOAST_TONE[t.tone]}`}
            role="status"
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[12px] font-medium text-ink">{t.title}</p>
              {t.description ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{t.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 rounded p-0.5 text-faint hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="grid size-10 place-items-center rounded-xl border border-line bg-panel-2 text-faint">
        <Icon size={18} />
      </span>
      <p className="text-[13px] font-medium text-slate-300">{title}</p>
      <p className="max-w-xs text-[11.5px] leading-relaxed text-faint">{description}</p>
    </div>
  );
}

export function ProgressBar({ value, tone = "violet", className = "" }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-obsidian-2 ring-1 ring-inset ring-line ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${TONE_STYLES[tone].solid}`}
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}
