import type { Ingredient } from '../db';
import type { DraftLine, FormulaDraft } from '../lib/formulaDraft';
import { IngredientPicker } from './IngredientPicker';
import { StepsEditor } from './StepsEditor';
import { UnitSelect } from './UnitSelect';

interface Props {
  draft: FormulaDraft;
  onChange: (draft: FormulaDraft) => void;
  ingredients: Ingredient[];
  ingredientMap: Map<number, Ingredient>;
}

export function FormulaEditor({ draft, onChange, ingredients, ingredientMap }: Props) {
  const setLine = (idx: number, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) });

  return (
    <>
      <section className="section">
        <h2>Ingredients</h2>
        {draft.lines.length > 0 && (
          <ul className="line-list">
            {draft.lines.map((line, idx) => {
              const ing = ingredientMap.get(line.ingredientId);
              return (
                <li key={line.ingredientId} className="line-row">
                  <span className="line-name">{ing?.name ?? 'Unknown'}</span>
                  <input
                    className="line-amount"
                    inputMode="decimal"
                    aria-label={`Amount of ${ing?.name}`}
                    value={line.amount}
                    placeholder="0"
                    onChange={(e) => setLine(idx, { amount: e.target.value })}
                  />
                  <UnitSelect
                    value={line.unit}
                    allowPiece={!!ing?.gramsPerPiece}
                    label={`Unit for ${ing?.name}`}
                    onChange={(unit) => setLine(idx, { unit })}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${ing?.name}`}
                    onClick={() => onChange({ ...draft, lines: draft.lines.filter((_, i) => i !== idx) })}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <IngredientPicker
          ingredients={ingredients}
          excludeIds={draft.lines.map((l) => l.ingredientId)}
          onPick={(ing) =>
            onChange({ ...draft, lines: [...draft.lines, { ingredientId: ing.id, amount: '', unit: 'g' }] })
          }
        />
      </section>

      <StepsEditor steps={draft.steps} onChange={(steps) => onChange({ ...draft, steps })} />

      <FinalWeightField value={draft.finalWeight} onChange={(finalWeight) => onChange({ ...draft, finalWeight })} />
    </>
  );
}

export function FinalWeightField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <section className="section">
      <label className="field">
        <span>
          Final batch weight <small>g, optional</small>
        </span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Weigh the batch after cooking"
        />
        <span className="hint">If empty, “per 100 g” uses the total raw ingredient weight.</span>
      </label>
    </section>
  );
}
