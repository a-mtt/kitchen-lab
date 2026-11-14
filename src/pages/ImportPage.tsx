import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ImportReview } from '../components/ImportReview';
import { IMPORT_PROMPT } from '../lib/importPrompt';
import { parseRecipeText, type ParsedRecipe } from '../lib/recipeImport';
import { useIngredients } from '../lib/hooks';
import { useUnsavedGuard } from '../lib/useUnsavedGuard';
import { useFeedback } from '../ui/feedback';

export function ImportPage() {
  const feedback = useFeedback();
  const ingredients = useIngredients();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);
  const guard = useUnsavedGuard(text.trim() !== '' || parsed !== null);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      feedback.success('Prompt copied. Paste it into your AI chat.');
    } catch {
      feedback.error('Could not copy automatically. Open “Show the prompt” and copy it from there.');
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) return feedback.error('The clipboard is empty.');
      setText(clip);
    } catch {
      feedback.error('Could not read the clipboard. Long-press the box and choose Paste.');
    }
  };

  const read = () => {
    const result = parseRecipeText(text);
    if (result.ingredients.length === 0 && result.steps.length === 0) {
      feedback.error('No ingredients or steps found. Check that the text has “Ingredients” and “Steps” headings.');
      return;
    }
    setParsed(result);
    window.scrollTo(0, 0);
  };

  if (parsed && ingredients) {
    return (
      <ImportReview
        parsed={parsed}
        ingredients={ingredients}
        onBack={() => setParsed(null)}
        beforeSaveNavigate={guard.allowLeave}
      />
    );
  }

  return (
    <div className="page">
      <Link to="/" className="back">
        ← Recipes
      </Link>
      <header className="page-head">
        <h1>Import recipe</h1>
      </header>

      <section className="section">
        <h2>1. Ask your AI assistant</h2>
        <p className="muted">
          Copy this prompt and send it in your chat with Claude, ChatGPT, Perplexity or any other assistant. It asks for the
          recipe in a format Kitchen Lab can read, including nutrition per ingredient.
        </p>
        <div>
          <button type="button" className="btn btn-secondary" onClick={copyPrompt}>
            Copy prompt
          </button>
        </div>
        <details className="prompt-details">
          <summary>Show the prompt</summary>
          <pre className="prompt-text">{IMPORT_PROMPT}</pre>
        </details>
      </section>

      <section className="section">
        <h2>2. Paste the answer</h2>
        <p className="muted">
          Use the chat's Copy button on the recipe and paste it here. Other recipes with “Ingredients” and “Steps” headings
          work too.
        </p>
        <textarea
          className="import-text"
          rows={10}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'RECIPE: …\nINGREDIENTS:\n- 150 g | Flour | …\nSTEPS:\n1. …'}
          aria-label="Recipe text"
        />
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={pasteFromClipboard}>
            Paste from clipboard
          </button>
          <button type="button" className="btn btn-primary" onClick={read} disabled={!text.trim()}>
            Read recipe
          </button>
        </div>
      </section>
    </div>
  );
}
