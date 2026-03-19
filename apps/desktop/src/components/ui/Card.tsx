import { type HTMLAttributes } from 'react';

type CardPadding = 'lg' | 'md' | 'sm';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

export function Card({
  children,
  className,
  padding = 'md',
  ...rest
}: CardProps): JSX.Element {
  const classes = ['ui-card', `ui-card--${padding}`, className ?? null]
    .filter(Boolean)
    .join(' ');

  return (
    <div {...rest} className={classes}>
      {children}
    </div>
  );
}
