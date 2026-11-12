import type { ExperimentStatus } from '../db';

export const STATUS_LABELS: Record<ExperimentStatus, string> = {
  untried: 'Not tried',
  pass: 'Pass',
  fail: 'Fail',
};

export function StatusBadge({ status }: { status: ExperimentStatus }) {
  return <span className={`badge status-${status}`}>{STATUS_LABELS[status]}</span>;
}

export function StatusPicker({ value, onChange }: { value: ExperimentStatus; onChange: (s: ExperimentStatus) => void }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Result">
      {(['untried', 'pass', 'fail'] as const).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          className={`seg seg-${s} ${value === s ? 'on' : ''}`}
          onClick={() => onChange(s)}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
