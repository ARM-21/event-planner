import { Link } from 'react-router-dom';
import { Calendar, Clock, Globe, Lock, MapPin, Pencil, Trash2 } from 'lucide-react';
import type { EventItem } from '../api/events/types';
import { formatEventRange } from '../lib/formatEventRange';
import { tagPillClass, coverGradientClass } from '../lib/tagStyle';
import { ROUTES } from '../config/routes';

function DateBadge({ startsAt }: { startsAt: string }) {
  const date = new Date(startsAt);
  return (
    <div className="flex w-14 flex-col items-center rounded-lg bg-white/95 py-1.5 text-center shadow-sm">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
        {date.toLocaleDateString([], { month: 'short' })}
      </span>
      <span className="text-lg font-bold leading-none text-gray-900">{date.getDate()}</span>
      <span className="text-[10px] text-gray-500">{date.getFullYear()}</span>
    </div>
  );
}

// One event's summary card; edit/delete only render for the event's own creator.
export function EventCard({
  event,
  isOwner,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  event: EventItem;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleteDisabled?: boolean;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
      <div className={`relative flex h-28 items-center justify-center bg-gradient-to-br ${coverGradientClass(event.title + event.id)}`}>
        <Calendar className="h-9 w-9 text-white/40" aria-hidden="true" />
        <div className="absolute left-3 top-3">
          <DateBadge startsAt={event.startsAt} />
        </div>
        {isOwner && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit event"
              className="rounded-md bg-white/90 p-1.5 text-gray-700 hover:bg-white"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleteDisabled}
              aria-label="Delete event"
              className="rounded-md bg-white/90 p-1.5 text-red-600 hover:bg-white disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold text-gray-900">
          <Link to={ROUTES.EVENT_DETAIL(event.id)} className="hover:text-indigo-600">
            {event.title}
          </Link>
        </h3>
        <div className="space-y-1 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{formatEventRange(event.startsAt, event.endsAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.location}</span>
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {event.tags.map((tag) => (
            <span key={tag} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tagPillClass(tag)}`}>
              {tag}
            </span>
          ))}
          {event.visibility === 'public' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              <Globe className="h-3 w-3" aria-hidden="true" />
              Public
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Private
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
