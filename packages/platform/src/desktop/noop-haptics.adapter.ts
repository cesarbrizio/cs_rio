import type { HapticsPort } from '../contracts/haptics.port';

function noop(): void {}

export const noopHaptics: HapticsPort = {
  error: noop,
  heavy: noop,
  light: noop,
  medium: noop,
  selection: noop,
  success: noop,
  warning: noop,
};
