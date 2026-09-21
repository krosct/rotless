import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthForm } from '@/components/auth/AuthForm';

export function Register() {
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <AuthForm defaultMode="register" onSuccess={() => navigate('/dashboard')} />
    </AuthLayout>
  );
}
