import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MemberList } from '@/components/household/MemberList';
import { updateHousehold } from '@/api/households';
import { ArrowLeft, Home, ShieldAlert, History, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';

export function HouseholdSettings() {
  const { householdId } = useParams<{ householdId: string }>();
  const navigate = useNavigate();
  const { user, currentHousehold, refreshMe } = useAuth();

  const household =
    user?.households?.find((item) => item.id === Number(householdId)) ?? null;

  const isOwner = household?.role === 'owner' || household?.is_owner === true;
  const canManageMembers = isOwner || household?.role === 'manager';

  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  useEffect(() => {
    if (household) setName(household.name);
  }, [household]);

  const handleSaveName = async () => {
    if (!household) return;
    if (name.trim().length < 2) {
      toast.error('O nome da despensa deve ter pelo menos 2 caracteres.');
      return;
    }

    setIsSavingName(true);
    try {
      await updateHousehold(household.id, name.trim());
      await refreshMe();
      toast.success('Nome da despensa atualizado!');
      setIsEditingName(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar o nome da despensa.';
      toast.error(msg);
    } finally {
      setIsSavingName(false);
    }
  };

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
        ) : !canManageMembers ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <ShieldAlert className="w-8 h-8 text-stone-400 mb-3" />
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Apenas o proprietário ou um gerente pode gerenciar esta despensa.
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
                Gerencie os dados, membros e convites de {household.name}.
              </p>
            </div>

            {/* Household name */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2.5">
                  <Home className="w-5 h-5 text-[#2d6a4f] dark:text-emerald-400" />
                  <div>
                    <CardTitle>Nome da despensa</CardTitle>
                    <CardDescription>
                      Você é{' '}
                      <strong className="text-stone-800 dark:text-stone-200">
                        {isOwner ? 'Proprietário (Owner)' : 'Gerente (Manager)'}
                      </strong>{' '}
                      desta despensa.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {isEditingName ? (
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label="Nome da despensa"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      isLoading={isSavingName}
                      onClick={handleSaveName}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Salvar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setName(household.name);
                        setIsEditingName(false);
                      }}
                    >
                      <X className="w-4 h-4" />
                      <span className="sr-only">Cancelar</span>
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold text-stone-900 dark:text-stone-100">
                      {household.name}
                    </span>
                    {isOwner && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingName(true)}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1" />
                        Editar nome
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>

              <CardFooter>
                <span className="text-xs text-stone-500 dark:text-stone-400">
                  O histórico de operações fica disponível para o proprietário e gerentes.
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/households/${household.id}/activities`)}
                >
                  <History className="w-3.5 h-3.5 mr-1" />
                  Ver histórico
                </Button>
              </CardFooter>
            </Card>

            {/* Members */}
            <Card>
              <CardHeader>
                <CardTitle>Membros</CardTitle>
                <CardDescription>
                  Convide pessoas e defina o papel de cada uma nesta despensa.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <MemberList
                  householdId={household.id}
                  householdName={household.name}
                  members={household.members || []}
                  canManageMembers={canManageMembers}
                  canRemoveMembers={isOwner}
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
