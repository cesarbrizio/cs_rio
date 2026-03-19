interface ProgressBarProps {
  label: string;
  max?: number;
  tone?: 'danger' | 'info' | 'success' | 'warning';
  value: number;
}

export function ProgressBar({
  label,
  max = 100,
  tone = 'info',
  value,
}: ProgressBarProps): JSX.Element {
  const clampedValue = Math.max(0, Math.min(max, value));
  const percentage = max > 0 ? (clampedValue / max) * 100 : 0;

  return (
    <div className="ui-progress">
      <div className="ui-progress__header">
        <span>{label}</span>
        <strong>{Math.round(clampedValue)}</strong>
      </div>
      <div className="ui-progress__track">
        <span
          className={`ui-progress__fill ui-progress__fill--${tone}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
