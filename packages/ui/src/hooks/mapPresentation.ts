import { colors } from '@cs-rio/domain';
import { RegionId } from '@cs-rio/shared';

export interface MacroRegionMeta {
  accent: string;
  note: string;
  x: number;
  y: number;
}

export const MACRO_REGION_META: Record<RegionId, MacroRegionMeta> = {
  [RegionId.Baixada]: {
    accent: '#8fb7ff',
    note: 'Entrada densa, pressão logística e rotas de expansão pela Baixada.',
    x: 54,
    y: 2,
  },
  [RegionId.Centro]: {
    accent: colors.accent,
    note: 'Coração político e comercial, melhor leitura para mercado, hospital e universidade.',
    x: 74,
    y: 38,
  },
  [RegionId.ZonaNorte]: {
    accent: '#4fd597',
    note: 'Alta densidade, grandes complexos e disputa faccional pesada.',
    x: 60,
    y: 20,
  },
  [RegionId.ZonaOeste]: {
    accent: '#ff9d6e',
    note: 'Expansão horizontal, áreas grandes e deslocamento mais caro.',
    x: 28,
    y: 29,
  },
  [RegionId.ZonaSudoeste]: {
    accent: '#f4d77c',
    note: 'Conexão entre litoral, renda alta e leitura turística/comercial.',
    x: 30,
    y: 59,
  },
  [RegionId.ZonaSul]: {
    accent: '#ff7db2',
    note: 'Renda alta, pressão policial sazonal e eventos premium.',
    x: 70,
    y: 58,
  },
};

export function getMacroRegionMeta(regionId: RegionId | string): MacroRegionMeta {
  return MACRO_REGION_META[regionId as RegionId] ?? MACRO_REGION_META[RegionId.Centro];
}

export function estimateMacroRegionTravel(
  fromRegionId: RegionId | string,
  toRegionId: RegionId | string,
): {
  cost: number;
  minutes: number;
} {
  if (fromRegionId === toRegionId) {
    return {
      cost: 0,
      minutes: 0,
    };
  }

  const from = getMacroRegionMeta(fromRegionId);
  const to = getMacroRegionMeta(toRegionId);
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  const distance = Math.hypot(dx, dy);

  return {
    cost: Math.max(90, Math.round(distance * 7.2)),
    minutes: Math.max(6, Math.round(distance * 0.34)),
  };
}
