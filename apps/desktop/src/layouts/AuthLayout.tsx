import { Outlet } from 'react-router-dom';

import { Badge, Card } from '../components/ui';

const authHighlights = [
  'Crie seu personagem e seja um criminoso no Rio.',
  'Junte-se a facções, participe de crimes e conquiste territórios.',
  'Agrade a comunidade ou lide com as consequências.',
] as const;

export function AuthLayout(): JSX.Element {
  return (
    <main className="auth-layout">
      <section className="auth-layout__hero">
        <Badge tone="warning">Desktop 0.1.0</Badge>
        <h1>CS Rio</h1>
        <p>
          A cidade mais maravilhosa do mundo. A realidade mais surreal.
        </p>
        <div className="auth-layout__bullets">
          {authHighlights.map((item) => (
            <Card className="auth-layout__note" key={item} padding="sm">
              {item}
            </Card>
          ))}
        </div>
      </section>

      <section className="auth-layout__panel">
        <Outlet />
      </section>
    </main>
  );
}
