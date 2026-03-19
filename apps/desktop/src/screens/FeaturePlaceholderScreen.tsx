import { useState } from 'react';

import { Badge, Button, Card, Tabs, type TabItem } from '../components/ui';

interface FeaturePlaceholderScreenProps {
  bullets: string[];
  cta?: {
    label: string;
    onClick: () => void;
  };
  description: string;
  status: string;
  tabs?: TabItem[];
  title: string;
}

export function FeaturePlaceholderScreen({
  bullets,
  cta,
  description,
  status,
  tabs = [],
  title,
}: FeaturePlaceholderScreenProps): JSX.Element {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? 'overview');

  return (
    <section className="placeholder-screen">
      <Card className="placeholder-screen__hero">
        <div className="placeholder-screen__hero-copy">
          <Badge tone="warning">Fase 6</Badge>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <Badge tone="info">{status}</Badge>
      </Card>

      {tabs.length > 0 ? (
        <Card className="placeholder-screen__tabs">
          <Tabs activeId={activeTab} items={tabs} onChange={setActiveTab} />
          <p>Camada ativa: {activeTab}</p>
        </Card>
      ) : null}

      <div className="placeholder-screen__grid">
        {bullets.map((bullet) => (
          <Card className="placeholder-screen__bullet" key={bullet}>
            {bullet}
          </Card>
        ))}
      </div>

      {cta ? (
        <Card className="placeholder-screen__cta">
          <Button onClick={cta.onClick} variant="secondary">
            {cta.label}
          </Button>
        </Card>
      ) : null}
    </section>
  );
}
