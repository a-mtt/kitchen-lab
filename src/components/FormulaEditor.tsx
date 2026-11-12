import { useEffect, useRef } from 'react';
import type { Ingredient, Unit } from '../db';
import { IngredientPicker } from './IngredientPicker';

/** Editable draft of ingredients/steps; amounts kept as strings while typing. */
export interface DraftLine {
  ingredientId: number;
  amount: string;
  unit: Unit;
}

export interface FormulaDraft {
  lines: DraftLine[];
  steps: string[];
  finalWeight: string;
}

interface Props {
  draft: FormulaDraft;
  onChange: (draft: FormulaDraft) => void;
  ingredients: Ingredient[];
  ingredientMap: Map<number, Ingredient>;
}

export function FormulaEditor({ draft, onChange, ingredients, ingredientMap }: Props) {
  const stepsRef = useRef<HTMLOListElement>(null);
  const focusLastStep = useRef(false);
  useEffect(() => {
    if (!focusLastStep.current) return;
    focusLastStep.current = false;
    const areas = stepsRef.current?.querySelectorAll('textarea');
    areas?.[areas.length - 1]?.focus();
  }, [draft.steps.length]);

  const setLine = (idx: number, patch: Partial<DraftLine>) =>
    onChange({ ...draft, lines: draft.lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)) });

  const setStep = (idx: number, text: string) =>
    onChange({ ...draft, steps: draft.steps.map((s, i) => (i === idx ? text : s)) });

  const moveStep = (idx: number, dir: -1 | 1) => {
    const steps = [...draft.steps];
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[idx], steps[target]] = [steps[target], steps[idx]];
    onChange({ ...draft, steps });
  };

  return (
    <>
      <section className="section">
        <h2>Ingredients</h2>
        {draft.lines.length > 0 && (
          <ul className="line-list">
            {draft.lines.map((line, idx) => {
              const ing = ingredientMap.get(line.ingredientId);
              const canPiece = !!ing?.gramsPerPiece;
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
                  <select
                    className="line-unit"
                    aria-label="Unit"
                    value={line.unit}
                    onChange={(e) => setLine(idx, { unit: e.target.value as Unit })}
                  >
                    <option value="g">g</option>
                    {(canPiece || line.unit === 'pc') && <option value="pc">pc</option>}
                  </select>
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

      <section className="section">
        <h2>Steps</h2>
        <ol className="step-edit-list" ref={stepsRef}>
          {draft.steps.map((step, idx) => (
            <li key={idx} className="step-edit">
              <span className="step-num">{idx + 1}</span>
              <textarea
                rows={2}
                value={step}
                placeholder="Describe this step"
                aria-label={`Step ${idx + 1}`}
                onChange={(e) => setStep(idx, e.target.value)}
              />
              <div className="step-tools">
                <button type="button" className="icon-btn" aria-label="Move up" disabled={idx === 0} onClick={() => moveStep(idx, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Move down"
                  disabled={idx === draft.steps.length - 1}
                  onClick={() => moveStep(idx, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove step ${idx + 1}`}
                  onClick={() => onChange({ ...draft, steps: draft.steps.filter((_, i) => i !== idx) })}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" className="btn btn-ghost" onClick={() => {
            focusLastStep.current = true;
            onChange({ ...draft, steps: [...draft.steps, ''] });
          }}
        >
          + Add step
        </button>
      </section>

      <section className="section">
        <label className="field">
          <span>
            Final batch weight <small>g, optional</small>
          </span>
          <input
            inputMode="decimal"
            value={draft.finalWeight}
            onChange={(e) => onChange({ ...draft, finalWeight: e.target.value })}
            placeholder="Weigh the batch after cooking"
          />
          <span className="hint">If empty, “per 100 g” uses the total raw ingredient weight.</span>
        </label>
      </section>
    </>
  );
}

export function formulaToDraft(f: { ingredients: { ingredientId: number; amount: number; unit: Unit }[]; steps: string[]; finalWeight: number | null }): FormulaDraft {
  return {
    lines: f.ingredients.map((l) => ({ ...l, amount: String(l.amount) })),
    steps: [...f.steps],
    finalWeight: f.finalWeight == null ? '' : String(f.finalWeight),
  };
}

/** Validates a draft. Throws a user-facing message on bad input. */
export function draftToFormula(draft: FormulaDraft, ingredientMap: Map<number, Ingredient>) {
  const ingredients = draft.lines.map((l) => {
    const name = ingredientMap.get(l.ingredientId)?.name ?? 'an ingredient';
    const amount = Number(l.amount.trim().replace(',', '.'));
    if (l.amount.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
      throw new Error(`Enter an amount above 0 for ${name}.`);
    }
    return { ingredientId: l.ingredientId, amount, unit: l.unit };
  });
  const fw = draft.finalWeight.trim().replace(',', '.');
  let finalWeight: number | null = null;
  if (fw !== '') {
    finalWeight = Number(fw);
    if (!Number.isFinite(finalWeight) || finalWeight <= 0) throw new Error('Final batch weight must be above 0.');
  }
  return { ingredients, steps: draft.steps.map((s) => s.trim()).filter(Boolean), finalWeight };
}
