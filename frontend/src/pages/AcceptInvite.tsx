import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getInvitationInfo, acceptInvitation } from '@/api/invitations';
import { InvitationInfo } from '@/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, Leaf, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: isAuthLoading, refreshMe, setCurrentHousehold } = useAuth();

  const [invite, setInvite] = useState<InvitationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadInvite() {
      if (!token || isAuthLoading) return;
      try {
        setIsLoading(true);
        setError(null);
        const data = await getInvitationInfo(token);
        setInvite(data);
      } catch (err: unknown) {
        setError('Este convite não foi encontrado ou já expirou.');
      } finally {
        setIsLoading(false);
      }
    }
    loadInvite();
  }, [token, isAuthLoading]);

  // Users who are neither the invitee nor a member go straight to their own pantry.
  useEffect(() => {
    if (invite?.state === 'not_invited') {
      navigate('/dashboard', { replace: true });
    }
  }, [invite, navigate]);

  const handleAccept = async () => {
    if (!token) return;

    if (!isAuthenticated) {
      toast.info('Faça login ou cadastre-se para aceitar o convite.');
      navigate('/login', { state: { returnTo: `/invite/${token}` } });
      return;
    }

    setIsAccepting(true);
    try {
      const res = await acceptInvitation(token);
      toast.success(res.message || 'Convite aceito com sucesso!');
      await refreshMe();
      // Select the household the user just joined, not their own pantry.
      setCurrentHousehold({
        id: res.household.id,
        name: res.household.name,
        role: res.household.role,
        is_owner: res.household.role === 'owner',
      });
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao aceitar convite.';
      toast.error(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-stone-50 dark:bg-stone-950 transition-colors">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#2d6a4f] text-white flex items-center justify-center shadow-md mb-3">
            <Leaf className="w-7 h-7 text-emerald-200" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            rot<span className="text-[#2d6a4f] dark:text-emerald-400">less</span>
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Convite para despensa compartilhada
          </p>
        </div>

        <Card>
          {isLoading || invite?.state === 'not_invited' ? (
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#2d6a4f]" />
              <p className="text-xs text-stone-500 mt-3">Verificando convite...</p>
            </CardContent>
          ) : invite?.state === 'already_member' ? (
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">
                Você já faz parte desta despensa
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 max-w-xs mb-6">
                Você já é membro da despensa <strong>{invite.household_name}</strong>. Não é
                necessário aceitar este convite novamente.
              </p>
              <Button variant="primary" onClick={() => navigate('/dashboard')}>
                Voltar para a tela inicial
              </Button>
            </CardContent>
          ) : error ? (
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center text-rose-500 mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 mb-1">
                Convite Inválido
              </h2>
              <p className="text-xs text-stone-500 max-w-xs mb-6">{error}</p>
              <Button variant="secondary" onClick={() => navigate('/login')}>
                Ir para Login
              </Button>
            </CardContent>
          ) : (
            <>
              <CardHeader className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-[#2d6a4f] dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                  <Users className="w-6 h-6" />
                </div>
                <CardTitle>Você foi convidado!</CardTitle>
                <CardDescription>
                  Você foi convidado para gerenciar os alimentos da despensa:
                </CardDescription>
                <div className="mt-3 p-3 bg-stone-50 dark:bg-stone-800 rounded-xl border border-stone-200/60 dark:border-stone-800">
                  <span className="font-bold text-base text-stone-900 dark:text-stone-100">
                    {invite?.household_name || 'Despensa'}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="text-xs text-stone-500 dark:text-stone-400 text-center">
                {isAuthenticated ? (
                  <p>
                    Você está conectado e pode se juntar imediatamente como membro desta despensa.
                  </p>
                ) : (
                  <p>
                    Você precisará entrar ou criar uma conta para se juntar à despensa.
                  </p>
                )}
              </CardContent>

              <CardFooter className="flex-col gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleAccept}
                  isLoading={isAccepting}
                >
                  <span>Aceitar Convite</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>

                {!isAuthenticated && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-stone-500"
                    onClick={() => navigate('/login')}
                  >
                    Já tenho uma conta
                  </Button>
                )}
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
