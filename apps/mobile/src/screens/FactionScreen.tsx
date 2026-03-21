import { FactionScreenContent } from './FactionScreenContent';
import { useFactionScreenController } from './useFactionScreenController';

export function FactionScreen(): JSX.Element {
  const controller = useFactionScreenController();

  return <FactionScreenContent controller={controller} />;
}
