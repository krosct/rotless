import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { useBatches } from '@/hooks/useBatches';
import { getHouseholdReport } from '@/api/households';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card } from '@/components/ui/Card';
import { BarList, ChartCard, ColumnChart, Legend, Series, StatTile } from '@/components/reports/charts';
import { expiryTone } from '@/utils/expiry';
import { cn } from '@/utils/cn';
import { Batch, HouseholdReport } from '@/types';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Lightbulb,
  Loader2,
  PackagePlus,
  XCircle,
} from 'lucide-react';

type Days = 7 | 30 | 90;
const PERIODS: { days: Days; label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

const CONSUMED: Series = { key: 'consumed', name: 'Consumido', color: 'var(--viz-consumed)' };
const DISCARDED: Series = { key: 'discarded', name: 'Descartado', color: 'var(--viz-discarded)' };
const ADDED: Series = { key: 'added', name: 'Adicionou', color: 'var(--viz-added)' };
const CONSUMED_OPS: Series = { ...CONSUMED, name: 'Consumiu' };
const DISCARDED_OPS: Series = { ...DISCARDED, name: 'Descartou' };
const SOON: Series = { key: 'soon', name: 'Vence em até 3 dias', color: 'var(--viz-warning)' };
const LATER: Series = { key: 'later', name: 'Vence depois', color: 'var(--viz-muted)' };

const UPCOMING_DAYS = 14;

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function formatDay(iso: string, pattern: string): string {
  return format(parseISO(iso), pattern, { locale: ptBR });
}

/** What is in the pantry right now, by expiry status (units). */
function pantryNow(batches: Batch[], now: Date) {
  const result = { overdue: 0, soon: 0, ok: 0, batches: { overdue: 0, soon: 0, ok: 0 } };
  for (const batch of batches) {
    if (batch.status !== 'active') continue;
    const tone = expiryTone(batch.expires_at, now);
    result[tone] += batch.quantity;
    result.batches[tone] += 1;
  }
  return result;
}

function upcoming(batches: Batch[], now: Date) {
  return Array.from({ length: UPCOMING_DAYS }, (_, offset) => {
    const date = format(addDays(now, offset), 'yyyy-MM-dd');
    const units = batches
      .filter((batch) => batch.status === 'active' && batch.expires_at === date)
      .reduce((sum, batch) => sum + batch.quantity, 0);
    return { date, offset, units };
  });
}

function insights(report: HouseholdReport | undefined, now: ReturnType<typeof pantryNow>): string[] {
  const tips: string[] = [];
  if (now.soon > 0) {
    tips.push(`${now.soon} un vencem nos próximos 3 dias: dê prioridade a elas nas próximas refeições.`);
  }
  if (now.overdue > 0) {
    tips.push(`${now.overdue} un já venceram e continuam na despensa: confira se ainda servem ou registre o descarte.`);
  }
  const worst = report?.top_discarded[0];
  if (worst) {
    tips.push(`"${worst.product_name}" foi o mais descartado (${worst.units} un): vale comprar em menor quantidade.`);
  }
  const rate = report?.totals.use_rate ?? null;
  const previous = report?.previous.use_rate ?? null;
  if (rate !== null && previous !== null && Math.round(rate * 100) !== Math.round(previous * 100)) {
    tips.push(
      rate > previous
        ? `O aproveitamento subiu de ${percent(previous)} para ${percent(rate)} em relação ao período anterior.`
        : `O aproveitamento caiu de ${percent(previous)} para ${percent(rate)} em relação ao período anterior.`
    );
  }
  return tips;
}

function UseRateHero({ report }: { report: HouseholdReport }) {
  const { consumed_units: consumed, discarded_units: discarded, use_rate: rate } = report.totals;
  const previous = report.previous.use_rate;
  const delta = rate !== null && previous !== null ? Math.round((rate - previous) * 100) : null;
  const total = consumed + discarded;

  return (
    <Card className="p-5 sm:p-6 flex flex-col gap-4 lg:col-span-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-stone-500 dark:text-stone-400">Taxa de aproveitamento</p>
          <p className="text-5xl font-bold tracking-tight text-stone-900 dark:text-white">{percent(rate)}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Do que saiu da despensa no período, quanto foi consumido e não desperdiçado.
          </p>
        </div>
        {delta !== null && (
          <p
            className={cn(
              'text-xs font-semibold rounded-full px-2.5 py-1',
              delta >= 0
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
            )}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} p.p. vs período anterior
          </p>
        )}
      </div>

      {total > 0 ? (
        <div className="flex flex-col gap-2">
          <div
            className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]"
            role="img"
            aria-label={`${consumed} un consumidas e ${discarded} un descartadas`}
          >
            {consumed > 0 && <span style={{ flexGrow: consumed, background: CONSUMED.color }} />}
            {discarded > 0 && <span style={{ flexGrow: discarded, background: DISCARDED.color }} />}
          </div>
          <div className="flex flex-wrap justify-between gap-2 text-xs text-stone-600 dark:text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: CONSUMED.color }} />
              <strong className="text-stone-900 dark:text-white">{consumed} un</strong> consumidas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: DISCARDED.color }} />
              <strong className="text-stone-900 dark:text-white">{discarded} un</strong> descartadas
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-stone-500 dark:text-stone-400">Nenhum consumo ou descarte registrado no período.</p>
      )}
    </Card>
  );
}

