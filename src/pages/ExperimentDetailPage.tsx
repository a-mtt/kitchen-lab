import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, promoteExperiment, type ExperimentStatus } from '../db';
import { FormulaView } from '../components/FormulaView';
import { MacroPanel } from '../components/MacroPanel';
import { StatusPicker } from '../components/StatusPicker';
import { diffIngredients, diffSteps } from '../lib/diff';
import { useIngredientMap } from '../lib/hooks';
import { formatAmount } from '../lib/nutrition';
import { useFeedback } from '../ui/feedback';

export function ExperimentDetailPage() {
  const params = useParams();
  const recipeId = Number(params.id);
  const expId = Number(params.expId);
  const navigate = useNavigate();
  const feedback = useFeedback();
  const recipe = useLiveQuery(() => db.recipes.get(recipeId).then((r) => r ?? null), [recipeId]);
  const exp = useLiveQuery(() => db.experiments.get(expId).then((e) => e ?? null), [expId]);
  const ingredientMap = useIngredientMap();

  if (recipe === null || exp === null || (exp && exp.recipeId !== recipeId))
    return (
      <div className="page empty">
        <p>Experiment not found.</p>
        <Link to={recipe ? `/recipes/${recipeId}` : '/'}>Back</Link>
      </div>
    );
  if (!recipe || !exp || !ingredientMap) return <div className="page" />;

  const name = (id: number) => ingredientMap.get(id)?.name ?? 'Unknown ingredient';
  const ingChanges = diffIngredients(recipe.ingredients, exp.ingredients);
  const stepChanges = diffSteps(recipe.steps, exp.steps);
  const weightChanged = (recipe.finalWeight ?? null) !== (exp.finalWeight ?? null);

  const setStatus = async (status: ExperimentStatus) => {
    try {
      await db.experiments.update(exp.id, { status, updatedAt: Date.now() });
      feedback.success('Result saved.');
    } catch (err) {
      feedback.fail(err, 'Could not save the result.');
    }
  };

  const promote = async () => {
    const ok = await feedback.confirm({
      title: 'Make this the reference?',
      message: `"${recipe.title}" will use this experiment's ingredients and steps. The current version is kept as an experiment called "previous reference".`,
      confirmLabel: 'Make reference',
    });
    if (!ok) return;
    try {
      await promoteExperiment(exp.id);
      feedback.success('Experiment is now the reference.');
      navigate(`/recipes/${recipeId}`, { replace: true });
    } catch (err) {
      feedback.fail(err, 'Could not switch the reference.');
    }
  };

  const remove = async () => {
    const ok = await feedback.confirm({
      title: `Delete "${exp.title}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await db.experiments.delete(exp.id);
      feedback.success('Experiment deleted.');
      navigate(`/recipes/${recipeId}`, { replace: true });
    } catch (err) {
      feedback.fail(err, 'Could not delete the experiment.');
    }
  };

  return (
    <div className="page">
      <Link to={`/recipes/${recipeId}`} className="back">
        ← {recipe.title}
      </Link>
      <header className="page-head">
        <div>
          <p className="eyebrow">Experiment</p>
          <h1>{exp.title}</h1>
        </div>
        <div className="head-actions">
          <Link className="btn btn-ghost" to={`/recipes/${recipeId}/experiments/${exp.id}/edit`}>
            Edit
          </Link>
          <button className="btn btn-danger-ghost" onClick={remove}>
            Delete
          </button>
        </div>
      </header>

      <div className="status-row">
        <StatusPicker value={exp.status} onChange={setStatus} />
        <button className="btn btn-secondary" onClick={promote}>
          Make this the reference
        </button>
      </div>

      <section className="section diff">
        <h2>Changes from the reference</h2>
        {ingChanges.length === 0 && stepChanges.length === 0 && !weightChanged && (
          <p className="muted">No changes yet. Edit the experiment to change ingredients or steps.</p>
        )}
        {ingChanges.length > 0 && (
          <>
            <h3>Ingredients</h3>
            <ul className="diff-list">
              {ingChanges.map((c, i) => (
                <li key={i} className={`diff-${c.kind}`}>
                  {c.kind === 'added' && (
                    <>
                      <span className="diff-sign">+</span> {name(c.line.ingredientId)} {formatAmount(c.line)}
                    </>
                  )}
                  {c.kind === 'removed' && (
                    <>
                      <span className="diff-sign">−</span> <s>{name(c.line.ingredientId)} {formatAmount(c.line)}</s>
                    </>
                  )}
                  {c.kind === 'changed' && (
                    <>
                      <span className="diff-sign">~</span> {name(c.from.ingredientId)} <s>{formatAmount(c.from)}</s> →{' '}
                      <strong>{formatAmount(c.to)}</strong>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {stepChanges.length > 0 && (
          <>
            <h3>Cooking steps</h3>
            <ul className="diff-list">
              {stepChanges.map((c, i) => (
                <li key={i} className={`diff-${c.kind}`}>
                  {c.kind === 'added' && (
                    <>
                      <span className="diff-sign">+</span> <b>Step {c.step}:</b> {c.text}
                    </>
                  )}
                  {c.kind === 'removed' && (
                    <>
                      <span className="diff-sign">−</span> <b>Old step {c.step}:</b> <s>{c.text}</s>
                    </>
                  )}
                  {c.kind === 'changed' && (
                    <>
                      <span className="diff-sign">~</span> <b>Step {c.step}:</b> <s>{c.from}</s>
                      <br />→ <strong>{c.to}</strong>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {weightChanged && (
          <>
            <h3>Final batch weight</h3>
            <ul className="diff-list">
              <li className="diff-changed">
                <span className="diff-sign">~</span>{' '}
                <s>{recipe.finalWeight == null ? 'not set' : `${recipe.finalWeight} g`}</s> →{' '}
                <strong>{exp.finalWeight == null ? 'not set' : `${exp.finalWeight} g`}</strong>
              </li>
            </ul>
          </>
        )}
      </section>

      <MacroPanel formula={exp} ingredientMap={ingredientMap} compareTo={recipe} />
      <FormulaView formula={exp} ingredientMap={ingredientMap} />
    </div>
  );
}
