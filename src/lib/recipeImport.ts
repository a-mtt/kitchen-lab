import { NUTRIENTS, type Nutrient, type Unit } from '../db';

/**
 * Reads pasted recipe text. It understands the Kitchen Lab format produced by
 * IMPORT_PROMPT, and does its best with ordinary recipes that use headings
 * such as "Ingredients" and "Instructions". No AI is involved: plain rules.
 */

export interface ParsedIngredient {
  /** The original line, shown when something needs checking. */
  source: string;
  name: string;
  /** null when no usable amount was found. */
  amount: number | null;
  unit: Unit;
  gramsPerPiece: number | null;
  gramsPerMl: number | null;
  nutrition: Record<Nutrient, number | null>;
  /** Set when the line needs the user's attention. */
  problem: string | null;
}

export interface ParsedRecipe {
  title: string;
  description: string;
  tags: string[];
  ingredients: ParsedIngredient[];
  steps: string[];
  /** True when the Kitchen Lab format was recognised. */
  structured: boolean;
}

type Section = 'none' | 'ingredients' | 'steps';

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

/** Unit words → app unit, with a factor to convert into it. */
const UNIT_WORDS: [RegExp, Unit, number][] = [
  [/^(g|gr|grs|gram|grams|gramme|grammes)$/, 'g', 1],
  [/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/, 'g', 1000],
  [/^(mg|milligram|milligrams)$/, 'g', 0.001],
  [/^(ml|mls|milliliter|milliliters|millilitre|millilitres)$/, 'ml', 1],
  [/^(cl|centiliter|centiliters|centilitre|centilitres)$/, 'ml', 10],
  [/^(dl|deciliter|deciliters|decilitre|decilitres)$/, 'ml', 100],
  [/^(l|liter|liters|litre|litres)$/, 'ml', 1000],
  [/^(tsp|tsps|teaspoon|teaspoons)$/, 'tsp', 1],
  [/^(tbsp|tbsps|tbs|tbl|tablespoon|tablespoons)$/, 'tbsp', 1],
  [/^(pc|pcs|piece|pieces|whole)$/, 'pc', 1],
  [/^(oz|ounce|ounces)$/, 'g', 28.35],
  [/^(lb|lbs|pound|pounds)$/, 'g', 453.6],
];
const UNSUPPORTED_UNITS = /^(cups?|c|pints?|quarts?|gallons?|fl\.?\s?oz|sticks?|cans?|handfuls?|pinch(es)?|dash(es)?|cloves?|slices?|bunch(es)?|sprigs?)$/;

const NUTRIENT_ALIASES: Record<Nutrient, string> = {
  kcal: 'kcal|calories|cal|energy',
  protein: 'protein|prot|p',
  fat: 'fat|fats|f',
  carbs: 'carbs|carb|carbohydrates?|c',
  fiber: 'fibre|fiber|fi',
};

const NUM = String.raw`\d+(?:[.,]\d+)?`;

function toNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

/** Removes markdown decoration and invisible characters. */
function clean(line: string): string {
  return line
    .replace(/[​ ]/g, ' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/^#{1,6}\s*/, '')
    .trim();
}

/** Strips list markers: "-", "*", "•", "1.", "1)", "Step 1:". */
function stripMarker(line: string): string {
  return line.replace(/^(?:[-*•–·]\s+|\d{1,2}[.)]\s+|step\s*\d+\s*[:.)-]\s*)/i, '').trim();
}

/** Reads a quantity at the start of `text`: "1", "1.5", "1,5", "1/2", "1 1/2", "1½", "½", "2-3" (takes 2). */
function readQuantity(text: string): { value: number; rest: string } | null {
  let value: number;
  let m: RegExpMatchArray | null;
  if ((m = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/)) && Number(m[3])) {
    value = Number(m[1]) + Number(m[2]) / Number(m[3]);
  } else if ((m = text.match(/^(\d+)\s*\/\s*(\d+)/)) && Number(m[2])) {
    value = Number(m[1]) / Number(m[2]);
  } else if ((m = text.match(/^(\d+(?:[.,]\d+)?)?\s*([½⅓⅔¼¾⅕⅛⅜⅝⅞])/))) {
    value = (m[1] ? toNumber(m[1]) : 0) + UNICODE_FRACTIONS[m[2]];
  } else if ((m = text.match(/^\d+(?:[.,]\d+)?/))) {
    value = toNumber(m[0]);
  } else {
    return null;
  }
  // Drop the upper end of a range: "2-3", "2 to 3".
  const rest = text
    .slice(m[0].length)
    .replace(/^\s*(?:-|–|to)\s*\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?/, '')
    .trim();
  return { value, rest };
}

