import type { Formula, Ingredient } from '../db';
import { formatAmount, lineGrams, fmt } from '../lib/nutrition';

export function FormulaView({ formula, ingredientMap }: { formula: Formula; ingredientMap: Map<number, Ingredient> }) {
  return (
    <>
      <section className="section">
        <h2>Ingredients</h2>
        {formula.ingredients.length === 0 ? (
          <p className="muted">No ingredients yet.</p>
        ) : (
          <ul className="ing-view">
            {formula.ingredients.map((l) => {
              const ing = ingredientMap.get(l.ingredientId);
              const grams = lineGrams(l, ing);
              return (
                <li key={l.ingredientId}>
                  <span>{ing?.name ?? 'Unknown ingredient'}</span>
                  <span className="ing-amount">
                    {formatAmount(l)}
                    {l.unit === 'pc' && grams != null && <small className="muted"> ({fmt(grams, 0)} g)</small>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="section">
        <h2>Steps</h2>
        {formula.steps.length === 0 ? (
          <p className="muted">No steps yet.</p>
        ) : (
          <ol className="step-view">
            {formula.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
