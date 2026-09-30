import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { ApiError } from '@/api/client';
import { Mail, Lock, User, LogIn, UserPlus, UserX, AlertCircle } from 'lucide-react';
import { isRegistrationEnabled } from '@/config';
import { toast } from 'sonner';

// Shown when the API rate limit answers 429 (see throttle:login / throttle:register).
const TOO_MANY_ATTEMPTS = 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.';

const loginSchema = z.object({
  email: z.string().min(1, 'O e-mail é obrigatório').email('E-mail em formato inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

const registerSchema = z
  .object({
    name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres'),
    email: z.string().min(1, 'O e-mail é obrigatório').email('E-mail em formato inválido'),
    password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres'),
    password_confirmation: z.string().min(1, 'Confirme a senha'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ['password_confirmation'],
    message: 'As senhas não coincidem',
  });

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

export interface AuthFormProps {
  defaultMode?: 'login' | 'register';
  onSuccess?: () => void;
}

export function AuthForm({ defaultMode = 'login', onSuccess }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const { login, register: registerUser, isSubmitting } = useAuth();

  // Login form instance
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Register form instance
  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '', password_confirmation: '' },
  });

  const handleTabChange = (id: string) => {
    setMode(id as 'login' | 'register');
    setGlobalError(null);
  };

  const handleLoginSubmit = async (data: LoginFormData) => {
    setGlobalError(null);
    try {
      await login(data);
      toast.success('Login realizado com sucesso!');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.errors) {
          Object.entries(err.errors).forEach(([field, msgs]) => {
            loginForm.setError(field as keyof LoginFormData, {
              type: 'server',
              message: msgs[0],
            });
          });
        }
        setGlobalError(
          err.status === 429 ? TOO_MANY_ATTEMPTS : err.message || 'Credenciais inválidas.',
        );
      } else {
        setGlobalError('Não foi possível conectar ao servidor.');
      }
    }
  };

  const handleRegisterSubmit = async (data: RegisterFormData) => {
    setGlobalError(null);
    try {
      await registerUser({
        name: data.name,
        email: data.email,
        password: data.password,
      });
      toast.success('Cadastro criado com sucesso! Bem-vindo ao rotless.');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.errors) {
          Object.entries(err.errors).forEach(([field, msgs]) => {
            registerForm.setError(field as keyof RegisterFormData, {
              type: 'server',
              message: msgs[0],
            });
          });
        }
        setGlobalError(
          err.status === 429 ? TOO_MANY_ATTEMPTS : err.message || 'Erro ao realizar cadastro.',
        );
      } else {
        setGlobalError('Não foi possível conectar ao servidor.');
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 text-left">
      {/* Mode Switch Tabs */}
      <Tabs
        tabs={[
          { id: 'login', label: 'Entrar', icon: <LogIn /> },
          { id: 'register', label: 'Criar conta', icon: <UserPlus /> },
        ]}
        activeTab={mode}
        onChange={handleTabChange}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-700 dark:text-rose-300 text-xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
          <span>{globalError}</span>
        </div>
      )}

      {mode === 'login' ? (
        /* Login Form */
        <form
          noValidate
          data-testid="login-form"
          onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
          className="flex flex-col gap-4"
        >
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            required
            leftIcon={<Mail className="w-4 h-4" />}
            {...loginForm.register('email')}
            error={loginForm.formState.errors.email?.message}
          />

          <Input
            label="Senha"
            type="password"
            placeholder="Sua senha secreta"
            autoComplete="current-password"
            required
            leftIcon={<Lock className="w-4 h-4" />}
            {...loginForm.register('password')}
            error={loginForm.formState.errors.password?.message}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full mt-2"
          >
            <LogIn className="w-4 h-4 shrink-0" />
            Entrar na Despensa
          </Button>

        </form>
      ) : !isRegistrationEnabled() ? (
        /* Sign-ups closed */
        <div
          role="status"
          data-testid="registration-closed"
          className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl flex items-start gap-3 text-amber-800 dark:text-amber-200"
        >
          <UserX className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Novos cadastros estão temporariamente pausados.</p>
            <p className="text-xs leading-relaxed">
              Enquanto isso, toque no escudo abaixo para explorar a demonstração. Nada é salvo.
            </p>
          </div>
        </div>
      ) : (
        /* Register Form */
        <form
          noValidate
          data-testid="register-form"
          onSubmit={registerForm.handleSubmit(handleRegisterSubmit)}
          className="flex flex-col gap-4"
        >
          <Input
            label="Nome completo"
            placeholder="Como podemos te chamar?"
            autoComplete="name"
            required
            leftIcon={<User className="w-4 h-4" />}
            {...registerForm.register('name')}
            error={registerForm.formState.errors.name?.message}
          />

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            required
            leftIcon={<Mail className="w-4 h-4" />}
            {...registerForm.register('email')}
            error={registerForm.formState.errors.email?.message}
          />

          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            required
            leftIcon={<Lock className="w-4 h-4" />}
            helperText="Sua senha será protegida com hash seguro."
            {...registerForm.register('password')}
            error={registerForm.formState.errors.password?.message}
          />

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Digite a senha novamente"
            autoComplete="new-password"
            required
            leftIcon={<Lock className="w-4 h-4" />}
            {...registerForm.register('password_confirmation')}
            error={registerForm.formState.errors.password_confirmation?.message}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            className="w-full mt-2"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            Criar Minha Despensa
          </Button>
        </form>
      )}
    </div>
  );
}
