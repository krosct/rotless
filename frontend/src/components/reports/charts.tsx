import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { BarChart3, ChevronDown, Table2, X } from 'lucide-react';

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

export interface CompositionSegment {
  key: string;
  value: number;
  color: string;
}

/** A single 100%-wide stacked bar, used for composition snapshots. */
export function CompositionBar({
  segments,
  ariaLabel,
  height = 16,
}: {
  segments: CompositionSegment[];
  ariaLabel: string;
  height?: number;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) return null;

  return (
    <div
      className="flex w-full gap-[2px] overflow-hidden rounded-[4px]"
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <span key={segment.key} style={{ flexGrow: segment.value, background: segment.color }} />
        ))}
    </div>
  );
}

/** Inline disclosure that reveals the items behind an aggregate. */
export function ExpandableItems({
  label,
  count,
  empty,
  children,
}: {
  label: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (count === 0) {
    return <p className="pt-3 text-center text-xs text-stone-500 dark:text-stone-400">{empty}</p>;
  }

  return (
    <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-800">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
      >
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        {open ? 'Ocultar itens' : `${label} (${count})`}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function DataTable({ table }: { table: TableData }) {
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
  detail,
  children,
  className,
}: {
  title: string;
  description?: string;
  legend?: Series[];
  table: TableData;
  /** Expanded view shown when the title is clicked. Falls back to `children`. */
  detail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const openDetail = () => setShowDetail(true);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle
              role="button"
              tabIndex={0}
              title="Ver detalhes"
              onClick={openDetail}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openDetail();
                }
              }}
              className="origin-left cursor-pointer rounded transition-transform duration-150 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2d6a4f]"
            >
              {title}
            </CardTitle>
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
      {showDetail && (
        <ChartModal title={title} description={description} onClose={() => setShowDetail(false)}>
          {detail ?? children}
        </ChartModal>
      )}
    </Card>
  );
}

export interface TooltipItem {
  label: string;
  value: string;
}

export interface TooltipGroup {
  /** Optional section header (e.g. "Consumido"). */
  label?: string;
  color?: string;
  items: TooltipItem[];
}

function TooltipContent({
  title,
  rows,
  groups,
}: {
  title: string;
  rows: { name: string; value: string; color?: string }[];
  groups?: TooltipGroup[];
}) {
  return (
    <>
      <p className="mb-0.5 whitespace-nowrap text-stone-500 dark:text-stone-400">{title}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 whitespace-nowrap">
          {row.color && <span aria-hidden="true" className="h-0.5 w-2.5 rounded" style={{ background: row.color }} />}
          <strong className="font-semibold text-stone-900 dark:text-white">{row.value}</strong>
          <span className="text-stone-500 dark:text-stone-400">{row.name}</span>
        </p>
      ))}
      {groups?.map(
        (group, groupIndex) =>
          group.items.length > 0 && (
            <div key={groupIndex} className="mt-1 border-t border-stone-100 pt-1 dark:border-stone-800">
              {group.label && (
                <p className="mb-0.5 flex items-center gap-1.5 whitespace-nowrap font-medium text-stone-500 dark:text-stone-400">
                  {group.color && (
                    <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: group.color }} />
                  )}
                  {group.label}
                </p>
              )}
              <ul className="min-w-[9rem] max-w-[15rem]">
                {group.items.map((item, index) => (
                  <li
                    key={`${item.label}-${index}`}
                    className="flex items-center justify-between gap-3 whitespace-nowrap"
                  >
                    <span className="truncate text-stone-600 dark:text-stone-300">{item.label}</span>
                    <span className="tabular-nums text-stone-500 dark:text-stone-400">{item.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
    </>
  );
}

/**
 * Tooltip rendered in a portal and positioned in the viewport, so it is never
 * clipped by a card, a modal or a scroll container. It follows the pointer
 * when a point is given, and falls back to the anchor (keyboard focus).
 */
export function Tooltip({
  anchor,
  point,
  title,
  rows,
  groups,
}: {
  anchor: HTMLElement | null;
  point?: { x: number; y: number } | null;
  title: string;
  rows: { name: string; value: string; color?: string }[];
  groups?: TooltipGroup[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({ top: 0, left: 0, visibility: 'hidden' });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const tooltipRect = element.getBoundingClientRect();
    const margin = 8;
    let top: number;
    let left: number;

    if (point) {
      top = point.y - tooltipRect.height - 12;
      if (top < margin) top = point.y + 18;
      left = point.x + 14;
    } else if (anchor) {
      const anchorRect = anchor.getBoundingClientRect();
      const above = anchorRect.top - tooltipRect.height - margin;
      top = above >= margin ? above : anchorRect.bottom + margin;
      left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
    } else {
      return;
    }

    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));

    setStyle({ top, left, visibility: 'visible' });
  }, [anchor, point, title]);

  return createPortal(
    <div
      ref={ref}
      role="tooltip"
      style={style}
      className="pointer-events-none fixed z-[60] rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] shadow-lg dark:border-stone-700 dark:bg-stone-900"
    >
      <TooltipContent title={title} rows={rows} groups={groups} />
    </div>,
    document.body,
  );
}

/** Wraps content that reveals the shared tooltip on hover/focus. */
export function HoverTooltip({
  title,
  rows,
  groups,
  className,
  children,
}: {
  title: string;
  rows: { name: string; value: string; color?: string }[];
  groups?: TooltipGroup[];
  className?: string;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      ref={anchorRef}
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}
      onMouseLeave={() => {
        setOpen(false);
        setPoint(null);
      }}
      onFocus={() => {
        setOpen(true);
        setPoint(null);
      }}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && <Tooltip anchor={anchorRef.current} point={point} title={title} rows={rows} groups={groups} />}
    </span>
  );
}

