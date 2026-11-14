import { NUTRIENTS, NUTRIENT_LABELS, type Formula, type Ingredient } from '../db';
import { computeMacros, fmt } from '../lib/nutrition';

interface Props {
  formula: Formula;
  ingredientMap: Map<number, Ingredient>;
  /** Optional reference to show the difference against. */
  compareTo?: Formula;
}

export function MacroPanel({ formula, ingredientMap, compareTo }: Props) {
  const m = computeMacros(formula, ingredientMap);
  const ref = compareTo ? computeMacros(compareTo, ingredientMap) : null;

  return (
    <section className="macro-panel">
      <div className="macro-head">
        <h2>
          Per 100 g{ref?.per100 && <small className="muted"> · differences vs reference</small>}
        </h2>
        {m.weight > 0 && (
          <span className="muted">
            Batch {fmt(m.weight, 0)} g{m.usesFinalWeight ? ` cooked (${fmt(m.rawWeight, 0)} g raw)` : ' raw'}
          </span>
        )}
      </div>
      {m.per100 ? (
        <div className="macro-grid">
          {NUTRIENTS.map((n) => {
            const delta = ref?.per100 ? m.per100![n] - ref.per100[n] : null;
            return (
              <div key={n} className={`macro macro-${n}`}>
                <span className="macro-label">{NUTRIENT_LABELS[n]}</span>
                <span className="macro-value">
                  {fmt(m.per100![n], n === 'kcal' ? 0 : 1)}
                  <small>{n === 'kcal' ? ' kcal' : ' g'}</small>
                </span>
                {delta != null && Math.abs(delta) >= (n === 'kcal' ? 0.5 : 0.05) && (
                  <span className={`macro-delta ${delta > 0 ? 'up' : 'down'}`}>
                    {delta > 0 ? '+' : '−'}
                    {fmt(Math.abs(delta), n === 'kcal' ? 0 : 1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="muted">Add ingredients with amounts to see nutrition values.</p>
      )}
      {m.per100 && (
        <p className="macro-total muted">
          Whole batch: {fmt(m.totals.kcal, 0)} kcal · P {fmt(m.totals.protein)} g · F {fmt(m.totals.fat)} g · C{' '}
          {fmt(m.totals.carbs)} g · Fi {fmt(m.totals.fiber)} g
        </p>
      )}
      {m.missingValues.length > 0 && (
        <p className="warn">Incomplete: no nutrition values yet for {m.missingValues.join(', ')}.</p>
      )}
      {m.assumedDensity.length > 0 && (
        <p className="hint">
          Estimated: assumes 1 g per ml for {m.assumedDensity.join(', ')}. Set “grams per ml” on the ingredient for
          exact numbers.
        </p>
      )}
      {m.missingPieceWeight.length > 0 && (
        <p className="warn">Not counted: set a piece weight for {m.missingPieceWeight.join(', ')}.</p>
      )}
    </section>
  );
}
