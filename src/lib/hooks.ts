import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db, type Ingredient } from '../db';

export function useIngredients() {
  return useLiveQuery(() => db.ingredients.orderBy('name').toArray(), []);
}

export function useIngredientMap() {
  const list = useIngredients();
  return useMemo(() => (list ? new Map<number, Ingredient>(list.map((i) => [i.id, i])) : undefined), [list]);
}

export function matches(text: string, query: string) {
  return text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
