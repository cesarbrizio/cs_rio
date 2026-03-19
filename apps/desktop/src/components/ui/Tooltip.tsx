import { type ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps): JSX.Element {
  return (
    <span className="ui-tooltip">
      {children}
      <span className="ui-tooltip__bubble">{content}</span>
    </span>
  );
}
