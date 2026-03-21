import { type ReactNode } from 'react';

import { Badge, Button, Card } from '../../components/ui';

interface ScreenHeroProps {
  actions?: ReactNode;
  badges?: Array<{
    label: string;
    tone?: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
  }>;
  description: string;
  eyebrow?: string;
  title: string;
}

interface MetricCardProps {
  detail?: string;
  label: string;
  tone?: 'danger' | 'info' | 'neutral' | 'success' | 'warning';
  value: string;
}

interface FeedbackCardProps {
  message: string;
  title: string;
  tone?: 'danger' | 'info' | 'success' | 'warning';
}

interface EmptyStateCardProps {
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'ghost' | 'primary' | 'secondary';
  };
  description: string;
  title: string;
}

interface FormFieldProps {
  children: ReactNode;
  hint?: string;
  label: string;
}

export function ScreenHero({
  actions,
  badges = [],
  description,
  eyebrow = 'CS Rio',
  title,
}: ScreenHeroProps): JSX.Element {
  return (
    <Card className="desktop-screen__hero">
      <div className="desktop-screen__hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        {badges.length > 0 ? (
          <div className="desktop-screen__badge-row">
            {badges.map((badge) => (
              <Badge key={`${badge.label}:${badge.tone ?? 'neutral'}`} tone={badge.tone ?? 'neutral'}>
                {badge.label}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      {actions ? <div className="desktop-screen__hero-actions">{actions}</div> : null}
    </Card>
  );
}

export function MetricCard({
  detail,
  label,
  tone = 'neutral',
  value,
}: MetricCardProps): JSX.Element {
  return (
    <Card className="desktop-metric-card" padding="sm">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small className={`desktop-tone--${tone}`}>{detail}</small> : null}
    </Card>
  );
}

export function FeedbackCard({
  message,
  title,
  tone = 'info',
}: FeedbackCardProps): JSX.Element {
  return (
    <Card className={`desktop-feedback desktop-feedback--${tone}`} padding="sm">
      <strong>{title}</strong>
      <p>{message}</p>
    </Card>
  );
}

export function EmptyStateCard({
  action,
  description,
  title,
}: EmptyStateCardProps): JSX.Element {
  return (
    <Card className="desktop-empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
      {action ? (
        <Button onClick={action.onClick} variant={action.variant ?? 'secondary'}>
          {action.label}
        </Button>
      ) : null}
    </Card>
  );
}

export function FormField({
  children,
  hint,
  label,
}: FormFieldProps): JSX.Element {
  return (
    <label className="desktop-field">
      <span className="desktop-field__label">{label}</span>
      {children}
      {hint ? <small className="desktop-field__hint">{hint}</small> : null}
    </label>
  );
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  }).format(new Date(value));
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
