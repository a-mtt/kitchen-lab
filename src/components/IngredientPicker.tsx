import { useId, useMemo, useState } from 'react';
import type { Ingredient } from '../db';
import { matches } from '../lib/hooks';
import { Modal } from '../ui/Modal';
import { IngredientForm } from './IngredientForm';

interface Props {
  ingredients: Ingredient[];
  excludeIds: number[];
  onPick: (ing: Ingredient) => void;
  /** Offer "+ Create …" when nothing matches. */
  allowCreate?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Search-as-you-type over saved ingredients, with "create new" when there's no exact match. */
export function IngredientPicker({
  ingredients,
  excludeIds,
  onPick,
  allowCreate = true,
  placeholder = 'Search or add an ingredient…',
  autoFocus,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState<string | null>(null);
  const listId = useId();

  const q = query.trim();
  const options = useMemo(
    () => ingredients.filter((i) => !excludeIds.includes(i.id) && matches(i.name, q)).slice(0, 8),
    [ingredients, excludeIds, q],
  );
  const exact = ingredients.some((i) => i.name.toLocaleLowerCase() === q.toLocaleLowerCase());
  const showCreate = allowCreate && q.length > 0 && !exact;
  const total = options.length + (showCreate ? 1 : 0);

  const choose = (index: number) => {
    if (index < options.length) {
      onPick(options[index]);
      setQuery('');
      setActive(0);
    } else if (showCreate) {
      setCreating(q);
    }
  };

  return (
    <div className="picker">
      <input
        type="search"
        className="search"
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={query}
        role="combobox"
        aria-expanded={open && total > 0}
        aria-controls={listId}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, total - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (total > 0) choose(active);
          }
        }}
      />
      {open && total > 0 && (
        <ul className="picker-list" id={listId} role="listbox">
          {options.map((ing, idx) => (
            <li
              key={ing.id}
              role="option"
              aria-selected={idx === active}
              className={idx === active ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(idx)}
            >
              <span>{ing.name}</span>
              <small className="muted">{ing.kcal == null ? 'no values' : `${Math.round(ing.kcal)} kcal/100g`}</small>
            </li>
          ))}
          {showCreate && (
            <li
              role="option"
              aria-selected={active === options.length}
              className={`picker-create ${active === options.length ? 'active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(options.length)}
            >
              + Create “{q}”
            </li>
          )}
        </ul>
      )}
      {allowCreate && open && q.length === 0 && ingredients.length === 0 && (
        <p className="hint">No saved ingredients yet. Type a name to create one.</p>
      )}

      {creating !== null && (
        <Modal title="New ingredient" onClose={() => setCreating(null)}>
          <IngredientForm
            initialName={creating}
            onCancel={() => setCreating(null)}
            onSaved={(ing) => {
              setCreating(null);
              setQuery('');
              onPick(ing);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
