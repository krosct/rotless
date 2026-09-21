import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { listHouseholdActivities, listHouseholdActors, ActivityFilters } from '@/api/households';
import { HouseholdActor, MemberActivity } from '@/types';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/utils/format';
import {
  ArrowLeft,
  Search,
  Loader2,
  Package,
  PlusCircle,
  Pencil,
  Calendar,
} from 'lucide-react';

type ActionFilter = 'all' | 'created' | 'updated';

export function HouseholdActivities() {
  const { householdId } = useParams<{ householdId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentHousehold } = useAuth();

  const initialUserId = searchParams.get('user') ?? '';
  const [userId, setUserId] = useState<string>(initialUserId);
  const [activities, setActivities] = useState<MemberActivity[]>([]);
  const [actors, setActors] = useState<HouseholdActor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const selectedActor = useMemo(
    () => actors.find((actor) => actor.id === Number(userId)) ?? null,
    [actors, userId]
  );

  useEffect(() => {
    async function loadActors() {
      if (!householdId) return;
      try {
        const data = await listHouseholdActors(Number(householdId));
        setActors(data);
      } catch {
        // Non-critical: the filter falls back to no options.
      }
    }

    loadActors();
  }, [householdId]);

  useEffect(() => {
    async function load() {
      if (!householdId) return;

      try {
        setIsLoading(true);
        setError(null);

        const filters: ActivityFilters = {};
        if (userId) filters.userId = Number(userId);
        if (actionFilter !== 'all') filters.action = actionFilter;
        if (statusFilter) filters.status = statusFilter;
        if (search.trim()) filters.search = search.trim();

        const data = await listHouseholdActivities(Number(householdId), filters);
        setActivities(data);
      } catch {
        setError('Não foi possível carregar as atividades desta despensa.');
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [householdId, userId, actionFilter, statusFilter, search]);

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

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para configurações
        </button>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Atividades da despensa
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Histórico de operações em {currentHousehold?.name ?? 'sua despensa'}
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por produto..."
              className="w-full h-10 pl-10 pr-4 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
            />
          </div>

          <select
            value={userId}
            onChange={(e) => handleUserChange(e.target.value)}
            className="h-10 px-3 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
          >
            <option value="">Todos os usuários</option>
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.name}
                {actor.is_member ? '' : ' (ex-membro)'}
              </option>
            ))}
          </select>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as ActionFilter)}
            className="h-10 px-3 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
          >
            <option value="all">Todas as ações</option>
            <option value="created">Criados</option>
            <option value="updated">Atualizados</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-3 text-sm rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#2d6a4f]"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="consumed">Consumido</option>
            <option value="discarded">Descartado</option>
          </select>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Operações ({activities.length})</CardTitle>
            <CardDescription>
              Cada linha mostra um lote criado ou alterado nesta despensa.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
                <p className="text-xs text-stone-500 mt-3">Carregando atividades...</p>
              </div>
            ) : error ? (
              <p className="text-sm text-rose-600 dark:text-rose-400 text-center py-8">{error}</p>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="w-8 h-8 text-stone-400 mb-3" />
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  Nenhuma operação encontrada com os filtros atuais.
                </p>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-stone-100 dark:divide-stone-800">
                {activities.map((activity) => (
                  <div
                    key={activity.batch_id}
                    data-testid="activity-row"
                    className="py-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
                        {activity.created_by ? (
                          <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Pencil className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        )}
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                          {activity.product_name}
                        </p>
                        <p className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3" />
                          Validade: {formatDate(activity.expires_at)} &bull; Qtd: {activity.quantity}
                        </p>
                        <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                          {activity.created_by ? `Criado por ${activity.created_by.name}` : 'Criado'} em{' '}
                          {formatDate(activity.created_at, 'dd/MM/yyyy HH:mm')}
                          {activity.updated_by && (
                            <>
                              {' '}&bull; Atualizado por {activity.updated_by.name} em{' '}
                              {formatDate(activity.updated_at, 'dd/MM/yyyy HH:mm')}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {activity.status !== 'active' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant={activity.status} size="sm">
                          {activity.status === 'consumed' ? 'Consumido' : 'Descartado'}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="secondary" onClick={() => navigate('/settings')} className="self-start">
          Voltar
        </Button>
      </main>

      <Footer />
    </div>
  );
}
