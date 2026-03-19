import { expoHaptics } from '@cs-rio/platform/mobile/expo-haptics';

export function hapticLight(): void {
  expoHaptics.light();
}

export function hapticMedium(): void {
  expoHaptics.medium();
}

export function hapticHeavy(): void {
  expoHaptics.heavy();
}

export function hapticSuccess(): void {
  expoHaptics.success();
}

export function hapticWarning(): void {
  expoHaptics.warning();
}

export function hapticError(): void {
  expoHaptics.error();
}
