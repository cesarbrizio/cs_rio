import type { FavelaControlState } from '@cs-rio/shared';

export function resolveFavelaStateLabel(state: FavelaControlState): string {
  switch (state) {
    case 'neutral':
      return 'Neutra';
    case 'controlled':
      return 'Controlada';
    case 'at_war':
      return 'Em guerra';
    case 'state':
      return 'Estado';
  }
}
