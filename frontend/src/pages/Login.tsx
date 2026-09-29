import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthForm } from '@/components/auth/AuthForm';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export function Login() {
  const { enterDemo, isSubmitting } = useAuth();

  // Three taps on the shield open the demo account; the route then redirects
  // to the dashboard like after a normal login.
  const handleDemo = async () => {
    if (isSubmitting) return;
    try {
      await enterDemo();
      toast.success('Modo demonstração: explore à vontade, nada será salvo.');
    } catch {
      toast.error('Não foi possível abrir a demonstração.');
    }
  };

  return (
    <AuthLayout onShieldTripleTap={handleDemo}>
      <AuthForm defaultMode="login" />
    </AuthLayout>
  );
}
