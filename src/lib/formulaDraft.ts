import type { Formula, Ingredient, Unit } from '../db';

/** Editable draft of ingredients/steps; amounts kept as strings while typing. */
export interface DraftLine {
  ingredientId: number;
  amount: string;
  unit: Unit;
}

export interface FormulaDraft {
  lines: DraftLine[];
  steps: string[];
  finalWeight: string;
}

/** Parses a typed number ("1,5" or "1.5"). Returns null for empty or invalid input. */
export function parseNumber(value: string): number | null {
  const v = value.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formulaToDraft(f: Formula): FormulaDraft {
  return {
    lines: f.ingredients.map((l) => ({ ...l, amount: String(l.amount) })),
    steps: [...f.steps],
    finalWeight: f.finalWeight == null ? '' : String(f.finalWeight),
  };
}

export function parseAmount(amount: string, name: string): number {
  const n = parseNumber(amount);
  if (n == null || n <= 0) throw new Error(`Enter an amount above 0 for ${name}.`);
  return n;
}

export function parseFinalWeight(value: string): number | null {
  if (value.trim() === '') return null;
  const n = parseNumber(value);
  if (n == null || n <= 0) throw new Error('Final batch weight must be above 0.');
  return n;
}

export function cleanSteps(steps: string[]) {
  return steps.map((s) => s.trim()).filter(Boolean);
}

/** Validates a draft. Throws a user-facing message on bad input. */
export function draftToFormula(draft: FormulaDraft, ingredientMap: Map<number, Ingredient>): Formula {
  const ingredients = draft.lines.map((l) => ({
    ingredientId: l.ingredientId,
    amount: parseAmount(l.amount, ingredientMap.get(l.ingredientId)?.name ?? 'an ingredient'),
    unit: l.unit,
  }));
  return { ingredients, steps: cleanSteps(draft.steps), finalWeight: parseFinalWeight(draft.finalWeight) };
}
