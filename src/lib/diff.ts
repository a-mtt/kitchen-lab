import type { IngredientLine } from '../db';

export type IngredientChange =
  | { kind: 'added'; line: IngredientLine }
  | { kind: 'removed'; line: IngredientLine }
  | { kind: 'changed'; from: IngredientLine; to: IngredientLine };

export function diffIngredients(base: IngredientLine[], next: IngredientLine[]): IngredientChange[] {
  const changes: IngredientChange[] = [];
  const nextById = new Map(next.map((l) => [l.ingredientId, l]));
  const baseIds = new Set(base.map((l) => l.ingredientId));

  for (const b of base) {
    const n = nextById.get(b.ingredientId);
    if (!n) changes.push({ kind: 'removed', line: b });
    else if (n.amount !== b.amount || n.unit !== b.unit) changes.push({ kind: 'changed', from: b, to: n });
  }
  for (const n of next) {
    if (!baseIds.has(n.ingredientId)) changes.push({ kind: 'added', line: n });
  }
  return changes;
}

export type StepChange =
  | { kind: 'added'; step: number; text: string }
  | { kind: 'removed'; step: number; text: string }
  | { kind: 'changed'; step: number; from: string; to: string };

/**
 * Line diff of steps (LCS). Runs of removed + added steps at the same spot are
 * paired up as "changed". Step numbers refer to the experiment, except for
 * removed steps, which use the reference's numbering.
 */
export function diffSteps(base: string[], next: string[]): StepChange[] {
  const a = base.map((s) => s.trim());
  const b = next.map((s) => s.trim());
  const m = a.length;
  const n = b.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const changes: StepChange[] = [];
  let removed: { step: number; text: string }[] = [];
  let added: { step: number; text: string }[] = [];
  const flush = () => {
    const pairs = Math.min(removed.length, added.length);
    for (let k = 0; k < pairs; k++) {
      changes.push({ kind: 'changed', step: added[k].step, from: removed[k].text, to: added[k].text });
    }
    for (const r of removed.slice(pairs)) changes.push({ kind: 'removed', ...r });
    for (const ad of added.slice(pairs)) changes.push({ kind: 'added', ...ad });
    removed = [];
    added = [];
  };

  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      flush();
      i++;
      j++;
    } else if (j < n && (i >= m || lcs[i][j + 1] >= lcs[i + 1][j])) {
      added.push({ step: j + 1, text: next[j] });
      j++;
    } else {
      removed.push({ step: i + 1, text: base[i] });
      i++;
    }
  }
  flush();
  return changes;
}