/** Reads a unit word at the start of `text`. */
function readUnit(text: string): { unit: Unit; factor: number; rest: string } | { unsupported: string; rest: string } | null {
  const m = text.match(/^([a-zA-Z]+\.?(?:\s?oz)?)\b\.?/);
  if (!m) return null;
  const word = m[1].toLowerCase().replace(/\.$/, '');
  for (const [re, unit, factor] of UNIT_WORDS) {
    if (re.test(word)) return { unit, factor, rest: text.slice(m[0].length).trim() };
  }
  if (UNSUPPORTED_UNITS.test(word)) return { unsupported: m[1], rest: text.slice(m[0].length).trim() };
  return null;
}

const SIZE_WORDS = /^(large|medium|small|big)\s+/i;

function readNutrition(text: string): Record<Nutrient, number | null> {
  const out = Object.fromEntries(NUTRIENTS.map((n) => [n, null])) as Record<Nutrient, number | null>;
  const t = ` ${text.toLowerCase()} `;
  for (const n of NUTRIENTS) {
    const a = NUTRIENT_ALIASES[n];
    // "P 10", "protein: 10g", "kcal 364"
    const before = t.match(new RegExp(String.raw`[\s,;(|](?:${a})\s*[:=]?\s*(${NUM})`));
    // "10 P", "10g protein", "364 kcal"
    const after = t.match(new RegExp(String.raw`(${NUM})\s*(?:g\s*)?(?:${a})(?![a-z])`));
    const hit = n === 'kcal' ? (after ?? before) : (before ?? after);
    if (hit) out[n] = toNumber(hit[1]);
  }
  return out;
}

/** Turns a cleaned name into something tidy: no notes in brackets, no ", chopped". */
function tidyName(raw: string): string {
  let name = raw
    .replace(/\([^)]*\)/g, ' ')
    .replace(/^(of|x)\s+/i, '')
    .split(/,|;|\s[-–—]\s/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  name = name.replace(SIZE_WORDS, '');
  return name ? name[0].toUpperCase() + name.slice(1) : '';
}

/** Parses a quantity spec like "150 g", "2 pc @ 55 g", "1 tbsp @ 0.92 g/ml". */
function parseQuantitySpec(spec: string) {
  let gramsPerPiece: number | null = null;
  let gramsPerMl: number | null = null;
  const at = spec.match(new RegExp(String.raw`@\s*(${NUM})\s*(g\s*\/\s*ml|g)?`, 'i'));
  let main = spec;
  if (at) {
    if (at[2] && /ml/i.test(at[2])) gramsPerMl = toNumber(at[1]);
    else gramsPerPiece = toNumber(at[1]);
    main = spec.slice(0, at.index).trim();
  }
  return { main, gramsPerPiece, gramsPerMl };
}

