import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { ROUTES } from '../config/routes';

// no reason to see the login/register forms
export default function GuestRoute() {
  const { token } = useAuth();
  return token ? <Navigate to={ROUTES.EVENTS} replace /> : <Outlet />;
}
