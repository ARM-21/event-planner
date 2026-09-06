import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { ROUTES } from '../config/routes';

export default function ProtectedRoute() {
  const { token } = useAuth();
  return token ? <Outlet /> : <Navigate to={ROUTES.LOGIN} replace />;
}
