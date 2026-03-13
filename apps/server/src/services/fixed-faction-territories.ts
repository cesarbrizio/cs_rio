import { eq, inArray } from 'drizzle-orm';

import type { DatabaseClient } from '../db/client.js';
import { factions, favelas } from '../db/schema.js';
import { resolveFavelaBanditTarget } from './favela-force.js';

const FIXED_FACTION_STARTER_TERRITORIES: Record<string, string[]> = {
  ada: ['vidigal', 'cantagalo'],
  cv: ['complexo_do_alemao', 'rocinha'],
  lj: ['chatuba_de_mesquita', 'jardim_gramacho'],
  milicia: ['rio_das_pedras', 'cesarao', 'antares'],
  pcc: ['santo_cristo'],
  tc: ['jacarezinho', 'turano'],
  tcp: ['mangueira', 'morro_da_providencia'],
};

export async function applyFixedFactionStarterTerritories(
  client: DatabaseClient,
  now: Date,
): Promise<void> {
  const fixedFactionRows = await client
    .select({
      id: factions.id,
      internalSatisfaction: factions.internalSatisfaction,
      templateCode: factions.templateCode,
    })
    .from(factions)
    .where(eq(factions.isFixed, true));

  if (fixedFactionRows.length === 0) {
    return;
  }

  const targetCodes = [...new Set(Object.values(FIXED_FACTION_STARTER_TERRITORIES).flat())];

  if (targetCodes.length === 0) {
    return;
  }

  const favelaRows = await client
    .select({
      baseBanditTarget: favelas.baseBanditTarget,
      code: favelas.code,
      defaultSatisfaction: favelas.defaultSatisfaction,
      difficulty: favelas.difficulty,
      id: favelas.id,
      population: favelas.population,
    })
    .from(favelas)
    .where(inArray(favelas.code, targetCodes));

  const favelaByCode = new Map(favelaRows.map((favela) => [favela.code, favela]));

  for (const factionRow of fixedFactionRows) {
    const templateCode = factionRow.templateCode ?? '';
    const starterCodes = FIXED_FACTION_STARTER_TERRITORIES[templateCode] ?? [];

    for (const favelaCode of starterCodes) {
      const favelaRow = favelaByCode.get(favelaCode);

      if (!favelaRow) {
        continue;
      }

      await client
        .update(favelas)
        .set({
          banditsActive: resolveFavelaBanditTarget({
            baseBanditTarget: favelaRow.baseBanditTarget,
            difficulty: favelaRow.difficulty,
            internalSatisfaction: factionRow.internalSatisfaction,
            population: favelaRow.population,
            state: 'controlled',
          }),
          banditsArrested: 0,
          banditsDeadRecent: 0,
          banditsSyncedAt: now,
          contestingFactionId: null,
          controllingFactionId: factionRow.id,
          lastX9RollAt: now,
          propinaDiscountRate: '0',
          propinaDueDate: null,
          propinaLastPaidAt: null,
          propinaNegotiatedAt: null,
          propinaNegotiatedByPlayerId: null,
          propinaValue: '0',
          satisfaction: favelaRow.defaultSatisfaction,
          satisfactionSyncedAt: now,
          stabilizationEndsAt: null,
          state: 'controlled',
          stateControlledUntil: null,
          warDeclaredAt: null,
        })
        .where(eq(favelas.id, favelaRow.id));
    }
  }
}
