import { useAuth } from '../lib/auth';
import { Button } from '../components/ui';

export default function EventsPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold text-gray-900">Event Planner</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.name}</span>
            <Button onClick={logout} className="bg-gray-100 text-gray-700 hover:bg-gray-200">
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-gray-600">Events list coming next.</p>
      </main>
    </div>
  );
}
