import { useEffect, useRef } from 'react';

interface Props {
  steps: string[];
  onChange: (steps: string[]) => void;
}

export function StepsEditor({ steps, onChange }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const focusLast = useRef(false);

  useEffect(() => {
    if (!focusLast.current) return;
    focusLast.current = false;
    const areas = listRef.current?.querySelectorAll('textarea');
    areas?.[areas.length - 1]?.focus();
  }, [steps.length]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...steps];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <section className="section">
      <h2>Steps</h2>
      <ol className="step-edit-list" ref={listRef}>
        {steps.map((step, idx) => (
          <li key={idx} className="step-edit">
            <span className="step-num">{idx + 1}</span>
            <textarea
              rows={2}
              value={step}
              placeholder="Describe this step"
              aria-label={`Step ${idx + 1}`}
              onChange={(e) => onChange(steps.map((s, i) => (i === idx ? e.target.value : s)))}
            />
            <div className="step-tools">
              <button type="button" className="icon-btn" aria-label="Move up" disabled={idx === 0} onClick={() => move(idx, -1)}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label="Move down"
                disabled={idx === steps.length - 1}
                onClick={() => move(idx, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove step ${idx + 1}`}
                onClick={() => onChange(steps.filter((_, i) => i !== idx))}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          focusLast.current = true;
          onChange([...steps, '']);
        }}
      >
        + Add step
      </button>
    </section>
  );
}
