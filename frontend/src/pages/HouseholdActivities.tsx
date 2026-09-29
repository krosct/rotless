import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { listHouseholdActivities, listHouseholdActors, ActivityFilters } from '@/api/households';
import { HouseholdActor, Movement, MovementAction } from '@/types';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/utils/format';
import { ACTION_LABELS, describeAction, describeChanges, initials, isBackfilled } from '@/utils/movements';
import { cn } from '@/utils/cn';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Loader2,
  Package,
  PlusCircle,
  Pencil,
  CheckCircle2,
  XCircle,
  Trash2,
  Tag,
  Home,
  Mail,
  UserPlus,
  UserMinus,
  ShieldCheck,
  LucideIcon,
} from 'lucide-react';

type ActionFilter = '' | MovementAction | 'members';

const ACTION_FILTERS: { value: ActionFilter; label: string }[] = [
  { value: '', label: 'Todas as operações' },
  { value: 'created', label: 'Inclusões' },
  { value: 'updated', label: 'Edições' },
  { value: 'consumed', label: 'Consumos' },
  { value: 'discarded', label: 'Descartes' },
  { value: 'deleted', label: 'Exclusões' },
  { value: 'product_updated', label: 'Produtos editados' },
  { value: 'members', label: 'Membros e despensa' },
];

