import { useState } from 'react';
import { deleteIngredient, NUTRIENTS, type Ingredient } from '../db';
import { IngredientForm } from '../components/IngredientForm';
import { matches, useIngredients } from '../lib/hooks';
import { fmt } from '../lib/nutrition';
import { useFeedback } from '../ui/feedback';
import { Modal } from '../ui/Modal';

export function IngredientsPage() {
  const ingredients = useIngredients();
  const feedback = useFeedback();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Ingredient | 'new' | null>(null);

  const list = (ingredients ?? []).filter((i) => matches(i.name, query));

  const remove = async (ing: Ingredient) => {
    const ok = await feedback.confirm({
      title: `Delete "${ing.name}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteIngredient(ing.id);
      feedback.success(`Deleted "${ing.name}".`);
      setEditing(null);
    } catch (err) {
      feedback.fail(err, 'Could not delete the ingredient.');
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Ingredients</h1>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>
          + New ingredient
        </button>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Search ingredients"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {ingredients && list.length === 0 && (
        <div className="empty">
          {ingredients.length === 0 ? (
            <>
              <p>No ingredients yet.</p>
              <button className="btn btn-primary" onClick={() => setEditing('new')}>
                Add your first ingredient
              </button>
            </>
          ) : (
            <p>No ingredient matches "{query}".</p>
          )}
        </div>
      )}

      <ul className="card-list">
        {list.map((ing) => {
          const incomplete = NUTRIENTS.some((n) => ing[n] == null);
          return (
            <li key={ing.id}>
              <button className="card card-button ing-card" onClick={() => setEditing(ing)}>
                <div className="ing-card-top">
                  <strong>{ing.name}</strong>
                  {incomplete && <span className="badge badge-warn">Missing values</span>}
                </div>
                <div className="macro-chips">
                  <span>{ing.kcal == null ? '—' : fmt(ing.kcal, 0)} kcal</span>
                  <span>P {ing.protein == null ? '—' : fmt(ing.protein)}</span>
                  <span>F {ing.fat == null ? '—' : fmt(ing.fat)}</span>
                  <span>C {ing.carbs == null ? '—' : fmt(ing.carbs)}</span>
                  <span>Fi {ing.fiber == null ? '—' : fmt(ing.fiber)}</span>
                  {ing.gramsPerPiece && <span className="muted">1 pc = {fmt(ing.gramsPerPiece)} g</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {editing && (
        <Modal title={editing === 'new' ? 'New ingredient' : 'Edit ingredient'} onClose={() => setEditing(null)}>
          <IngredientForm
            initial={editing === 'new' ? undefined : editing}
            onSaved={() => setEditing(null)}
            onCancel={() => setEditing(null)}
            onDelete={editing === 'new' ? undefined : () => remove(editing)}
          />
        </Modal>
      )}
    </div>
  );
}
