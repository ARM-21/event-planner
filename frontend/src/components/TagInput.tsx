import { useState, type KeyboardEvent } from 'react';
import { Badge, Input } from './ui';

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagInput({ id, value, onChange, suggestions = [] }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function commitDraft() {
    const name = draft.trim();
    setDraft('');
    if (!name) return;
    if (value.some((tag) => tag.toLowerCase() === name.toLowerCase())) return;
    onChange([...value, name]);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const suggestionsId = id ? `${id}-suggestions` : undefined;

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} onRemove={() => onChange(value.filter((t) => t !== tag))}>
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        list={suggestionsId}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder="Type a tag and press Enter"
      />
      {suggestionsId && suggestions.length > 0 && (
        <datalist id={suggestionsId}>
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      )}
    </div>
  );
}
