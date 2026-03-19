import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string | null;
  hint?: string;
  label: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, hint, label, leading, trailing, ...rest },
  ref,
) {
  const wrapperClassName = [
    'ui-input',
    error ? 'ui-input--error' : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label className={wrapperClassName}>
      <span className="ui-input__label">{label}</span>
      <span className="ui-input__field">
        {leading ? <span className="ui-input__leading">{leading}</span> : null}
        <input {...rest} ref={ref} />
        {trailing ? <span className="ui-input__trailing">{trailing}</span> : null}
      </span>
      {error ? <span className="ui-input__error">{error}</span> : null}
      {!error && hint ? <span className="ui-input__hint">{hint}</span> : null}
    </label>
  );
});
