export interface HapticsPort {
  light(): void;
  medium(): void;
  heavy(): void;
  selection(): void;
  success(): void;
  warning(): void;
  error(): void;
}
