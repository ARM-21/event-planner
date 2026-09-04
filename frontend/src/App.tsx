import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.tsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<h1>Login page</h1>} />
      <Route path="/register" element={<h1>Register page</h1>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/events" element={<h1>Events</h1>} />
      </Route>
      <Route path="*" element={<Navigate to="/events" replace />} />
    </Routes>
  );
}
