import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/auth';
import { ROUTES } from '../config/routes';

function Logo() {
  return (
    <Link to={ROUTES.EVENTS} className="flex items-center gap-2 text-indigo-700">
      <img
        src="/evently-logo.png"
        alt="Evently logo"
        className="h-6 w-6 shrink-0"
        width={24}
        height={24}
      />
      <span className="sr-only">Evently</span>
      <span className="hidden text-lg font-semibold sm:inline">Evently</span>
      <span className="inline text-sm font-semibold sm:hidden">Evently</span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function SidebarContent() {
  const { user, logout } = useAuth();
  return (
    <>
      <nav className="mt-8 flex flex-col gap-1">
        <Link
          to={ROUTES.EVENTS}
          className="flex items-center gap-2.5 rounded-md bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700"
        >
          <CalendarDays className="h-[18px] w-[18px]" aria-hidden="true" />
          Events
        </Link>
      </nav>
      <div className="mt-auto pt-4">
        {user ? (
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2 py-2 hover:bg-gray-50">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                {initials(user.name) || user.email[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-medium text-gray-900">{user.name}</span>
                <span className="block truncate text-xs text-gray-500">{user.email}</span>
              </span>
            </summary>
            <div className="absolute bottom-full left-0 mb-1 w-full rounded-md border border-gray-200 bg-white p-1 shadow-md">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Log out
              </button>
            </div>
          </details>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.LOGIN}
              className="flex flex-1 items-center justify-center rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Log in
            </Link>
            <Link
              to={ROUTES.REGISTER}
              className="flex flex-1 items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Sign up
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

// Persistent sidebar shell; below `lg` it collapses into a top bar + slide-in drawer.
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user } = useAuth();

  return (
    // Fixed-height shell — only `<main>` scrolls; `min-h-0` on every flex child is required for that to engage.
    <div className="flex h-screen flex-col overflow-hidden bg-gray-50 lg:flex-row">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {/* Kept visible in the top bar, not just the drawer, so a guest always sees these without an extra tap. */}
          {!user && (
            <>
              <Link to={ROUTES.LOGIN} className="rounded-md px-2.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Log in
              </Link>
              <Link
                to={ROUTES.REGISTER}
                className="rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Sign up
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-white px-4 py-5 shadow-xl">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* The sidebar's own scroll, independent of `<main>`. */}
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <SidebarContent />
      </aside>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {/* Caps and centers the content column on wide viewports. */}
        <div className="mx-auto w-full max-w-7xl">
          {/* Responsive spacing, kept separate from the width cap above. */}
          <div className="px-4 py-6 sm:px-6 lg:px-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
