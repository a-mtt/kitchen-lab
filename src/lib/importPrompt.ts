/** Text the user copies into their AI assistant so its answer imports cleanly. */
export const IMPORT_PROMPT = `Please write the recipe in the exact format below so I can import it into my recipe app. If we haven't talked about a recipe yet, ask me which one I want first.

Put the whole recipe inside ONE code block, with nothing else in the code block:

RECIPE: <name>
DESCRIPTION: <one short sentence>
CATEGORIES: <comma-separated, e.g. dessert, high-protein>
INGREDIENTS:
- <amount> <unit> | <ingredient name> | <kcal> kcal, P <protein>, F <fat>, C <carbs>, Fi <fiber>
STEPS:
1. <step>
2. <step>

Rules:
- Units: use only g, ml, tsp, tbsp or pc. Convert cups, ounces, pounds, sticks, pinches, cloves etc. into one of these.
- Use g for solids, ml for liquids, tsp or tbsp for small amounts such as spices, and pc for countable items such as eggs or bananas.
- For pc, add the weight of one piece: "2 pc @ 55 g".
- For ml, tsp or tbsp, add the ingredient's density: "1 tbsp @ 0.92 g/ml".
- Nutrition is per 100 g of the raw ingredient: kcal, then protein (P), fat (F), carbohydrates (C) and fiber (Fi) in grams.
- Ingredient names are short and generic, without preparation notes: "Butter", not "melted butter, cooled".
- One ingredient per line and one step per line. Put preparation details (melted, chopped...) in the steps.

Example:
RECIPE: Banana pancakes
DESCRIPTION: Quick pancakes sweetened with banana
CATEGORIES: breakfast, sweet
INGREDIENTS:
- 150 g | Oat flour | 389 kcal, P 16.9, F 6.9, C 66.3, Fi 10.6
- 1 pc @ 120 g | Banana | 89 kcal, P 1.1, F 0.3, C 22.8, Fi 2.6
- 2 pc @ 55 g | Egg | 143 kcal, P 12.6, F 9.5, C 0.7, Fi 0
- 250 ml @ 1.03 g/ml | Milk | 64 kcal, P 3.4, F 3.6, C 4.8, Fi 0
- 1 tsp @ 0.56 g/ml | Cinnamon | 247 kcal, P 4, F 1.2, C 81, Fi 53
STEPS:
1. Mash the banana and whisk in the eggs and milk.
2. Stir in the oat flour and cinnamon.
3. Fry spoonfuls in a hot pan, 2 min per side.`;
