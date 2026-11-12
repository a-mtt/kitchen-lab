import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, deleteRecipe } from '../db';
import { FormulaView } from '../components/FormulaView';
import { MacroPanel } from '../components/MacroPanel';
import { StatusBadge } from '../components/StatusPicker';
import { diffIngredients, diffSteps } from '../lib/diff';
import { useIngredientMap } from '../lib/hooks';
import { useFeedback } from '../ui/feedback';

export function RecipeDetailPage() {
  const recipeId = Number(useParams().id);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const recipe = useLiveQuery(() => db.recipes.get(recipeId).then((r) => r ?? null), [recipeId]);
  const experiments = useLiveQuery(
    () => db.experiments.where('recipeId').equals(recipeId).reverse().sortBy('createdAt'),
    [recipeId],
  );
  const ingredientMap = useIngredientMap();

  if (recipe === null)
    return (
      <div className="page empty">
        <p>Recipe not found.</p>
        <Link to="/">Back to recipes</Link>
      </div>
    );
  if (!recipe || !experiments || !ingredientMap) return <div className="page" />;

  const remove = async () => {
    const ok = await feedback.confirm({
      title: `Delete "${recipe.title}"?`,
      message: `Its ${experiments.length} experiment(s) will be deleted too. This cannot be undone.`,
      confirmLabel: 'Delete recipe',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRecipe(recipe.id);
      feedback.success(`Deleted "${recipe.title}".`);
      navigate('/', { replace: true });
    } catch (err) {
      feedback.fail(err, 'Could not delete the recipe.');
    }
  };

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Recipes
      </Link>
      <header className="page-head">
        <div>
          <h1>{recipe.title}</h1>
          {recipe.tags.length > 0 && (
            <div className="chip-row small">
              {recipe.tags.map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="head-actions">
          <Link className="btn btn-ghost" to={`/recipes/${recipe.id}/edit`}>
            Edit
          </Link>
          <button className="btn btn-danger-ghost" onClick={remove}>
            Delete
          </button>
        </div>
      </header>
      {recipe.description && <p className="description">{recipe.description}</p>}

      <MacroPanel formula={recipe} ingredientMap={ingredientMap} />
      <FormulaView formula={recipe} ingredientMap={ingredientMap} />

      <section className="section">
        <div className="section-head">
          <h2>Experiments</h2>
          <Link className="btn btn-primary btn-small" to={`/recipes/${recipe.id}/experiments/new`}>
            + Plan experiment
          </Link>
        </div>
        {experiments.length === 0 ? (
          <p className="muted">No experiments yet. Plan one to try a variation of this recipe.</p>
        ) : (
          <ul className="card-list">
            {experiments.map((e) => {
              const ingChanges = diffIngredients(recipe.ingredients, e.ingredients).length;
              const stepChanges = diffSteps(recipe.steps, e.steps).length;
              const parts = [
                ingChanges && `${ingChanges} ingredient change${ingChanges > 1 ? 's' : ''}`,
                stepChanges && `${stepChanges} step change${stepChanges > 1 ? 's' : ''}`,
              ].filter(Boolean);
              return (
                <li key={e.id}>
                  <Link className="card card-button exp-card" to={`/recipes/${recipe.id}/experiments/${e.id}`}>
                    <div>
                      <strong>{e.title}</strong>
                      <p className="muted small-text">{parts.length ? parts.join(' · ') : 'Same as reference'}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