/** Parses "<quantity> <unit> <name>" or "<name>: <quantity> <unit>". */
function parseFreeLine(text: string): Omit<ParsedIngredient, 'source' | 'nutrition'> {
  const base = { gramsPerPiece: null as number | null, gramsPerMl: null as number | null };

  const lead = readQuantity(text);
  if (lead) {
    const unit = readUnit(lead.rest);
    if (unit && 'unsupported' in unit) {
      return {
        ...base,
        name: tidyName(unit.rest),
        amount: null,
        unit: 'g',
        problem: `“${text}”: ${unit.unsupported} isn't supported. Enter the amount in g or ml.`,
      };
    }
    if (unit) {
      return { ...base, name: tidyName(unit.rest), amount: round(lead.value * unit.factor), unit: unit.unit, problem: null };
    }
    return { ...base, name: tidyName(lead.rest), amount: lead.value, unit: 'pc', problem: null };
  }

  // "Flour: 150 g" or "Flour – 150 g"
  const tail = text.match(/^(.*?)(?::|\s[-–—]\s)\s*(.+)$/);
  if (tail) {
    const q = readQuantity(tail[2]);
    if (q) {
      const unit = readUnit(q.rest);
      if (unit && !('unsupported' in unit)) {
        return { ...base, name: tidyName(tail[1]), amount: round(q.value * unit.factor), unit: unit.unit, problem: null };
      }
      if (!unit) return { ...base, name: tidyName(tail[1]), amount: q.value, unit: 'pc', problem: null };
    }
  }

  return { ...base, name: tidyName(text), amount: null, unit: 'g', problem: `“${text}”: no amount found.` };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export function parseIngredientLine(line: string): ParsedIngredient | null {
  const source = stripMarker(clean(line));
  if (!source) return null;

  if (source.includes('|')) {
    const [qtyPart, namePart = '', ...rest] = source.split('|').map((s) => s.trim());
    const spec = parseQuantitySpec(qtyPart);
    const parsed = parseFreeLine(`${spec.main} ${namePart}`.trim());
    return {
      ...parsed,
      name: tidyName(namePart) || parsed.name,
      gramsPerPiece: spec.gramsPerPiece,
      gramsPerMl: spec.gramsPerMl,
      nutrition: readNutrition(rest.join(' ')),
      problem: parsed.problem,
      source,
    };
  }

  const parsed = parseFreeLine(source);
  if (!parsed.name) return null;
  return { ...parsed, nutrition: readNutrition(''), source };
}

// Whole-line headings, optionally followed by a note in brackets: "Ingredients (serves 4)".
const TAIL = String.raw`(?:\s*\(.*\))?$`;
const HEADING_INGREDIENTS = new RegExp(String.raw`^(?:ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need|shopping list)${TAIL}`, 'i');
const HEADING_STEPS = new RegExp(String.raw`^(?:steps?|instructions?|directions?|method|preparation|how to make(?: it)?|cooking steps)${TAIL}`, 'i');
const HEADING_OTHER = new RegExp(
  String.raw`^(?:notes?|tips?|nutrition(?: facts| info| information)?|macros|serving suggestions?|variations?|storage|equipment)${TAIL}`,
  'i',
);

function headingOf(line: string): { kind: 'title' | 'description' | 'categories' | Section | 'other'; inline: string } | null {
  const m = line.match(/^([A-Za-z’' ]{3,30}?)\s*:\s*(.*)$/);
  const label = (m ? m[1] : line).replace(/:$/, '').trim();
  const inline = m ? m[2].trim() : '';
  if (/^(recipe|title|name)$/i.test(label) && m) return { kind: 'title', inline };
  if (/^description$/i.test(label) && m) return { kind: 'description', inline };
  if (/^(categories|category|tags)$/i.test(label) && m) return { kind: 'categories', inline };
  // A section heading is a short line, optionally ending with ":".
  if (line.length > 40) return null;
  if (HEADING_INGREDIENTS.test(label)) return { kind: 'ingredients', inline };
  if (HEADING_STEPS.test(label)) return { kind: 'steps', inline };
  if (HEADING_OTHER.test(label)) return { kind: 'other', inline };
  return null;
}

export function parseRecipeText(text: string): ParsedRecipe {
  // If the recipe sits in a code block (as the prompt asks), ignore the chat around it.
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((b) => b[1]);
  const block = blocks.find((b) => /^\s*\**\s*INGREDIENTS\s*:?/im.test(b));
  const lines = (block ?? text).split(/\r?\n/).map(clean);
  const result: ParsedRecipe = { title: '', description: '', tags: [], ingredients: [], steps: [], structured: false };
  let section: Section | 'other' = 'none';
  const intro: string[] = [];

  for (const raw of lines) {
    if (!raw || /^```/.test(raw) || /^[-=_*]{3,}$/.test(raw)) continue;
    const h = headingOf(raw);
    if (h) {
      if (h.kind === 'title') {
        result.title = h.inline;
        result.structured = true;
        continue;
      }
      if (h.kind === 'description') {
        result.description = h.inline;
        continue;
      }
      if (h.kind === 'categories') {
        result.tags = [...new Set(h.inline.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))];
        continue;
      }
      section = h.kind;
      continue;
    }

    if (section === 'ingredients') {
      // Sub-headings like "For the batter:" carry no quantity.
      if (/:$/.test(raw) && !/\d/.test(raw)) continue;
      const ing = parseIngredientLine(raw);
      if (ing) result.ingredients.push(ing);
    } else if (section === 'steps') {
      if (/:$/.test(raw) && raw.length < 40) continue;
      // In the Kitchen Lab format steps are numbered; anything else is chat text.
      if (result.structured && stripMarker(raw) === raw) continue;
      const step = stripMarker(raw);
      if (step) result.steps.push(step);
    } else if (section === 'none') {
      intro.push(raw);
    }
  }

  if (!result.title) {
    // Free-form: use the last short line before the ingredients (usually the dish name).
    const candidate = [...intro].reverse().find((l) => l.length <= 60 && !/[.!?]$/.test(l));
    result.title = candidate ?? '';
  }

  // Same ingredient twice with the same unit: add the amounts together.
  const merged: ParsedIngredient[] = [];
  for (const ing of result.ingredients) {
    const twin = merged.find((m) => m.name.toLowerCase() === ing.name.toLowerCase() && m.unit === ing.unit);
    if (twin && twin.amount != null && ing.amount != null) twin.amount = round(twin.amount + ing.amount);
    else merged.push(ing);
  }
  result.ingredients = merged;
  return result;
}

/** Name used to match imported ingredients to saved ones. */
export function matchKey(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Simple singular: "eggs" → "egg", "tomatoes" → "tomato", "berries" → "berry".
  return base
    .split(' ')
    .map((w) => (w.length > 3 && w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 2 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ');
}
