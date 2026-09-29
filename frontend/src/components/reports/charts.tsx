import { useState, type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { BarChart3, Table2 } from 'lucide-react';

// Small, dependency-free chart pieces for the reports page. Marks stay thin
// (<= 24px, 4px rounded data-end, 2px surface gap between segments), text
// always wears text colors (never the series color), every chart with two or
// more series has a legend, and every chart has a table view.

export interface Series {
  key: string;
  name: string;
  /** A CSS color, usually var(--viz-*). */
  color: string;
}

export interface TableData {
  columns: string[];
  rows: (string | number)[][];
}

/** Rounds a maximum up to 1/2/5 × 10^n, so axis ticks are clean numbers. */
export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((candidate) => candidate * magnitude >= value)!;
  return step * magnitude;
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-400">
      {series.map((item) => (
        <li key={item.key} className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="w-2.5 h-2.5 rounded-[3px]" style={{ background: item.color }} />
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function DataTable({ table }: { table: TableData }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-stone-500 dark:text-stone-400">
            {table.columns.map((column, index) => (
              <th key={column} className={cn('py-1.5 pr-3 font-semibold', index > 0 && 'text-right')}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="text-stone-700 dark:text-stone-300">
              {row.map((cell, index) => (
                <td key={index} className={cn('py-1.5 pr-3', index > 0 && 'text-right tabular-nums')}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartCard({
  title,
  description,
  legend,
  table,
  children,
  className,
}: {
  title: string;
  description?: string;
  legend?: Series[];
  table: TableData;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          <button
            type="button"
            onClick={() => setShowTable((value) => !value)}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            {showTable ? <BarChart3 className="w-3.5 h-3.5" /> : <Table2 className="w-3.5 h-3.5" />}
            {showTable ? 'Ver gráfico' : 'Ver tabela'}
          </button>
        </div>
        {legend && legend.length > 1 && !showTable && <div className="pt-2"><Legend series={legend} /></div>}
      </CardHeader>
      <CardContent className="flex-1">{showTable ? <DataTable table={table} /> : children}</CardContent>
    </Card>
  );
}

function Tooltip({ title, rows }: { title: string; rows: { name: string; value: string; color?: string }[] }) {
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg dark:border-stone-700 dark:bg-stone-900"
    >
      <p className="mb-0.5 text-stone-500 dark:text-stone-400">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5">
          {row.color && <span aria-hidden="true" className="h-0.5 w-2.5 rounded" style={{ background: row.color }} />}
          <strong className="font-semibold text-stone-900 dark:text-white">{row.value}</strong>
          <span className="text-stone-500 dark:text-stone-400">{row.name}</span>
        </p>
      ))}
    </div>
  );
}

export interface Column {
  key: string;
  /** Axis label; empty to skip it (keeps the axis sparse). */
  label: string;
  tooltipTitle: string;
  segments: { series: Series; value: number }[];
}

/** Stacked vertical columns from one baseline, with a hover/focus tooltip per column. */
export function ColumnChart({ columns, unit = 'un', height = 168 }: { columns: Column[]; unit?: string; height?: number }) {
  const [active, setActive] = useState<number | null>(null);
  const totals = columns.map((column) => column.segments.reduce((sum, segment) => sum + segment.value, 0));
  const max = niceMax(Math.max(0, ...totals));
  const ticks = [max, max / 2, 0];

  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between text-[10px] tabular-nums text-stone-400 dark:text-stone-500 pb-5" style={{ height }}>
        {ticks.map((tick) => (
          <span key={tick} className="leading-none -translate-y-1/2 first:translate-y-0 last:translate-y-0">
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </span>
        ))}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="absolute inset-x-0 top-0 flex flex-col justify-between pointer-events-none" style={{ height: height - 20 }}>
          {ticks.map((tick) => (
            <div key={tick} className="border-t border-[var(--viz-grid)]" />
          ))}
        </div>
        <div className="relative flex items-end" style={{ height: height - 20 }} onMouseLeave={() => setActive(null)}>
          {columns.map((column, index) => (
            <button
              type="button"
              key={column.key}
              aria-label={`${column.tooltipTitle}: ${column.segments.map((s) => `${s.value} ${unit} ${s.series.name.toLowerCase()}`).join(', ')}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(active === index ? null : index)}
              className="relative flex h-full flex-1 min-w-0 flex-col-reverse items-center justify-start focus:outline-none group"
            >
              <span className="flex w-[70%] max-w-6 flex-col-reverse gap-[2px]" style={{ height: `${(totals[index] / max) * 100}%` }}>
                {column.segments
                  .filter((segment) => segment.value > 0)
                  .map((segment, segmentIndex, visible) => (
                    <span
                      key={segment.series.key}
                      className={cn(
                        'block w-full transition-opacity',
                        segmentIndex === visible.length - 1 && 'rounded-t-[4px]',
                        active !== null && active !== index && 'opacity-50'
                      )}
                      style={{ background: segment.series.color, flexGrow: segment.value, flexBasis: 0, minHeight: 2 }}
                    />
                  ))}
              </span>
              {active === index && (
                <Tooltip
                  title={column.tooltipTitle}
                  rows={column.segments.map((segment) => ({
                    name: segment.series.name,
                    value: `${segment.value} ${unit}`,
                    color: segment.series.color,
                  }))}
                />
              )}
            </button>
          ))}
        </div>
        <div className="flex h-5 items-end">
          {columns.map((column) => (
            <span key={column.key} className="flex-1 min-w-0 text-center text-[10px] text-stone-400 dark:text-stone-500 whitespace-nowrap overflow-visible">
              {column.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  segments: { series: Series; value: number }[];
  /** Shown at the bar tip; defaults to the sum. */
  valueLabel?: string;
}

/** Horizontal bars (stacked when a row has several segments), value at the tip. */
export function BarList({ rows, unit = 'un', empty }: { rows: BarRow[]; unit?: string; empty: string }) {
  const [active, setActive] = useState<string | null>(null);
  const totals = rows.map((row) => row.segments.reduce((sum, segment) => sum + segment.value, 0));
  const max = Math.max(1, ...totals);

  if (rows.length === 0 || totals.every((total) => total === 0)) {
    return <p className="py-6 text-center text-xs text-stone-500 dark:text-stone-400">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row, index) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3">
          <span className="truncate text-xs text-stone-700 dark:text-stone-300" title={row.label}>
            {row.label}
          </span>
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label={`${row.label}: ${row.segments.map((s) => `${s.value} ${unit} ${s.series.name.toLowerCase()}`).join(', ')}`}
              onMouseEnter={() => setActive(row.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(row.key)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(active === row.key ? null : row.key)}
              className="relative flex h-3.5 gap-[2px] focus:outline-none"
              style={{ width: `${Math.max(2, (totals[index] / max) * 100)}%` }}
            >
              {row.segments
                .filter((segment) => segment.value > 0)
                .map((segment, segmentIndex, visible) => (
                  <span
                    key={segment.series.key}
                    className={cn('block h-full', segmentIndex === visible.length - 1 && 'rounded-r-[4px]')}
                    style={{ background: segment.series.color, flexGrow: segment.value, flexBasis: 0 }}
                  />
                ))}
              {active === row.key && row.segments.length > 1 && (
                <Tooltip
                  title={row.label}
                  rows={row.segments.map((segment) => ({
                    name: segment.series.name,
                    value: `${segment.value} ${unit}`,
                    color: segment.series.color,
                  }))}
                />
              )}
            </button>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {row.valueLabel ?? `${totals[index]} ${unit}`}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'neutral' | 'warning';
}) {
  return (
    <Card className={cn('p-4 flex flex-col gap-1', tone === 'warning' && 'border-amber-300/70 dark:border-amber-800/60')}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
        {icon}
        {label}
      </p>
      <p className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">{value}</p>
      {hint && <p className="text-[11px] text-stone-500 dark:text-stone-400">{hint}</p>}
    </Card>
  );
}
