# QueryPulse

An interactive SQL query builder, visual schema explorer and database performance tuner — built as a single-page React workspace for DBAs, full-stack engineers and data scientists.

Everything runs client-side against a simulated **PostgreSQL 16** planner (`sample_ecommerce`: 4 relations, ~158k rows, 12 indexes). No database connection required.

![stack](https://img.shields.io/badge/React-19-61dafb) ![stack](https://img.shields.io/badge/Tailwind-4-38bdf8) ![stack](https://img.shields.io/badge/Vite-8-8b5cf6)

---

## Features

### 1 · Header & navigation
- Glowing database mark, live status pill **SQL Engine: Connected · PostgreSQL 16**, and last-latency badge.
- Tabs: **Visual Query Builder**, **SQL Editor**, **Schema Explorer**, **Execution Plan Analyzer**.
- Quick actions: **Load Sample**, **Format**, **Run Plan** (`⌘K` / `⌘⇧F` / `⌘↵`).

### 2 · Visual Query Builder + SQL Editor (`QueryEditor.tsx`)
- Clause blocks for `SELECT` (drag to reorder), `FROM`, `JOIN`, `WHERE`, `GROUP BY`/`HAVING`, `ORDER BY`/`LIMIT`, plus an optional `WITH … AS (…)` CTE.
- Live, syntax-highlighted SQL with line numbers; the builder and the SQL stay in sync.
- One-click execution simulator with a clean result grid, client-side column sorting and latency metrics (`Query executed in 14ms (0 rows affected)`).
- A validation layer flags grouping errors, empty projections, unknown relations and unindexed predicates.
- The standalone **SQL Editor** view gives you a raw buffer with highlighting, resizing, diagnostics, a plan snapshot, snippets and session history — and can parse your SQL **back into builder blocks**.

### 3 · Schema Explorer (`SchemaExplorer.tsx`)
- Searchable schema tree with PK / FK / index markers.
- Column, index and generated-DDL views per table, plus bloat & vacuum health bars.
- SVG entity-relationship map drawn from real foreign-key metadata — click any table to inspect it, or jump straight to a query for it.

### 4 · Execution Plan Analyzer (`PlanAnalyzer.tsx`)
- Interactive plan tree (`Seq Scan`, `Index Scan`, `Hash Join`, `GroupAggregate`, `Sort`, `CTE Scan`, `Limit`) with per-node cost, rows, width and actual time.
- Node inspector (startup/total cost, ordering, buffer tags, hot-path classification) and a raw `EXPLAIN (ANALYZE, BUFFERS)` text view.
- Query-health score plus automated **Index Advisor** recommendations. Applying a recommendation really re-costs the plan — scans switch to index access and latency drops.

---

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production bundle in dist/
npm run preview  # serve the production build
```

Deploying to Vercel is zero-config (`vercel.json`, framework preset `vite`, output `dist`).

## Design

| Token | Value | Use |
| --- | --- | --- |
| Deep Obsidian | `#070a12` | app background |
| Card panel | `#0f172a` | elevated surfaces |
| Cyber Violet | `#8b5cf6` | query core / primary actions |
| Neon Emerald | `#10b981` | success, fast execution |
| Electric Amber | `#f59e0b` | seq-scan warnings |
| Neon Rose | `#f43f5e` | SQL syntax errors |

JetBrains Mono carries every SQL statement, schema cell, cost figure and result row; Inter handles UI copy.

## Project layout

```
src/
  App.tsx                 # workspace shell, keyboard shortcuts, simulated session
  components/
    Header.tsx            # brand, status, tabs, quick actions
    QueryEditor.tsx       # builder blocks + generated SQL + results grid
    SqlEditor.tsx         # raw SQL console with diagnostics
    SchemaExplorer.tsx    # schema tree, ER diagram, DDL
    PlanAnalyzer.tsx      # plan tree, node inspector, index advisor
    SqlBlock.tsx          # syntax highlighter
    ui.tsx                # cards, badges, buttons, selects, toasts
  data/schema.ts          # tables, columns, indexes, relations, sample rows
  lib/
    sql.ts                # tokenizer + SQL pretty printer
    query.ts              # SQL generation, validation, planner, advisor, parser
```

> The engine is a deterministic simulation intended for UI exploration and teaching — it is not a real SQL execution engine.
