import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/AppRouter';

export function App(): JSX.Element {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
