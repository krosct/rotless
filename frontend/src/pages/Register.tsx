import { Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { AuthForm } from '@/components/auth/AuthForm';
import { isRegistrationEnabled } from '@/config';

export function Register() {
  const location = useLocation();

  // Sign-ups are closed: send visitors to the login page, keeping an invite's
  // returnTo so they can still log in and accept it.
  if (!isRegistrationEnabled()) {
    return <Navigate to="/login" replace state={location.state} />;
  }

  return (
    <AuthLayout>
      <AuthForm defaultMode="register" />
    </AuthLayout>
  );
}
