import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateProfile } from '@/api/auth';
import { getApiBaseUrl, setCustomApiUrl } from '@/api/client';
import {
  User,
  Send,
  HelpCircle,
  CheckCircle2,
  Server,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

export function Settings() {
  const { user, refreshMe } = useAuth();

  // Profile states
  const [name, setName] = useState(user?.name || '');
  const [telegramChatId, setTelegramChatId] = useState(user?.telegram_chat_id || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Backend API URL configuration state
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTelegramChatId(user.telegram_chat_id || '');
    }
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateProfile({
        name,
        telegram_chat_id: telegramChatId || null,
      });
      await refreshMe();
      toast.success('Perfil e configurações atualizados com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar perfil.';
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveApiUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiUrl(apiUrl || null);
    toast.success('URL da API configurada com sucesso!');
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-stone-950 transition-colors">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Configurações da Conta
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Gerencie seu perfil, alertas via Telegram e a conexão com o backend.
          </p>
        </div>

        {/* User Profile & Telegram Section */}
        <Card>
          <form onSubmit={handleSaveProfile}>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-[#2d6a4f] dark:text-emerald-400" />
                <CardTitle>Dados Pessoais & Alertas</CardTitle>
              </div>
              <CardDescription>
                Atualize seu nome de exibição e vincule seu Telegram para notificações antes do vencimento.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="E-mail"
                  type="email"
                  value={user?.email || ''}
                  disabled
                  helperText="O e-mail cadastrado não pode ser alterado diretamente."
                />
              </div>

              {/* Telegram Chat ID field */}
              <div className="flex flex-col gap-2 p-4 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-200/80 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-500" />
                  <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                    Notificações via Telegram
                  </span>
                </div>

                <Input
                  label="Telegram Chat ID"
                  placeholder="Ex: 123456789"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  helperText="O bot do rotless enviará alertas diários de alimentos que vencem em até 3 dias."
                />

                <div className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 mt-1">
                  <HelpCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                  <span>
                    Como obter seu Chat ID: Inicie uma conversa com{' '}
                    <a
                      href="https://t.me/userinfobot"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#2d6a4f] dark:text-emerald-400 font-semibold underline inline-flex items-center gap-0.5"
                    >
                      @userinfobot <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    no Telegram e copie o número exibido no campo Id.
                  </span>
                </div>
              </div>
            </CardContent>

            <CardFooter>
              <span className="text-xs text-stone-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Dados protegidos
              </span>
              <Button type="submit" variant="primary" isLoading={isSavingProfile}>
                Salvar Alterações
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Backend API Connection Card */}
        <Card>
          <form onSubmit={handleSaveApiUrl}>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-stone-600 dark:text-stone-400" />
                <CardTitle>Conexão Backend (Laravel REST API)</CardTitle>
              </div>
              <CardDescription>
                Por padrão, o rotless usa a API v1 integrada no servidor. Se você tiver sua própria instância do Laravel 12 rodando, configure a URL base aqui.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-3">
              <Input
                label="URL Base da API (opcional)"
                placeholder="Ex: http://localhost:8000 ou https://api.seudominio.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                helperText="Deixe em branco para usar o backend integrado (Sanctum / REST v1)."
              />
            </CardContent>

            <CardFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setApiUrl('');
                  setCustomApiUrl(null);
                  toast.info('Restaurado para o backend integrado.');
                }}
              >
                Restaurar Padrão
              </Button>
              <Button type="submit" variant="secondary" size="sm">
                Salvar URL da API
              </Button>
            </CardFooter>
          </form>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
