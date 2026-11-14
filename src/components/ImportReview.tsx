import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  db,
  isVolume,
  NUTRIENT_LABELS,
  NUTRIENTS,
  saveIngredient,
  type Ingredient,
  type IngredientLine,
  type Nutrient,
  type Recipe,
  type Unit,
} from '../db';
import { cleanSteps, parseAmount, parseFinalWeight, parseNumber } from '../lib/formulaDraft';
import { fmt } from '../lib/nutrition';
import { matchKey, type ParsedIngredient, type ParsedRecipe } from '../lib/recipeImport';
import { useFeedback } from '../ui/feedback';
import { FinalWeightField } from './FormulaEditor';
import { IngredientPicker } from './IngredientPicker';
import { StepsEditor } from './StepsEditor';
import { TagInput } from './TagInput';
import { UnitSelect } from './UnitSelect';

type ValueField = Nutrient | 'gramsPerPiece' | 'gramsPerMl';
const VALUE_FIELDS: ValueField[] = [...NUTRIENTS, 'gramsPerPiece', 'gramsPerMl'];
const VALUE_LABELS: Record<ValueField, string> = {
  ...NUTRIENT_LABELS,
  gramsPerPiece: '1 pc (g)',
  gramsPerMl: 'g per ml',
};

interface Row {
  key: number;
  parsed: ParsedIngredient;
  matchId: number | null;
  /** Name for a new ingredient. */
  name: string;
  amount: string;
  unit: Unit;
  /** Values for a new ingredient, editable before saving. */
  values: Record<ValueField, string>;
  /** For a matched ingredient: replace saved nutrition with the imported values. */
  updateSaved: boolean;
  matching: boolean;
}

const str = (v: number | null) => (v == null ? '' : String(v));

function findMatch(name: string, ingredients: Ingredient[]) {
  const key = matchKey(name);
  return key ? (ingredients.find((i) => matchKey(i.name) === key) ?? null) : null;
}

/** Imported nutrition values that differ from (or fill gaps in) a saved ingredient. */
function nutritionDiffs(saved: Ingredient, parsed: ParsedIngredient) {
  return NUTRIENTS.flatMap((n) => {
    const imported = parsed.nutrition[n];
    if (imported == null) return [];
    const current = saved[n];
    if (current != null && Math.abs(current - imported) <= Math.max(0.05, 0.02 * Math.max(current, imported))) return [];
    return [{ n, current, imported }];
  });
}

interface Props {
  parsed: ParsedRecipe;
  ingredients: Ingredient[];
  onBack: () => void;
  beforeSaveNavigate: () => void;
}

