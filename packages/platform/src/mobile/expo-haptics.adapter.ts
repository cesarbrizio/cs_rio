import * as Haptics from 'expo-haptics';

import type { HapticsPort } from '../contracts/haptics.port';

export const expoHaptics: HapticsPort = {
  error() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  heavy() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  light() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  selection() {
    void Haptics.selectionAsync();
  },
  success() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning() {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
};
