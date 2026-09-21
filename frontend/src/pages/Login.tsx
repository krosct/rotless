import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthForm } from '@/components/auth/AuthForm';

export function Login() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <AuthForm defaultMode="login" onSuccess={() => navigate('/dashboard')} />
    </AuthLayout>
  );
}
