import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthForm } from '@/components/auth/AuthForm';

export function Login() {
  return (
    <AuthLayout>
      <AuthForm defaultMode="login" />
    </AuthLayout>
  );
}
