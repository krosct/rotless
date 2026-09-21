import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MemberList } from '@/components/household/MemberList';
import { ArrowLeft, Home, ShieldAlert } from 'lucide-react';

export function HouseholdSettings() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const { user, currentHousehold, refreshMe } = useAuth();

  const household =
    user?.households?.find((item) => item.id === Number(householdId)) ?? null;

  const isOwner = household?.role === 'owner' || household?.is_owner === true;

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 self-start"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o dashboard
        </button>

        {!household ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-8 h-8 text-stone-400 mb-3" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Você não tem acesso a esta despensa.
              </p>
            </CardContent>
          </Card>
        ) : !isOwner ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-8 h-8 text-stone-400 mb-3" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Apenas o proprietário pode gerenciar as configurações desta despensa.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
                Configurações da Despensa
              </h1>
              <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
                Gerencie os membros e convites de {household.name}.
              </p>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Home className="w-5 h-5 text-[#2d6a4f] dark:text-emerald-400" />
                  <div>
                    <CardTitle>{household.name}</CardTitle>
                    <CardDescription>
                      Você é{' '}
                      <strong className="text-stone-800 dark:text-stone-200">
                        Proprietário (Owner)
                      </strong>{' '}
                      desta despensa.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <MemberList
                  householdId={household.id}
                  householdName={household.name}
                  members={household.members || []}
                  isOwner={isOwner}
                  onRefresh={refreshMe}
                />
              </CardContent>
            </Card>
          </>
        )}

        {currentHousehold && currentHousehold.id !== Number(householdId) && (
          <p className="text-xs text-stone-400 dark:text-stone-500">
            Dica: a despensa ativa no momento é {currentHousehold.name}.
          </p>
        )}

        <Button variant="secondary" onClick={() => navigate('/dashboard')} className="self-start">
          Voltar
        </Button>
      </main>

      <Footer />
    </div>
  );
}
