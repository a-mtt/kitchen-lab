import { isVolume, ML_PER, NUTRIENTS, type Formula, type Ingredient, type IngredientLine, type Nutrient } from '../db';

export type IngredientMap = Map<number, Ingredient>;

/** Grams for one line, or null if a piece weight is missing. */
export function lineGrams(line: IngredientLine, ing: Ingredient | undefined): number | null {
  if (line.unit === 'g') return line.amount;
  if (isVolume(line.unit)) return line.amount * ML_PER[line.unit] * (ing?.gramsPerMl || 1);
  if (!ing?.gramsPerPiece) return null;
  return line.amount * ing.gramsPerPiece;
}

export interface MacroResult {
  rawWeight: number;
  weight: number;
  usesFinalWeight: boolean;
  totals: Record<Nutrient, number>;
  per100: Record<Nutrient, number> | null;
  /** Ingredient names with missing nutrition values. */
  missingValues: string[];
  /** Ingredient names counted in pieces without a piece weight. */
  missingPieceWeight: string[];
  /** Ingredient names measured by volume without a density (1 g/ml assumed). */
  assumedDensity: string[];
}

export function computeMacros(formula: Formula, ingredients: IngredientMap): MacroResult {
  const totals = Object.fromEntries(NUTRIENTS.map((n) => [n, 0])) as Record<Nutrient, number>;
  const missingValues: string[] = [];
  const missingPieceWeight: string[] = [];
  const assumedDensity: string[] = [];
  let rawWeight = 0;

  for (const line of formula.ingredients) {
    const ing = ingredients.get(line.ingredientId);
    const grams = lineGrams(line, ing);
    const name = ing?.name ?? 'Unknown ingredient';
    if (grams == null) {
      missingPieceWeight.push(name);
      continue;
    }
    if (isVolume(line.unit) && !ing?.gramsPerMl) assumedDensity.push(name);
    rawWeight += grams;
    let missing = false;
    for (const n of NUTRIENTS) {
      const v = ing?.[n];
      if (v == null) missing = true;
      else totals[n] += (v * grams) / 100;
    }
    if (missing) missingValues.push(name);
  }

  const usesFinalWeight = formula.finalWeight != null && formula.finalWeight > 0;
  const weight = usesFinalWeight ? formula.finalWeight! : rawWeight;
  const per100 =
    weight > 0
      ? (Object.fromEntries(NUTRIENTS.map((n) => [n, (totals[n] / weight) * 100])) as Record<Nutrient, number>)
      : null;

  return { rawWeight, weight, usesFinalWeight, totals, per100, missingValues, missingPieceWeight, assumedDensity };
}

export function fmt(n: number, digits = 1) {
  const rounded = Number(n.toFixed(digits));
  return rounded.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function formatAmount(line: { amount: number; unit: IngredientLine['unit'] }) {
  return `${fmt(line.amount, line.unit === 'g' ? 1 : 2)} ${line.unit}`;
}
