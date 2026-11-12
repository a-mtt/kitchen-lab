import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { matches, useIngredientMap } from '../lib/hooks';
import { computeMacros, fmt } from '../lib/nutrition';

export function RecipeListPage() {
  const recipes = useLiveQuery(() => db.recipes.orderBy('title').toArray(), []);
  const experiments = useLiveQuery(() => db.experiments.toArray(), []);
  const ingredientMap = useIngredientMap();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);

  const allTags = useMemo(() => [...new Set((recipes ?? []).flatMap((r) => r.tags))].sort(), [recipes]);

  if (!recipes || !ingredientMap || !experiments) return <div className="page" />;

  const q = query.trim();
  const filtered = recipes.filter((r) => {
    if (tag && !r.tags.includes(tag)) return false;
    if (!q) return true;
    return (
      matches(r.title, q) ||
      r.tags.some((t) => matches(t, q)) ||
      r.ingredients.some((l) => matches(ingredientMap.get(l.ingredientId)?.name ?? '', q))
    );
  });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Recipes</h1>
        <Link className="btn btn-primary" to="/recipes/new">
          + New recipe
        </Link>
      </header>

      <input
        className="search"
        type="search"
        placeholder="Search by title, ingredient or category"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {allTags.length > 0 && (
        <div className="chip-row" role="group" aria-label="Filter by category">
          <button className={`chip chip-toggle ${tag === null ? 'on' : ''}`} onClick={() => setTag(null)}>
            All
          </button>
          {allTags.map((t) => (
            <button key={t} className={`chip chip-toggle ${tag === t ? 'on' : ''}`} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="empty">
          {recipes.length === 0 ? (
            <>
              <p>No recipes yet.</p>
              <Link className="btn btn-primary" to="/recipes/new">
                Create your first recipe
              </Link>
            </>
          ) : (
            <p>No recipe matches your search.</p>
          )}
        </div>
      )}

      <ul className="card-list">
        {filtered.map((r) => {
          const m = computeMacros(r, ingredientMap);
          const exps = experiments.filter((e) => e.recipeId === r.id);
          return (
            <li key={r.id}>
              <Link className="card card-button recipe-card" to={`/recipes/${r.id}`}>
                <div className="recipe-card-main">
                  <strong>{r.title}</strong>
                  {r.description && <p className="muted clamp">{r.description}</p>}
                  <div className="chip-row small">
                    {r.tags.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="recipe-card-side">
                  {m.per100 && (
                    <span className="kcal-pill">
                      {fmt(m.per100.kcal, 0)}
                      <small> kcal/100g</small>
                    </span>
                  )}
                  <span className="muted small-text">
                    {r.ingredients.length} ingr. · {exps.length} exp.
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
