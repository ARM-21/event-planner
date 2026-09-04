import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/auth';

// no reason to see the login/register forms
export default function GuestRoute() {
  const { token } = useAuth();
  return token ? <Navigate to="/events" replace /> : <Outlet />;
}
