import { TerritoryScreenContent } from './TerritoryScreenContent';
import { useTerritoryScreenController } from './useTerritoryScreenController';

export function TerritoryScreen(): JSX.Element {
  const controller = useTerritoryScreenController();

  return <TerritoryScreenContent controller={controller} />;
}
