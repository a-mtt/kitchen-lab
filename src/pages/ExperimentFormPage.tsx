import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, type Experiment, type ExperimentStatus, type Recipe } from '../db';
import { FormulaEditor, draftToFormula, formulaToDraft, type FormulaDraft } from '../components/FormulaEditor';
import { StatusPicker } from '../components/StatusPicker';
import { useIngredientMap, useIngredients } from '../lib/hooks';
import { useFeedback } from '../ui/feedback';

export function ExperimentFormPage() {
  const params = useParams();
  const recipeId = Number(params.id);
  const expId = params.expId ? Number(params.expId) : undefined;
  const navigate = useNavigate();
  const feedback = useFeedback();
  const ingredients = useIngredients();
  const ingredientMap = useIngredientMap();

  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<ExperimentStatus>('untried');
  const [draft, setDraft] = useState<FormulaDraft | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await db.recipes.get(recipeId);
      if (!r) return setRecipe(null);
      if (expId != null) {
        const e = await db.experiments.get(expId);
        if (!e || e.recipeId !== recipeId) return setRecipe(null);
        setTitle(e.title);
        setStatus(e.status);
        setDraft(formulaToDraft(e));
      } else {
        // A new experiment starts as a copy of the current reference.
        setDraft(formulaToDraft(r));
      }
      setRecipe(r);
    })();
  }, [recipeId, expId]);

  if (recipe === null)
    return (
      <div className="page empty">
        <p>Not found.</p>
        <Link to="/">Back to recipes</Link>
      </div>
    );
  if (!recipe || !draft || !ingredients || !ingredientMap) return <div className="page" />;

  const backTo = expId == null ? `/recipes/${recipeId}` : `/recipes/${recipeId}/experiments/${expId}`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!title.trim()) throw new Error('Describe what you are trying in the title.');
      const formula = draftToFormula(draft, ingredientMap);
      const now = Date.now();
      const data = { title: title.trim(), status, ...formula, updatedAt: now };
      let savedId = expId;
      if (expId != null) await db.experiments.update(expId, data);
      else savedId = await db.experiments.add({ ...data, recipeId, createdAt: now } as Experiment);
      feedback.success(`Saved experiment "${data.title}".`);
      navigate(`/recipes/${recipeId}/experiments/${savedId}`, { replace: true });
    } catch (err) {
      feedback.fail(err, 'Could not save the experiment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="page" onSubmit={submit}>
      <Link to={backTo} className="back">
        ← {recipe.title}
      </Link>
      <header className="page-head">
        <h1>{expId == null ? 'Plan experiment' : 'Edit experiment'}</h1>
      </header>
      {expId == null && (
        <p className="muted">Starts as a copy of the current recipe. Change what you want to try.</p>
      )}

      <section className="section stack">
        <label className="field">
          <span>What are you trying?</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Less sugar, add cocoa"
            autoFocus={expId == null}
            required
          />
        </label>
        <div className="field">
          <span>Result</span>
          <StatusPicker value={status} onChange={setStatus} />
        </div>
      </section>

      <FormulaEditor draft={draft} onChange={setDraft} ingredients={ingredients} ingredientMap={ingredientMap} />

      <div className="form-bar">
        <Link className="btn btn-ghost" to={backTo}>
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save experiment'}
        </button>
      </div>
    </form>
  );
}
