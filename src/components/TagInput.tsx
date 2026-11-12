import { useId, useState } from 'react';

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

export function TagInput({ tags, onChange, suggestions }: Props) {
  const [text, setText] = useState('');
  const listId = useId();

  /** Adds every comma-separated tag in `raw`; keeps an unfinished last part as text. */
  const add = (raw: string, keepRemainder = false) => {
    const parts = raw.split(',');
    const remainder = keepRemainder ? (parts.pop() ?? '') : '';
    const next = [...tags];
    for (const p of parts) {
      const tag = p.trim().toLocaleLowerCase();
      if (tag && !next.includes(tag)) next.push(tag);
    }
    if (next.length !== tags.length) onChange(next);
    setText(remainder);
  };

  return (
    <div className="tag-input">
      {tags.map((t) => (
        <span key={t} className="chip">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={text}
        placeholder={tags.length ? 'Add another' : 'e.g. dessert, high-protein'}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(',')) add(v, true);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && text === '' && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => text.trim() && add(text)}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !tags.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
