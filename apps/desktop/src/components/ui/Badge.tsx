import { type HTMLAttributes } from 'react';

type BadgeTone = 'danger' | 'info' | 'neutral' | 'success' | 'warning';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({
  children,
  className,
  tone = 'neutral',
  ...rest
}: BadgeProps): JSX.Element {
  const classes = ['ui-badge', `ui-badge--${tone}`, className ?? null]
    .filter(Boolean)
    .join(' ');

  return (
    <span {...rest} className={classes}>
      {children}
    </span>
  );
}
