import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Badge, Input } from './ui';
import { tagPillClass } from '../lib/tagStyle';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

const MAX_OPTIONS = 8;

type Option = { kind: 'existing'; name: string } | { kind: 'create'; name: string };

function highlight(name: string, query: string): ReactNode {
  const at = query ? name.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at === -1) return name;
  return (
    <>
      {name.slice(0, at)}
      <span className="font-semibold text-gray-900">{name.slice(at, at + query.length)}</span>
      {name.slice(at + query.length)}
    </>
  );
}

export function TagInput({ id = 'tags', value, onChange, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const listId = `${id}-listbox`;
  const query = draft.trim();
  const taken = useMemo(() => new Set(value.map((t) => t.toLowerCase())), [value]);

  const options = useMemo<Option[]>(() => {
    const q = query.toLowerCase();
    const matches = suggestions
      .filter((name) => !taken.has(name.toLowerCase()) && name.toLowerCase().includes(q))
      .sort((a, b) => {
        // prefix matches first, then alphabetical
        const ap = a.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.toLowerCase().startsWith(q) ? 0 : 1;
        return ap - bp || a.localeCompare(b);
      })
      .slice(0, MAX_OPTIONS)
      .map((name): Option => ({ kind: 'existing', name }));

    const exists = suggestions.some((name) => name.toLowerCase() === q);
    if (query && !exists && !taken.has(q)) matches.push({ kind: 'create', name: query });
    return matches;
  }, [suggestions, taken, query]);

  function add(name: string) {
    const trimmed = name.trim();
    setDraft('');
    setActive(0);
    if (!trimmed || taken.has(trimmed.toLowerCase())) return;
    // Reuse the stored spelling of an existing tag, so "design" doesn't sit next to "Design".
    const canonical = suggestions.find((s) => s.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
    onChange([...value, canonical]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActive((i) => (options.length ? (i + 1) % options.length : 0));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setOpen(true);
        setActive((i) => (options.length ? (i - 1 + options.length) % options.length : 0));
        break;
      case 'Enter':
      case ',':
        event.preventDefault();
        if (open && options[active]) add(options[active].name);
        else add(draft);
        break;
      case 'Escape':
        setOpen(false);
        break;
      case 'Backspace':
        if (draft === '' && value.length > 0) onChange(value.slice(0, -1));
        break;
    }
  }

  const showList = open && options.length > 0;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} className={tagPillClass(tag)} onRemove={() => onChange(value.filter((t) => t !== tag))}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          autoComplete="off"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            add(draft);
          }}
          onKeyDown={handleKeyDown}
          placeholder={value.length ? 'Add another tag' : 'Search existing tags or type a new one'}
        />

        {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg"
          >
            {options.map((option, index) => (
              <li
                key={`${option.kind}-${option.name}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                // mousedown instead of click, so the input doesn't blur (and commit the draft) first
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(option.name);
                  inputRef.current?.focus();
                }}
                onMouseEnter={() => setActive(index)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${
                  index === active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700'
                }`}
              >
                {option.kind === 'existing' ? (
                  <span className="truncate">{highlight(option.name, query)}</span>
                ) : (
                  <>
                    <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      Create <span className="font-semibold">&ldquo;{option.name}&rdquo;</span>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
