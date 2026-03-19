import { Card } from '../components/ui';

interface LoadingScreenProps {
  copy: string;
  title: string;
}

export function LoadingScreen({ copy, title }: LoadingScreenProps): JSX.Element {
  return (
    <main className="loading-screen">
      <Card className="loading-screen__card">
        <div className="loading-screen__spinner" />
        <h1>{title}</h1>
        <p>{copy}</p>
      </Card>
    </main>
  );
}
