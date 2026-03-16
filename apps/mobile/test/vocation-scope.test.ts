import { describe, expect, it } from 'vitest';

import {
  buildVocationScopeLines,
  PROFILE_VISIBILITY_COPY,
  PROFILE_VISIBILITY_TITLE,
  resolveVocationCenterSubtitle,
  resolveUniversityScopeNotice,
  resolveUniversityScopeSubtitle,
  resolveUniversityTrackTitle,
} from '../src/features/vocationScope';

describe('vocation scope helpers', () => {
  it('downgrades vocation scope copy without selling unavailable progression', () => {
    expect(buildVocationScopeLines('Soldado')).toEqual([
      'Soldado segue como a sua vocação ativa nesta rodada.',
      'A Central de Vocação já permite trocar de build com custo em créditos premium e cooldown global de 24h.',
      'Use a Universidade do Crime para acompanhar a trilha exclusiva, os perks liberados e o próximo ganho da sua vocação.',
    ]);

    expect(buildVocationScopeLines(null)[0]).toBe(
      'Sua vocação ativa segue definida na criação do personagem.',
    );
  });

  it('keeps the university and public profile copy aligned with the frozen scope', () => {
    expect(PROFILE_VISIBILITY_TITLE).toBe('Visibilidade atual');
    expect(PROFILE_VISIBILITY_COPY).toContain('Perfil público dedicado entra no social MVP');
    expect(resolveUniversityScopeSubtitle()).toContain('perks exclusivos da sua vocação');
    expect(resolveUniversityTrackTitle()).toBe('Progressão da vocação');
    expect(resolveUniversityScopeNotice('Gerente')).toBe(
      'Gerente define a trilha exclusiva que libera perks permanentes. Se quiser trocar a build, use a Central de Vocação.',
    );
    expect(resolveVocationCenterSubtitle()).toContain('impacto real da trilha exclusiva');
  });
});
