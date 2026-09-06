import type { ReactNode } from 'react';

// Simple calendar mark used as the brand logo on auth pages.
function CalendarLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="7" y="13" width="4" height="4" rx="0.5" />
    </svg>
  );
}

// Decorative line-art of people around a table — purely visual.
function EventIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 210"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="160" cy="150" rx="95" ry="16" />
      <g transform="translate(95,55)">
        <circle cx="0" cy="0" r="13" />
        <path d="M -24 62 C -24 30 24 30 24 62" />
      </g>
      <g transform="translate(160,35)">
        <circle cx="0" cy="0" r="13" />
        <path d="M -24 62 C -24 30 24 30 24 62" />
      </g>
      <g transform="translate(225,55)">
        <circle cx="0" cy="0" r="13" />
        <path d="M -24 62 C -24 30 24 30 24 62" />
      </g>
      <g transform="translate(38,150)">
        <rect x="-11" y="0" width="22" height="18" rx="2" />
        <path d="M0 0 C -8 -18 -18 -10 -21 -26" />
        <path d="M0 0 C 8 -18 18 -10 21 -26" />
        <path d="M0 0 L 0 -28" />
      </g>
    </svg>
  );
}

// Two-column layout shared by login/register: branded panel left, `children` form on the right.
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="hidden w-1/2 flex-col justify-center border-r border-gray-100 bg-indigo-50/50 px-16 py-12 lg:flex">
        <div className="flex items-center gap-2 text-indigo-700">
          <CalendarLogo className="h-7 w-7" />
          <span className="text-xl font-semibold">Evently</span>
        </div>
        <h1 className="mt-10 text-4xl font-bold leading-tight text-gray-900">
          Plan events.
          <br />
          Bring people together.
        </h1>
        <p className="mt-4 max-w-sm text-gray-600">
          Everything you need to create, manage, and run successful events.
        </p>
        <EventIllustration className="mt-12 w-full max-w-sm text-indigo-300" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        {/* Fill contrast separates the form, no shadow/border needed. */}
        <div className="w-full max-w-sm rounded-2xl bg-gray-50 p-8">{children}</div>
      </div>
    </div>
  );
}
