import { VocationType, type FactionWarRoundOutcome } from '@cs-rio/shared';

import type { TerritoryParticipantRecord } from './types.js';

const TERRITORY_COORDINATION_BONUS_PER_EXTRA_MEMBER = 0.03;

export function buildStabilizationEndsAt(now: Date, stabilizationHours: number): Date {
  return new Date(now.getTime() + stabilizationHours * 60 * 60 * 1000);
}

export function calculateTerritoryPlayerPower(participant: TerritoryParticipantRecord): number {
  const weaponPower =
    participant.equipment.weapon && (participant.equipment.weapon.durability ?? 0) > 0
      ? resolveWeaponEffectivePower(
          participant.equipment.weapon.power,
          participant.equipment.weapon.proficiency,
        )
      : 0;
  const vestDefense =
    participant.equipment.vest && (participant.equipment.vest.durability ?? 0) > 0
      ? participant.equipment.vest.defense
      : 0;
  const attributePower =
    participant.attributes.forca * 8 +
    participant.attributes.inteligencia * 6 +
    participant.attributes.resistencia * 7 +
    participant.attributes.carisma * 5;
  const equipmentPower = weaponPower + vestDefense * 6;
  const factionBonus = participant.factionId ? 1.08 : 1;
  const vocationMultiplier = resolveVocationPowerMultiplier(participant.player.vocation);

  return Math.round(
    (attributePower + equipmentPower + participant.player.level * 10) *
      factionBonus *
      vocationMultiplier,
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function resolveCoordinationMultiplier(
  participantCount: number,
  coordinationBonusPerExtraMember: number = TERRITORY_COORDINATION_BONUS_PER_EXTRA_MEMBER,
): number {
  return roundMultiplier(
    1 + Math.max(0, participantCount - 1) * coordinationBonusPerExtraMember,
  );
}

export function resolveFactionWarPreparationPowerBonus(input: {
  budget: number;
  regionPresenceCount: number;
  soldierCommitment: number;
}): number {
  return Math.round(
    input.budget * 0.06 + input.soldierCommitment * 450 + input.regionPresenceCount * 220,
  );
}

export function resolveFactionWarRoundOutcome(
  attackerPower: number,
  defenderPower: number,
): FactionWarRoundOutcome {
  if (attackerPower > defenderPower) {
    return 'attacker';
  }

  if (defenderPower > attackerPower) {
    return 'defender';
  }

  return 'draw';
}

export function roundMultiplier(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveVocationPowerMultiplier(vocation: VocationType): number {
  switch (vocation) {
    case VocationType.Cria:
      return 1.02;
    case VocationType.Gerente:
      return 1;
    case VocationType.Soldado:
      return 1.08;
    case VocationType.Politico:
      return 0.96;
    case VocationType.Empreendedor:
      return 1.01;
    default:
      return 1;
  }
}

function resolveWeaponEffectivePower(basePower: number, proficiency: number): number {
  if (proficiency <= 0) {
    return basePower;
  }

  const steps = Math.floor(Math.min(100, proficiency) / 10);

  if (steps < 1) {
    return basePower;
  }

  return Math.round(basePower * (1 + steps * 0.02));
}
