import { useMemo } from "react";
import { TOKEN_CLASS, tokenize } from "../lib/sql";

export function SqlHighlight({ sql, className = "" }: { sql: string; className?: string }) {
  const tokens = useMemo(() => tokenize(sql), [sql]);
  return (
    <code className={`qp-code block whitespace-pre-wrap break-words text-[12px] leading-[1.65] ${className}`}>
      {tokens.map((t, i) => (
        <span key={i} className={TOKEN_CLASS[t.type]}>
          {t.value}
        </span>
      ))}
    </code>
  );
}

export function InlineSql({ children, className = "" }: { children: string; className?: string }) {
  return (
    <code className={`qp-code rounded bg-obsidian-2 px-1.5 py-0.5 text-[11px] text-violet-200 ring-1 ring-inset ring-line ${className}`}>
      {children}
    </code>
  );
}
