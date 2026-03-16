import { memo, type ComponentProps } from 'react';

import { HomeHudOverlay } from './HomeHudOverlay';

export type HomeHudPanelProps = ComponentProps<typeof HomeHudOverlay>;

function HomeHudPanelComponent(props: HomeHudPanelProps): JSX.Element {
  return <HomeHudOverlay {...props} />;
}

export const HomeHudPanel = memo(HomeHudPanelComponent);
HomeHudPanel.displayName = 'HomeHudPanel';