function PantryStatus({ now }: { now: ReturnType<typeof pantryNow> }) {
  const items = [
    { key: 'overdue', label: 'Vencidos', units: now.overdue, batches: now.batches.overdue, color: 'var(--viz-critical)', icon: XCircle },
    { key: 'soon', label: 'Vencem em até 3 dias', units: now.soon, batches: now.batches.soon, color: 'var(--viz-warning)', icon: AlertTriangle },
    { key: 'ok', label: 'No prazo', units: now.ok, batches: now.batches.ok, color: 'var(--viz-good)', icon: CheckCircle2 },
  ];
  const total = items.reduce((sum, item) => sum + item.units, 0);

  if (total === 0) {
    return <p className="py-6 text-center text-xs text-stone-500 dark:text-stone-400">A despensa está vazia.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label="Situação da despensa por validade">
        {items.filter((item) => item.units > 0).map((item) => (
          <span key={item.key} style={{ flexGrow: item.units, background: item.color }} />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 text-stone-700 dark:text-stone-300">
              <item.icon className="w-3.5 h-3.5" style={{ color: item.color }} aria-hidden="true" />
              {item.label}
            </span>
            <span className="tabular-nums text-stone-500 dark:text-stone-400">
              <strong className="text-stone-900 dark:text-white">{item.units} un</strong> · {item.batches} lote(s) ·{' '}
              {Math.round((item.units / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HouseholdReports() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [days, setDays] = useState<Days>(30);

  const id = Number(householdId);
  const household = user?.households?.find((item) => item.id === id);
  const canView = household?.role === 'owner' || household?.role === 'manager';

  const reportQuery = useQuery({
    queryKey: ['household-report', id, days],
    queryFn: () => getHouseholdReport(id, days),
    enabled: canView,
    placeholderData: keepPreviousData,
  });
  const { data: batches = [] } = useBatches(canView ? id : undefined);

  const today = useMemo(() => new Date(), []);
  const now = useMemo(() => pantryNow(batches, today), [batches, today]);
  const next = useMemo(() => upcoming(batches, today), [batches, today]);
  const report = reportQuery.data;
  const tips = insights(report, now);

  const timelineColumns = (report?.timeline ?? []).map((point, index, all) => {
    const everyNth = report?.period.bucket === 'week' ? 2 : all.length > 10 ? 5 : 1;
    const showLabel = index % everyNth === 0 || index === all.length - 1;
    return {
      key: point.date,
      label: showLabel ? formatDay(point.date, all.length > 10 ? 'dd/MM' : 'EEE') : '',
      tooltipTitle:
        report?.period.bucket === 'week'
          ? `Semana de ${formatDay(point.date, 'dd/MM')}`
          : formatDay(point.date, "EEEE, dd/MM"),
      segments: [
        { series: CONSUMED, value: point.consumed },
        { series: DISCARDED, value: point.discarded },
      ],
    };
  });

  const upcomingColumns = next.map((day) => ({
    key: day.date,
    label: day.offset === 0 ? 'Hoje' : day.offset % 3 === 0 ? formatDay(day.date, 'dd/MM') : '',
    tooltipTitle: day.offset === 0 ? 'Hoje' : formatDay(day.date, "EEEE, dd/MM"),
    segments: [{ series: day.offset <= 3 ? SOON : LATER, value: day.units }],
  }));

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate(`/households/${householdId}/settings`)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para configurações
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              Relatórios da despensa
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Como {household?.name ?? 'a despensa'} está aproveitando o que compra.
            </p>
          </div>

          {canView && (
            <div role="group" aria-label="Período" className="inline-flex rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-1 self-start">
              {PERIODS.map((period) => (
                <button
                  key={period.days}
                  type="button"
                  aria-pressed={days === period.days}
                  onClick={() => setDays(period.days)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                    days === period.days
                      ? 'bg-[#2d6a4f] text-white'
                      : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                  )}
                >
                  {period.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {!canView ? (
          <Card className="p-6 text-sm text-stone-600 dark:text-stone-400">
            Os relatórios ficam disponíveis para o dono e os gerentes da despensa.
          </Card>
        ) : !report ? (
          reportQuery.isError ? (
            <Card className="p-6 text-sm text-rose-600 dark:text-rose-400">Não foi possível carregar os relatórios.</Card>
          ) : (
            <div className="flex flex-col items-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
              <p className="text-xs text-stone-500 mt-3">Calculando relatórios...</p>
            </div>
          )
        ) : (
          <div className={cn('flex flex-col gap-6 transition-opacity', reportQuery.isFetching && 'opacity-60')}>
            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <UseRateHero report={report} />
              <StatTile
                label="Em risco agora"
                icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />}
                value={`${now.overdue + now.soon} un`}
                hint={`${now.overdue} vencida(s) · ${now.soon} vencem em até 3 dias`}
                tone={now.overdue + now.soon > 0 ? 'warning' : 'neutral'}
              />
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                <StatTile
                  label="Adicionadas"
                  icon={<PackagePlus className="w-3.5 h-3.5" aria-hidden="true" />}
                  value={`${report.totals.added_units} un`}
                  hint={`em ${report.period.days} dias`}
                />
                <StatTile
                  label="Tempo até o consumo"
                  icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}
                  value={
                    report.totals.avg_days_to_consume === null
                      ? '—'
                      : `${report.totals.avg_days_to_consume.toLocaleString('pt-BR')} dias`
                  }
                  hint="média entre a compra e o consumo"
                />
              </div>
            </div>

            {tips.length > 0 && (
              <Card className="p-4 sm:p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200 mb-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" aria-hidden="true" />
                  Onde agir
                </p>
                <ul className="flex flex-col gap-1.5 text-sm text-stone-600 dark:text-stone-300 list-disc pl-5">
                  {tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </Card>
            )}

            <ChartCard
              title="Consumo e desperdício"
              description={
                report.period.bucket === 'week'
                  ? 'Unidades consumidas e descartadas por semana.'
                  : 'Unidades consumidas e descartadas por dia.'
              }
              legend={[CONSUMED, DISCARDED]}
              table={{
                columns: [report.period.bucket === 'week' ? 'Semana de' : 'Dia', 'Consumido', 'Descartado'],
                rows: report.timeline.map((point) => [formatDay(point.date, 'dd/MM/yyyy'), point.consumed, point.discarded]),
              }}
            >
              <ColumnChart columns={timelineColumns} />
            </ChartCard>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Situação da despensa agora"
                description="Unidades ativas por prazo de validade."
                table={{
                  columns: ['Situação', 'Unidades', 'Lotes'],
                  rows: [
                    ['Vencidos', now.overdue, now.batches.overdue],
                    ['Vencem em até 3 dias', now.soon, now.batches.soon],
                    ['No prazo', now.ok, now.batches.ok],
                  ],
                }}
              >
                <PantryStatus now={now} />
              </ChartCard>

              <ChartCard
                title="Próximos vencimentos"
                description={`Unidades que vencem em cada um dos próximos ${UPCOMING_DAYS} dias.`}
                legend={[SOON, LATER]}
                table={{
                  columns: ['Dia', 'Unidades'],
                  rows: next.map((day) => [formatDay(day.date, 'dd/MM/yyyy'), day.units]),
                }}
              >
                <ColumnChart columns={upcomingColumns} height={148} />
              </ChartCard>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Mais desperdiçados"
                description="Produtos com mais unidades descartadas no período."
                table={{
                  columns: ['Produto', 'Unidades descartadas'],
                  rows: report.top_discarded.map((item) => [item.product_name, item.units]),
                }}
              >
                <BarList
                  empty="Nenhum descarte no período. Ótimo!"
                  rows={report.top_discarded.map((item) => ({
                    key: item.product_name,
                    label: item.product_name,
                    segments: [{ series: DISCARDED, value: item.units }],
                  }))}
                />
              </ChartCard>

              <ChartCard
                title="Mais consumidos"
                description="Produtos com mais unidades consumidas no período."
                table={{
                  columns: ['Produto', 'Unidades consumidas'],
                  rows: report.top_consumed.map((item) => [item.product_name, item.units]),
                }}
              >
                <BarList
                  empty="Nenhum consumo no período."
                  rows={report.top_consumed.map((item) => ({
                    key: item.product_name,
                    label: item.product_name,
                    segments: [{ series: CONSUMED, value: item.units }],
                  }))}
                />
              </ChartCard>
            </div>

            <ChartCard
              title="Atividade por membro"
              description="Operações de cada pessoa no período (inclusões, consumos e descartes; edições e exclusões no total)."
              legend={[ADDED, CONSUMED_OPS, DISCARDED_OPS]}
              table={{
                columns: ['Pessoa', 'Adicionou', 'Consumiu', 'Descartou', 'Outras', 'Total'],
                rows: report.members.map((member) => [
                  `${member.user.name}${member.is_member ? '' : ' (ex-membro)'}`,
                  member.added,
                  member.consumed,
                  member.discarded,
                  member.other,
                  member.total,
                ]),
              }}
            >
              <BarList
                unit="op."
                empty="Nenhuma operação no período."
                rows={report.members.map((member) => ({
                  key: String(member.user.id),
                  label: `${member.user.name}${member.is_member ? '' : ' (ex-membro)'}`,
                  segments: [
                    { series: ADDED, value: member.added },
                    { series: CONSUMED_OPS, value: member.consumed },
                    { series: DISCARDED_OPS, value: member.discarded },
                  ],
                  valueLabel: `${member.total} op.`,
                }))}
              />
            </ChartCard>

            <div className="sm:hidden">
              <Legend series={[CONSUMED, DISCARDED, ADDED]} />
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
