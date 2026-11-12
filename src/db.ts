import Dexie, { type EntityTable } from 'dexie';

export type Unit = 'g' | 'pc';

export interface Ingredient {
  id: number;
  name: string;
  /** Values per 100 g. null = not filled in yet. */
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  /** Optional weight of one piece, enables the "pc" unit. */
  gramsPerPiece: number | null;
  createdAt: number;
}

export interface IngredientLine {
  ingredientId: number;
  amount: number;
  unit: Unit;
}

/** The parts of a recipe that an experiment can change. */
export interface Formula {
  ingredients: IngredientLine[];
  steps: string[];
  /** Weighed batch after cooking, in grams. null = use raw total. */
  finalWeight: number | null;
}

export interface Recipe extends Formula {
  id: number;
  title: string;
  description: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export type ExperimentStatus = 'untried' | 'pass' | 'fail';

export interface Experiment extends Formula {
  id: number;
  recipeId: number;
  title: string;
  status: ExperimentStatus;
  createdAt: number;
  updatedAt: number;
}

export const db = new Dexie('kitchen-lab') as Dexie & {
  ingredients: EntityTable<Ingredient, 'id'>;
  recipes: EntityTable<Recipe, 'id'>;
  experiments: EntityTable<Experiment, 'id'>;
};

db.version(1).stores({
  ingredients: '++id, name',
  recipes: '++id, title, *tags',
  experiments: '++id, recipeId',
});

export const NUTRIENTS = ['kcal', 'protein', 'fat', 'carbs', 'fiber'] as const;
export type Nutrient = (typeof NUTRIENTS)[number];

export const NUTRIENT_LABELS: Record<Nutrient, string> = {
  kcal: 'Energy',
  protein: 'Protein',
  fat: 'Fat',
  carbs: 'Carbs',
  fiber: 'Fiber',
};

export type IngredientInput = Omit<Ingredient, 'id' | 'createdAt'>;

function normalizeName(name: string) {
  return name.trim().toLocaleLowerCase();
}

export async function saveIngredient(input: IngredientInput, id?: number): Promise<Ingredient> {
  const name = input.name.trim();
  if (!name) throw new Error('Give the ingredient a name.');
  const clash = await db.ingredients
    .filter((i) => normalizeName(i.name) === normalizeName(name) && i.id !== id)
    .first();
  if (clash) throw new Error(`An ingredient called "${clash.name}" already exists.`);

  if (id != null) {
    await db.ingredients.update(id, { ...input, name });
    return (await db.ingredients.get(id))!;
  }
  const record = { ...input, name, createdAt: Date.now() };
  const newId = await db.ingredients.add(record as Ingredient);
  return { ...record, id: newId };
}

/** Deletes an ingredient unless a recipe or experiment still uses it. */
export async function deleteIngredient(id: number) {
  const recipes = await db.recipes.filter((r) => r.ingredients.some((l) => l.ingredientId === id)).toArray();
  const experiments = await db.experiments
    .filter((e) => e.ingredients.some((l) => l.ingredientId === id))
    .toArray();
  if (recipes.length || experiments.length) {
    const parentIds = new Set([...recipes.map((r) => r.id), ...experiments.map((e) => e.recipeId)]);
    const names = (await db.recipes.bulkGet([...parentIds])).filter(Boolean).map((r) => `"${r!.title}"`);
    throw new Error(`It's still used in ${names.join(', ')}. Remove it there first.`);
  }
  await db.ingredients.delete(id);
}

export async function deleteRecipe(id: number) {
  await db.transaction('rw', db.recipes, db.experiments, async () => {
    await db.experiments.where('recipeId').equals(id).delete();
    await db.recipes.delete(id);
  });
}

/**
 * Makes an experiment the recipe's reference. The current reference is kept
 * as a new experiment called "previous reference", and the promoted
 * experiment is removed (its content now lives in the recipe).
 */
export async function promoteExperiment(experimentId: number): Promise<number> {
  return db.transaction('rw', db.recipes, db.experiments, async () => {
    const exp = await db.experiments.get(experimentId);
    if (!exp) throw new Error('Experiment not found.');
    const recipe = await db.recipes.get(exp.recipeId);
    if (!recipe) throw new Error('Recipe not found.');
    const now = Date.now();
    await db.experiments.add({
      recipeId: recipe.id,
      title: 'previous reference',
      status: 'pass',
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      finalWeight: recipe.finalWeight,
      createdAt: now,
      updatedAt: now,
    } as Experiment);
    await db.recipes.update(recipe.id, {
      ingredients: exp.ingredients,
      steps: exp.steps,
      finalWeight: exp.finalWeight,
      updatedAt: now,
    });
    await db.experiments.delete(exp.id);
    return recipe.id;
  });
}