export function ImportReview({ parsed, ingredients, onBack, beforeSaveNavigate }: Props) {
  const navigate = useNavigate();
  const feedback = useFeedback();
  const allRecipes = useLiveQuery(() => db.recipes.toArray(), []);
  const suggestions = useMemo(() => [...new Set((allRecipes ?? []).flatMap((r) => r.tags))].sort(), [allRecipes]);
  const byId = useMemo(() => new Map(ingredients.map((i) => [i.id, i])), [ingredients]);

  const [title, setTitle] = useState(parsed.title);
  const [description, setDescription] = useState(parsed.description);
  const [tags, setTags] = useState(parsed.tags);
  const [steps, setSteps] = useState(parsed.steps.length ? parsed.steps : ['']);
  const [finalWeight, setFinalWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    parsed.ingredients.map((p, key) => ({
      key,
      parsed: p,
      matchId: findMatch(p.name, ingredients)?.id ?? null,
      name: p.name,
      amount: str(p.amount),
      unit: p.unit,
      values: {
        ...(Object.fromEntries(NUTRIENTS.map((n) => [n, str(p.nutrition[n])])) as Record<Nutrient, string>),
        gramsPerPiece: str(p.gramsPerPiece),
        gramsPerMl: str(p.gramsPerMl),
      },
      updateSaved: false,
      matching: false,
    })),
  );

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((all) => all.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const newCount = rows.filter((r) => r.matchId == null).length;
  const problems = rows.filter((r) => r.parsed.problem && r.amount.trim() === '').length;

  const save = async () => {
    setSaving(true);
    try {
      if (!title.trim()) throw new Error('Give the recipe a title.');
      // Validate everything before writing anything.
      const prepared = rows.map((r) => {
        const label = r.matchId != null ? (byId.get(r.matchId)?.name ?? r.name) : r.name.trim();
        if (!label) throw new Error('Every new ingredient needs a name.');
        const values = Object.fromEntries(
          VALUE_FIELDS.map((f) => {
            const n = parseNumber(r.values[f]);
            if (r.values[f].trim() !== '' && (n == null || n < 0)) {
              throw new Error(`${VALUE_LABELS[f]} for ${label} must be a number of 0 or more.`);
            }
            return [f, n];
          }),
        ) as Record<ValueField, number | null>;
        return { row: r, label, amount: parseAmount(r.amount, label), values };
      });
      const recipeFinalWeight = parseFinalWeight(finalWeight);

      const recipeId = await db.transaction('rw', db.ingredients, db.recipes, async () => {
        const createdByKey = new Map<string, number>();
        const lines: IngredientLine[] = [];
        for (const { row, label, amount, values } of prepared) {
          let id: number;
          if (row.matchId != null) {
            id = row.matchId;
            const saved = await db.ingredients.get(id);
            if (!saved) throw new Error(`${label} no longer exists.`);
            const patch: Partial<Ingredient> = {};
            if (row.updateSaved) for (const d of nutritionDiffs(saved, row.parsed)) patch[d.n] = d.imported;
            // Conversion facts the recipe needs are filled in when missing; saved values are never replaced.
            if (!saved.gramsPerPiece && row.parsed.gramsPerPiece) patch.gramsPerPiece = row.parsed.gramsPerPiece;
            if (!saved.gramsPerMl && row.parsed.gramsPerMl) patch.gramsPerMl = row.parsed.gramsPerMl;
            if (Object.keys(patch).length) await db.ingredients.update(id, patch);
          } else {
            const key = matchKey(label);
            const existing = createdByKey.get(key);
            if (existing != null) id = existing;
            else {
              const created = await saveIngredient({
                name: label,
                kcal: values.kcal,
                protein: values.protein,
                fat: values.fat,
                carbs: values.carbs,
                fiber: values.fiber,
                gramsPerPiece: values.gramsPerPiece || null,
                gramsPerMl: values.gramsPerMl || null,
              });
              id = created.id;
              createdByKey.set(key, id);
            }
          }
          if (lines.some((l) => l.ingredientId === id)) {
            throw new Error(`${label} is in the list twice. Remove one of them or add the amounts together.`);
          }
          lines.push({ ingredientId: id, amount, unit: row.unit });
        }
        const now = Date.now();
        return db.recipes.add({
          title: title.trim(),
          description: description.trim(),
          tags,
          ingredients: lines,
          steps: cleanSteps(steps),
          finalWeight: recipeFinalWeight,
          createdAt: now,
          updatedAt: now,
        } as Recipe);
      });

      feedback.success(
        newCount ? `Imported "${title.trim()}" and ${newCount} new ingredient${newCount > 1 ? 's' : ''}.` : `Imported "${title.trim()}".`,
      );
      beforeSaveNavigate();
      navigate(`/recipes/${recipeId}`, { replace: true });
    } catch (err) {
      feedback.fail(err, 'Could not import the recipe.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <button type="button" className="back link-button" onClick={onBack}>
        ← Back to the pasted text
      </button>
      <header className="page-head">
        <h1>Check the import</h1>
      </header>
      <p className="muted">
        Nothing is saved yet. Check what was read, fix anything that's off, then save.
        {!parsed.structured && ' This text wasn’t in the Kitchen Lab format, so nutrition values are missing.'}
      </p>

      <section className="section stack">
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
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

      <section className="section">
        <div className="section-head">
          <h2>Ingredients</h2>
          <span className="muted small-text">
            {rows.length - newCount} saved · {newCount} new
          </span>
        </div>
        {problems > 0 && (
          <p className="warn">
            {problems} ingredient{problems > 1 ? 's need' : ' needs'} an amount. They're marked below.
          </p>
        )}
        {rows.length === 0 && <p className="muted">No ingredients were found in the text.</p>}
        <ul className="import-list">
          {rows.map((r) => {
            const saved = r.matchId != null ? byId.get(r.matchId) : undefined;
            const diffs = saved ? nutritionDiffs(saved, r.parsed) : [];
            const pieceWeight = saved ? saved.gramsPerPiece || r.parsed.gramsPerPiece : parseNumber(r.values.gramsPerPiece);
            const willAddPiece = saved && !saved.gramsPerPiece && r.parsed.gramsPerPiece && r.unit === 'pc';
            const willAddDensity = saved && !saved.gramsPerMl && r.parsed.gramsPerMl && isVolume(r.unit);
            const usedIds = rows.filter((o) => o.key !== r.key && o.matchId != null).map((o) => o.matchId!);
            return (
              <li key={r.key} className={`import-row ${saved ? 'is-saved' : 'is-new'}`}>
                <div className="import-row-top">
                  {saved ? (
                    <strong className="import-name">{saved.name}</strong>
                  ) : (
                    <input
                      className="import-name-input"
                      value={r.name}
                      aria-label="New ingredient name"
                      onChange={(e) => setRow(r.key, { name: e.target.value })}
                    />
                  )}
                  <span className={`badge ${saved ? 'status-pass' : 'badge-new'}`}>{saved ? 'Saved' : 'New'}</span>
                </div>

                <div className="import-row-qty">
                  <input
                    className="line-amount"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Amount of ${saved?.name ?? r.name}`}
                    value={r.amount}
                    onChange={(e) => setRow(r.key, { amount: e.target.value })}
                  />
                  <UnitSelect value={r.unit} allowPiece={!!pieceWeight} onChange={(unit) => setRow(r.key, { unit })} />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${saved?.name ?? r.name}`}
                    onClick={() => setRows((all) => all.filter((o) => o.key !== r.key))}
                  >
                    ×
                  </button>
                </div>

                {r.parsed.problem && r.amount.trim() === '' && <p className="warn">{r.parsed.problem}</p>}
                {r.unit === 'pc' && !pieceWeight && (
                  <p className="warn">Add the weight of one piece{saved ? ' on the ingredient' : ' below'}, or use g.</p>
                )}

                {saved && (
                  <>
                    {r.parsed.name.toLowerCase() !== saved.name.toLowerCase() && (
                      <p className="hint">Read as “{r.parsed.name}”.</p>
                    )}
                    {willAddPiece && <p className="hint">Will also save 1 pc = {fmt(r.parsed.gramsPerPiece!)} g on {saved.name}.</p>}
                    {willAddDensity && <p className="hint">Will also save {fmt(r.parsed.gramsPerMl!, 2)} g/ml on {saved.name}.</p>}
                    {diffs.length > 0 && (
                      <div className="conflict">
                        <p>
                          <strong>The import has different values</strong> (per 100 g):
                        </p>
                        <ul>
                          {diffs.map((d) => (
                            <li key={d.n}>
                              {NUTRIENT_LABELS[d.n]}: yours {d.current == null ? '—' : fmt(d.current)} · imported {fmt(d.imported)}
                            </li>
                          ))}
                        </ul>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={r.updateSaved}
                            onChange={(e) => setRow(r.key, { updateSaved: e.target.checked })}
                          />
                          Update {saved.name} with the imported values
                        </label>
                      </div>
                    )}
                    <button type="button" className="link-button small-text" onClick={() => setRow(r.key, { matchId: null, updateSaved: false })}>
                      Not this ingredient: create a new one
                    </button>
                  </>
                )}

                {!saved && (
                  <>
                    <details className="values-details">
                      <summary>
                        {NUTRIENTS.every((n) => r.values[n].trim() === '')
                          ? 'No nutrition values: add them'
                          : `${r.values.kcal || '—'} kcal · P ${r.values.protein || '—'} · F ${r.values.fat || '—'} · C ${r.values.carbs || '—'} · Fi ${r.values.fiber || '—'} per 100 g`}
                      </summary>
                      <div className="grid-fields">
                        {VALUE_FIELDS.map((f) => (
                          <label className="field" key={f}>
                            <span>{VALUE_LABELS[f]}</span>
                            <input
                              inputMode="decimal"
                              placeholder="—"
                              value={r.values[f]}
                              onChange={(e) => setRow(r.key, { values: { ...r.values, [f]: e.target.value } })}
                            />
                          </label>
                        ))}
                      </div>
                    </details>
                    {r.matching ? (
                      <div className="stack">
                        <IngredientPicker
                          ingredients={ingredients}
                          excludeIds={usedIds}
                          allowCreate={false}
                          autoFocus
                          placeholder="Search your saved ingredients…"
                          onPick={(ing) => setRow(r.key, { matchId: ing.id, matching: false })}
                        />
                        <button type="button" className="link-button small-text" onClick={() => setRow(r.key, { matching: false })}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      ingredients.length > 0 && (
                        <button type="button" className="link-button small-text" onClick={() => setRow(r.key, { matching: true })}>
                          It's one of my saved ingredients
                        </button>
                      )
                    )}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <StepsEditor steps={steps} onChange={setSteps} />
      <FinalWeightField value={finalWeight} onChange={setFinalWeight} />

      <div className="form-bar">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          Back
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save recipe'}
        </button>
      </div>
    </div>
  );
}