const ACTION_STYLE: Record<MovementAction, { icon: LucideIcon; className: string }> = {
  created: { icon: PlusCircle, className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' },
  updated: { icon: Pencil, className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
  consumed: { icon: CheckCircle2, className: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300' },
  discarded: { icon: XCircle, className: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  deleted: { icon: Trash2, className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
  product_updated: { icon: Tag, className: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300' },
  household_renamed: { icon: Home, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
  member_invited: { icon: Mail, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
  member_joined: { icon: UserPlus, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
  member_removed: { icon: UserMinus, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
  member_role_changed: { icon: ShieldCheck, className: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
};

const SEARCH_DEBOUNCE_MS = 300;

function dayLabel(iso: string): string {
  const days = differenceInCalendarDays(new Date(), parseISO(iso));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  return formatDate(iso, "EEEE, d 'de' MMMM 'de' yyyy");
}

function groupByDay(movements: Movement[]): { day: string; label: string; items: Movement[] }[] {
  const groups: { day: string; label: string; items: Movement[] }[] = [];
  for (const movement of movements) {
    const day = formatDate(movement.created_at, 'yyyy-MM-dd');
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(movement);
    } else {
      groups.push({ day, label: dayLabel(movement.created_at), items: [movement] });
    }
  }
  return groups;
}

function MovementItem({ movement }: { movement: Movement }) {
  const style = ACTION_STYLE[movement.action];
  const Icon = style.icon;
  const lines = describeChanges(movement);
  const who = movement.user?.name ?? 'Alguém';

  return (
    <li data-testid="movement" className="flex items-start gap-3 py-3.5">
      <span
        aria-hidden="true"
        className="w-9 h-9 rounded-full bg-[#2d6a4f]/10 dark:bg-emerald-400/10 text-[#2d6a4f] dark:text-emerald-300 flex items-center justify-center text-xs font-bold shrink-0"
      >
        {initials(who)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm text-stone-700 dark:text-stone-300">
            <strong className="font-semibold text-stone-900 dark:text-white">{who}</strong> {describeAction(movement)}
          </p>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              style.className
            )}
          >
            <Icon className="w-3 h-3" aria-hidden="true" />
            {ACTION_LABELS[movement.action]}
          </span>
        </div>

        {lines.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {lines.map((line) => (
              <li key={line.label} className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-stone-500 dark:text-stone-500">{line.label}:</span>
                {line.from !== null && line.to !== null ? (
                  <>
                    <span className="line-through decoration-stone-400/70">{line.from}</span>
                    <ArrowRight className="w-3 h-3 text-stone-400" aria-label="para" />
                    <span className="font-semibold text-stone-800 dark:text-stone-200">{line.to}</span>
                  </>
                ) : (
                  <span className="font-semibold text-stone-800 dark:text-stone-200">{line.to ?? line.from}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {isBackfilled(movement) && (
          <p className="mt-1 text-[11px] text-stone-400 dark:text-stone-500">
            Registro reconstruído a partir de dados anteriores ao histórico detalhado.
          </p>
        )}
      </div>

      <time
        dateTime={movement.created_at}
        className="text-[11px] tabular-nums text-stone-400 dark:text-stone-500 shrink-0 pt-0.5"
      >
        {formatDate(movement.created_at, 'HH:mm')}
      </time>
    </li>
  );
}

export function HouseholdActivities() {
  const { householdId } = useParams<{ householdId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentHousehold } = useAuth();

  const [userId, setUserId] = useState<string>(searchParams.get('user') ?? '');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [actors, setActors] = useState<HouseholdActor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedActor = useMemo(
    () => actors.find((actor) => actor.id === Number(userId)) ?? null,
    [actors, userId]
  );

  const filters = useMemo<ActivityFilters>(() => {
    const value: ActivityFilters = {};
    if (userId) value.userId = Number(userId);
    if (actionFilter) value.action = actionFilter;
    if (search) value.search = search;
    return value;
  }, [userId, actionFilter, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!householdId) return;
    listHouseholdActors(Number(householdId))
      .then(setActors)
      .catch(() => {
        // Non-critical: the filter falls back to no options.
      });
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    listHouseholdActivities(Number(householdId), filters)
      .then((page) => {
        if (cancelled) return;
        setMovements(page.data);
        setNextBefore(page.meta.next_before);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar o histórico desta despensa.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [householdId, filters]);

  const handleLoadMore = async () => {
    if (!householdId || nextBefore === null) return;
    setIsLoadingMore(true);
    try {
      const page = await listHouseholdActivities(Number(householdId), { ...filters, before: nextBefore });
      setMovements((previous) => [...previous, ...page.data]);
      setNextBefore(page.meta.next_before);
    } catch {
      setError('Não foi possível carregar mais operações.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleUserChange = (value: string) => {
    setUserId(value);
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('user', value);
    } else {
      next.delete('user');
    }
    setSearchParams(next, { replace: true });
  };

  const groups = useMemo(() => groupByDay(movements), [movements]);
  const selectClass =
    'h-10 px-3 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]';

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate(`/households/${householdId}/settings`)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para configurações
        </button>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Histórico da despensa
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Tudo o que foi feito em {currentHousehold?.name ?? 'sua despensa'}, por quem e o que mudou
            {selectedActor
              ? ` — filtrando por ${selectedActor.name}${selectedActor.is_member ? '' : ' (ex-membro)'}`
              : ''}
            .
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por produto..."
              aria-label="Buscar por produto"
              className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
            />
          </div>

          <select
            aria-label="Filtrar por pessoa"
            value={userId}
            onChange={(e) => handleUserChange(e.target.value)}
            className={selectClass}
          >
            <option value="">Todas as pessoas</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
                {actor.is_member ? '' : ' (ex-membro)'}
              </option>
            ))}
          </select>

          <select
            aria-label="Filtrar por operação"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
            className={selectClass}
          >
            {ACTION_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Operações</CardTitle>
            <CardDescription>Da mais recente para a mais antiga.</CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
                <p className="text-xs text-stone-500 mt-3">Carregando histórico...</p>
              </div>
            ) : error && movements.length === 0 ? (
              <p className="text-sm text-rose-600 dark:text-rose-400 text-center py-8">{error}</p>
            ) : movements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-8 h-8 text-stone-400 mb-3" />
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Nenhuma operação encontrada com os filtros atuais.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {groups.map((group) => (
                  <section key={group.day} aria-label={group.label}>
                    <h2 className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500 first-letter:uppercase">
                      {group.label}
                    </h2>
                    <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                      {group.items.map((movement) => (
                        <MovementItem key={movement.id} movement={movement} />
                      ))}
                    </ul>
                  </section>
                ))}

                {nextBefore !== null && (
                  <Button variant="secondary" onClick={handleLoadMore} isLoading={isLoadingMore} className="self-center">
                    Carregar mais
                  </Button>
                )}
                {error && <p className="text-xs text-rose-600 dark:text-rose-400 text-center">{error}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          variant="secondary"
          onClick={() => navigate(`/households/${householdId}/settings`)}
          className="self-start"
        >
          Voltar
        </Button>
      </main>

      <Footer />
    </div>
  );
}
