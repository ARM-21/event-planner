import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.tsx';
import RegisterPage from './pages/RegisterPage.tsx';
import EventsPage from './pages/EventsPage.tsx';
import EventFormPage from './pages/EventFormPage.tsx';
import EventDetailPage from './pages/EventDetailPage.tsx';
import VerifyEmailPage from './pages/VerifyEmailPage.tsx';
import ProtectedRoute from './components/ProtectedRoute.tsx';
import GuestRoute from './components/GuestRoute.tsx';

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/events/:id" element={<EventDetailPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/events/new" element={<EventFormPage />} />
        <Route path="/events/:id/edit" element={<EventFormPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}
