import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { db, type Recipe } from '../db';
import { FormulaEditor, draftToFormula, formulaToDraft, type FormulaDraft } from '../components/FormulaEditor';
import { TagInput } from '../components/TagInput';
import { useIngredientMap, useIngredients } from '../lib/hooks';
import { useFeedback } from '../ui/feedback';

export function RecipeFormPage() {
  const { id } = useParams();
  const recipeId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const feedback = useFeedback();
  const ingredients = useIngredients();
  const ingredientMap = useIngredientMap();
  const allRecipes = useLiveQuery(() => db.recipes.toArray(), []);
  const suggestions = useMemo(() => [...new Set((allRecipes ?? []).flatMap((r) => r.tags))].sort(), [allRecipes]);

  const [loaded, setLoaded] = useState(recipeId == null);
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState<FormulaDraft>({ lines: [], steps: [''], finalWeight: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recipeId == null) return;
    db.recipes.get(recipeId).then((r) => {
      if (!r) setNotFound(true);
      else {
        setTitle(r.title);
        setDescription(r.description);
        setTags(r.tags);
        setDraft(formulaToDraft(r));
      }
      setLoaded(true);
    });
  }, [recipeId]);

  if (notFound) return <div className="page empty"><p>Recipe not found.</p><Link to="/">Back to recipes</Link></div>;
  if (!loaded || !ingredients || !ingredientMap) return <div className="page" />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!title.trim()) throw new Error('Give the recipe a title.');
      const formula = draftToFormula(draft, ingredientMap);
      const now = Date.now();
      const data = { title: title.trim(), description: description.trim(), tags, ...formula, updatedAt: now };
      let savedId = recipeId;
      if (recipeId != null) await db.recipes.update(recipeId, data);
      else savedId = await db.recipes.add({ ...data, createdAt: now } as Recipe);
      feedback.success(`Saved "${data.title}".`);
      navigate(`/recipes/${savedId}`, { replace: true });
    } catch (err) {
      feedback.fail(err, 'Could not save the recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="page" onSubmit={submit}>
      <header className="page-head">
        <h1>{recipeId == null ? 'New recipe' : 'Edit recipe'}</h1>
      </header>

      <section className="section stack">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={recipeId == null} required />
        </label>
        <label className="field">
          <span>
            Description <small>optional</small>
          </span>
          <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="field">
          <span>
            Categories <small>press Enter or comma to add</small>
          </span>
          <TagInput tags={tags} onChange={setTags} suggestions={suggestions} />
        </div>
      </section>

      <FormulaEditor draft={draft} onChange={setDraft} ingredients={ingredients} ingredientMap={ingredientMap} />

      <div className="form-bar">
        <Link className="btn btn-ghost" to={recipeId == null ? '/' : `/recipes/${recipeId}`}>
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </form>
  );
}
