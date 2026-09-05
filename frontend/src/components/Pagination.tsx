import { ChevronLeft, ChevronRight } from 'lucide-react';

// Builds the sequence of page buttons to render, collapsing long runs to
// an ellipsis so e.g. page 1 of 50 doesn't render 50 buttons — always
// keeps the first/last page and a window around the current one visible.
function pageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) result.push('ellipsis');
    result.push(sorted[i]);
  }
  return result;
}

/**
 * Numbered pagination control. Purely a presentation upgrade over a
 * Previous/Next pair — the caller still owns `page` state and just gets
 * told which page was clicked.
 */
export function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (page: number) => void }) {
  if (totalPages <= 1) return null;

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {pageNumbers(page, totalPages).map((entry, i) =>
        entry === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-1.5 text-sm text-gray-400">
            …
          </span>
        ) : (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-current={entry === page ? 'page' : undefined}
            className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ${
              entry === page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {entry}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
