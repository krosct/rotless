import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { updateProfile, createTelegramLink, unlinkTelegram, changePassword } from '@/api/auth';
import {
  User,
  Send,
  Link2,
  Unlink,
  Copy,
  Check,
  KeyRound,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

const LINK_TTL_SECONDS = 60;
const COPY_FEEDBACK_MS = 3000;
const LINK_POLL_MS = 3000;

const TELEGRAM_LINK_STORAGE_KEY = 'rotless_telegram_link';

interface StoredTelegramLink {
  botUsername: string;
  startCommand: string;
  expiresAt: number;
}

function readStoredTelegramLink(): StoredTelegramLink | null {
  try {
    const raw = sessionStorage.getItem(TELEGRAM_LINK_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredTelegramLink;
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(TELEGRAM_LINK_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function LinkTimer({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, secondsLeft / total));
  const isUrgent = secondsLeft <= 10;
  const color = isUrgent ? '#e11d48' : '#2d6a4f';

  return (
    <div className="relative w-8 h-8 shrink-0" aria-label={`Expira em ${secondsLeft} segundos`}>
      <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
        <circle cx="16" cy="16" r={radius} fill="none" strokeWidth="3" className="stroke-stone-200 dark:stroke-stone-700" />
        <circle
          cx="16"
          cy="16"
          r={radius}
          fill="none"
          strokeWidth="3"
          stroke={color}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums"
        style={{ color }}
      >
        {secondsLeft}
      </span>
    </div>
  );
}

function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <span className="relative inline-flex w-4 h-4 items-center justify-center">
      <Copy
        className={`absolute w-4 h-4 transition-all duration-200 ${
          copied ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        }`}
      />
      <Check
        className={`absolute w-4 h-4 text-emerald-600 transition-all duration-200 ${
          copied ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
        }`}
      />
    </span>
  );
}

export function Settings() {
  const { user, refreshMe } = useAuth();

  // Profile states
  const [name, setName] = useState(user?.name || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const isTelegramLinked = Boolean(user?.telegram_chat_id);

  // Telegram link token states (restored from sessionStorage on mount)
  const storedLink = readStoredTelegramLink();
  const [linkCommand, setLinkCommand] = useState<string | null>(storedLink?.startCommand ?? null);
  const [botUsername, setBotUsername] = useState<string | null>(storedLink?.botUsername ?? null);
  const [linkExpiresAt, setLinkExpiresAt] = useState<number | null>(storedLink?.expiresAt ?? null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [copiedField, setCopiedField] = useState<'username' | 'command' | null>(null);

  // Tracks the linking flow so the UI can confirm it as soon as the webhook links the account.
  const awaitingLinkRef = useRef(false);
  const linkedChatIdAtLinkStartRef = useRef<string | null>(null);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  useEffect(() => {
    if (linkExpiresAt === null) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((linkExpiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        setLinkCommand(null);
        setBotUsername(null);
        setLinkExpiresAt(null);
        try {
          sessionStorage.removeItem(TELEGRAM_LINK_STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
      }
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [linkExpiresAt]);

  // While a link token is pending, poll the profile until the Telegram webhook links the account.
  useEffect(() => {
    if (linkExpiresAt === null) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshMe();
    }, LINK_POLL_MS);

    return () => window.clearInterval(interval);
  }, [linkExpiresAt, refreshMe]);

  // Confirm the linking as soon as the polled profile reports a new chat id.
  useEffect(() => {
    const currentChatId = user?.telegram_chat_id ?? null;

    if (!awaitingLinkRef.current || currentChatId === null || currentChatId === linkedChatIdAtLinkStartRef.current) {
      return;
    }

    awaitingLinkRef.current = false;
    linkedChatIdAtLinkStartRef.current = null;
    setLinkCommand(null);
    setBotUsername(null);
    setLinkExpiresAt(null);
    try {
      sessionStorage.removeItem(TELEGRAM_LINK_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    toast.success('Telegram vinculado com sucesso! Você receberá os alertas de validade aqui.');
  }, [user?.telegram_chat_id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateProfile({ name });
      await refreshMe();
      toast.success('Perfil e configurações atualizados com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar perfil.';
      toast.error(msg);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleLinkTelegram = async () => {
    setIsLinking(true);
    try {
      const link = await createTelegramLink();
      const expiresAt = new Date(link.expires_at).getTime();
      awaitingLinkRef.current = true;
      linkedChatIdAtLinkStartRef.current = user?.telegram_chat_id ?? null;
      setLinkCommand(link.start_command);
      setBotUsername(link.bot_username);
      setLinkExpiresAt(expiresAt);
      try {
        sessionStorage.setItem(
          TELEGRAM_LINK_STORAGE_KEY,
          JSON.stringify({
            botUsername: link.bot_username,
            startCommand: link.start_command,
            expiresAt,
          } satisfies StoredTelegramLink),
        );
      } catch {
        // Ignore storage errors
      }
      window.open(link.url, '_blank', 'noopener');
      toast.info('Abra o Telegram e toque em Start. Confirmaremos a vinculação automaticamente.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao gerar o link de vinculação.';
      toast.error(msg);
    } finally {
      setIsLinking(false);
    }
  };

  const handleCopy = async (value: string, label: string, field: 'username' | 'command') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => {
        setCopiedField((current) => (current === field ? null : current));
      }, COPY_FEEDBACK_MS);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const handleUnlinkTelegram = async () => {
    setIsLinking(true);
    try {
      await unlinkTelegram();
      await refreshMe();
      toast.success('Telegram desvinculado.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao desvincular o Telegram.';
      toast.error(msg);
    } finally {
      setIsLinking(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPassword(true);
    try {
      await changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Senha alterada com sucesso!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar a senha.';
      toast.error(msg);
    } finally {
      setIsSavingPassword(false);
    }
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

        {/* Personal Data Section */}
        <Card>
          <form onSubmit={handleSaveProfile}>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <User className="w-5 h-5 text-[#2d6a4f] dark:text-emerald-400" />
                <CardTitle>Dados Pessoais</CardTitle>
              </div>
              <CardDescription>
                Atualize seu nome de exibição e a senha da sua conta.
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
            </CardContent>

            <CardFooter>
              <Button type="submit" variant="primary" isLoading={isSavingProfile}>
                Salvar Alterações
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Password Section */}
        <Card>
          <form onSubmit={handleChangePassword}>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-[#2d6a4f] dark:text-emerald-400" />
                <CardTitle>Alterar Senha</CardTitle>
              </div>
              <CardDescription>
                Informe a senha atual e escolha uma nova senha com pelo menos 8 caracteres.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              <Input
                label="Senha atual"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Nova senha"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Input
                  label="Confirmar nova senha"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <div className="text-xs text-stone-500 dark:text-stone-400">
                <p className="font-semibold text-stone-600 dark:text-stone-300">Dica:</p>
                <ul className="list-disc list-inside mt-1 flex flex-col gap-0.5">
                  <li>Ter no mínimo 8 caracteres.</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter>
              <Button type="submit" variant="primary" isLoading={isSavingPassword}>
                Alterar Senha
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Alerts Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <Send className="w-5 h-5 text-sky-500" />
              <CardTitle>Alertas</CardTitle>
              {isTelegramLinked ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-label="Vinculado" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500" aria-label="Não vinculado" />
              )}
            </div>
            <CardDescription>
              {isTelegramLinked && user?.telegram_chat_name
                ? `Vinculado à conta ${user.telegram_chat_name}.`
                : 'Vincule seu Telegram para receber notificações antes do vencimento.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-3">
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {isTelegramLinked
                ? 'Sua conta está vinculada. Os alertas de validade chegam neste Telegram.'
                : 'Vincule seu Telegram para receber os alertas de validade. Você será levado ao bot para confirmar a vinculação.'}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={isLinking}
                onClick={handleLinkTelegram}
              >
                <Link2 className="w-4 h-4" />
                {isTelegramLinked ? 'Vincular outro Telegram' : 'Vincular Telegram'}
              </Button>

              {linkCommand && (
                <div className="flex items-center gap-2 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-stone-900 px-2 py-1.5">
                  <LinkTimer secondsLeft={secondsLeft} total={LINK_TTL_SECONDS} />

                  {botUsername && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(`@${botUsername}`, 'Username', 'username')}
                    >
                      <CopyIcon copied={copiedField === 'username'} />
                      Username
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(linkCommand, 'Comando', 'command')}
                  >
                    <CopyIcon copied={copiedField === 'command'} />
                    Token
                  </Button>
                </div>
              )}

              {isTelegramLinked && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isLinking}
                  onClick={handleUnlinkTelegram}
                >
                  <Unlink className="w-4 h-4" />
                  Desvincular
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
