import { LEVELS, LevelTitle } from '@cs-rio/shared';

export interface LevelProgression {
  currentTitle: LevelTitle;
  leveledUp: boolean;
  level: number;
  nextConceitoRequired: number | null;
  nextLevel: number | null;
  previousLevel: number;
}

export class LevelSystem {
  resolve(conceito: number, currentLevel = 1): LevelProgression {
    const normalizedConceito = Math.max(0, Math.round(conceito));
    const matchedLevel =
      [...LEVELS].reverse().find((entry) => normalizedConceito >= entry.conceitoRequired) ??
      LEVELS[0];
    const nextLevelEntry =
      LEVELS.find((entry) => entry.level === matchedLevel.level + 1) ?? null;

    return {
      currentTitle: matchedLevel?.title ?? LevelTitle.Pivete,
      leveledUp: (matchedLevel?.level ?? 1) > currentLevel,
      level: matchedLevel?.level ?? 1,
      nextConceitoRequired: nextLevelEntry?.conceitoRequired ?? null,
      nextLevel: nextLevelEntry?.level ?? null,
      previousLevel: currentLevel,
    };
  }
}
