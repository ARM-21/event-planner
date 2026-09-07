import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import EventsPage from './pages/EventsPage.tsx';
import EventFormPage from './pages/EventFormPage.tsx';
import EventDetailPage from './pages/EventDetailPage.tsx';
import VerifyEmailPage from './pages/VerifyEmailPage.tsx';
import SecurityPage from './pages/SecurityPage.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import GuestRoute from './components/GuestRoute.tsx';
import { ROUTES } from './config/routes';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      </Route>
      <Route path={ROUTES.VERIFY_EMAIL} element={<VerifyEmailPage />} />
      <Route path={ROUTES.EVENTS} element={<EventsPage />} />
      {/* `:id` is a route-pattern placeholder, not a real id — can't come
          from `ROUTES.EVENT_DETAIL`/`EVENT_EDIT` (see config/routes.ts). */}
      <Route path="/events/:id" element={<EventDetailPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path={ROUTES.EVENT_NEW} element={<EventFormPage />} />
        <Route path="/events/:id/edit" element={<EventFormPage />} />
        <Route path={ROUTES.SECURITY} element={<SecurityPage />} />
      </Route>
      <Route path="*" element={<Navigate to={ROUTES.EVENTS} replace />} />
    </Routes>
  );
}
