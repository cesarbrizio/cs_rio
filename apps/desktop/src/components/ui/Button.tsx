import { type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';
type ButtonSize = 'lg' | 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  block?: boolean;
  icon?: ReactNode;
  isBusy?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  block = false,
  children,
  className,
  disabled,
  icon,
  isBusy = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...rest
}: ButtonProps): JSX.Element {
  const classes = [
    'ui-button',
    `ui-button--${variant}`,
    `ui-button--${size}`,
    block ? 'ui-button--block' : null,
    className ?? null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button {...rest} className={classes} disabled={disabled || isBusy} type={type}>
      {icon ? <span className="ui-button__icon">{icon}</span> : null}
      <span>{isBusy ? 'Processando...' : children}</span>
    </button>
  );
}
