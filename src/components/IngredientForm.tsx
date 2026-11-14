import { useState, type FormEvent } from 'react';
import { NUTRIENTS, NUTRIENT_LABELS, saveIngredient, type Ingredient, type Nutrient } from '../db';
import { useFeedback } from '../ui/feedback';

interface Props {
  initial?: Ingredient;
  initialName?: string;
  onSaved: (ing: Ingredient) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

type Fields = Record<Nutrient | 'gramsPerPiece' | 'gramsPerMl', string>;

const toStr = (v: number | null | undefined) => (v == null ? '' : String(v));

function parseOptional(value: string, label: string): number | null {
  const v = value.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} must be a number of 0 or more.`);
  return n;
}

export function IngredientForm({ initial, initialName, onSaved, onCancel, onDelete }: Props) {
  const feedback = useFeedback();
  const [name, setName] = useState(initial?.name ?? initialName ?? '');
  const [fields, setFields] = useState<Fields>({
    kcal: toStr(initial?.kcal),
    protein: toStr(initial?.protein),
    fat: toStr(initial?.fat),
    carbs: toStr(initial?.carbs),
    fiber: toStr(initial?.fiber),
    gramsPerPiece: toStr(initial?.gramsPerPiece),
    gramsPerMl: toStr(initial?.gramsPerMl),
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    // This form can open (via a portal) from inside the recipe form; React
    // would otherwise bubble the submit up to it.
    e.stopPropagation();
    setSaving(true);
    try {
      const values = Object.fromEntries(
        NUTRIENTS.map((n) => [n, parseOptional(fields[n], NUTRIENT_LABELS[n])]),
      ) as Record<Nutrient, number | null>;
      const gramsPerPiece = parseOptional(fields.gramsPerPiece, 'Grams per piece');
      const gramsPerMl = parseOptional(fields.gramsPerMl, 'Grams per ml');
      const saved = await saveIngredient(
        { name, ...values, gramsPerPiece: gramsPerPiece || null, gramsPerMl: gramsPerMl || null },
        initial?.id,
      );
      feedback.success(`Saved "${saved.name}".`);
      onSaved(saved);
    } catch (err) {
      feedback.fail(err, 'Could not save the ingredient.');
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={submit} className="stack">
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!initialName} required />
      </label>

      <fieldset className="fieldset">
        <legend>Per 100 g</legend>
        <div className="grid-fields">
          {NUTRIENTS.map((n) => (
            <label className="field" key={n}>
              <span>
                {NUTRIENT_LABELS[n]} <small>{n === 'kcal' ? 'kcal' : 'g'}</small>
              </span>
              <input
                inputMode="decimal"
                value={fields[n]}
                onChange={set(n)}
                placeholder="—"
                autoFocus={!!initialName && n === 'kcal'}
              />
            </label>
          ))}
        </div>
        <p className="hint">You can leave values empty and fill them in later.</p>
      </fieldset>

      <div className="grid-fields two">
        <label className="field">
          <span>
            Weight of one piece <small>g, optional</small>
          </span>
          <input inputMode="decimal" value={fields.gramsPerPiece} onChange={set('gramsPerPiece')} placeholder="e.g. 55 for an egg" />
        </label>
        <label className="field">
          <span>
            Grams per ml <small>optional</small>
          </span>
          <input inputMode="decimal" value={fields.gramsPerMl} onChange={set('gramsPerMl')} placeholder="e.g. 0.92 for oil" />
        </label>
      </div>
      <p className="hint">
        Piece weight lets you add it by the piece. Grams per ml makes ml, tsp and tbsp exact (1 g/ml is assumed if empty).
      </p>

      <div className="modal-actions">
        {onDelete && (
          <button type="button" className="btn btn-danger-ghost" onClick={onDelete} style={{ marginRight: 'auto' }}>
            Delete
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save ingredient'}
        </button>
      </div>
    </form>
  );
}