/** Floating window that shows a chart with its full detail. */
export function ChartModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl dark:border-stone-800 dark:bg-stone-900">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 p-5 dark:border-stone-800/60">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">{title}</h2>
            {description && <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="overflow-y-auto overscroll-contain p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export interface Column {
  key: string;
  /** Axis label; empty to skip it (keeps the axis sparse). */
  label: string;
  tooltipTitle: string;
  segments: { series: Series; value: number }[];
  /** Extra detail shown in the tooltip, optionally grouped. */
  groups?: TooltipGroup[];
}

/** Stacked vertical columns from one baseline, with a hover/focus tooltip per column. */
export function ColumnChart({
  columns,
  unit = 'un',
  height = 168,
  onSelect,
}: {
  columns: Column[];
  unit?: string;
  height?: number;
  onSelect?: (index: number | null) => void;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const anchors = useRef<(HTMLButtonElement | null)[]>([]);
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
        <div
          className="relative flex items-end"
          style={{ height: height - 20 }}
          onMouseLeave={() => {
            setActive(null);
            setPoint(null);
          }}
        >
          {columns.map((column, index) => (
            <button
              type="button"
              key={column.key}
              ref={(element) => {
                anchors.current[index] = element;
              }}
              aria-label={`${column.tooltipTitle}: ${column.segments.map((s) => `${s.value} ${unit} ${s.series.name.toLowerCase()}`).join(', ')}`}
              onMouseEnter={(event) => {
                setActive(index);
                setPoint({ x: event.clientX, y: event.clientY });
              }}
              onMouseMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}
              onFocus={() => {
                setActive(index);
                setPoint(null);
              }}
              onBlur={() => setActive(null)}
              onClick={() => {
                const next = active === index ? null : index;
                setActive(next);
                onSelect?.(next);
              }}
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
                  anchor={anchors.current[index]}
                  point={point}
                  title={column.tooltipTitle}
                  rows={column.segments.map((segment) => ({
                    name: segment.series.name,
                    value: `${segment.value} ${unit}`,
                    color: segment.series.color,
                  }))}
                  groups={column.groups}
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
export function BarList({
  rows,
  unit = 'un',
  empty,
  onSelect,
}: {
  rows: BarRow[];
  unit?: string;
  empty: string;
  onSelect?: (key: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const anchors = useRef<Record<string, HTMLButtonElement | null>>({});
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
              ref={(element) => {
                anchors.current[row.key] = element;
              }}
              aria-label={`${row.label}: ${row.segments.map((s) => `${s.value} ${unit} ${s.series.name.toLowerCase()}`).join(', ')}`}
              onMouseEnter={(event) => {
                setActive(row.key);
                setPoint({ x: event.clientX, y: event.clientY });
              }}
              onMouseMove={(event) => setPoint({ x: event.clientX, y: event.clientY })}
              onMouseLeave={() => {
                setActive(null);
                setPoint(null);
              }}
              onFocus={() => {
                setActive(row.key);
                setPoint(null);
              }}
              onBlur={() => setActive(null)}
              onClick={() => {
                setActive(active === row.key ? null : row.key);
                onSelect?.(row.key);
              }}
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
                  anchor={anchors.current[row.key] ?? null}
                  point={point}
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
