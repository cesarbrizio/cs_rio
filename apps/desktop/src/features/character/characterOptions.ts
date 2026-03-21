import { type RegionId, VocationType } from '@cs-rio/shared';

export const vocationOptions = [
  {
    id: VocationType.Cria,
    label: 'Cria',
    stats: '30 FOR / 10 INT / 20 RES / 10 CAR',
    summary: 'Rua, roubo e pressão física.',
  },
  {
    id: VocationType.Gerente,
    label: 'Gerente',
    stats: '10 FOR / 30 INT / 20 RES / 10 CAR',
    summary: 'Gestão de boca, fábrica e logística.',
  },
  {
    id: VocationType.Soldado,
    label: 'Soldado',
    stats: '25 FOR / 20 INT / 15 RES / 10 CAR',
    summary: 'Combate, defesa territorial e execução.',
  },
  {
    id: VocationType.Politico,
    label: 'Politico',
    stats: '10 FOR / 20 INT / 10 RES / 30 CAR',
    summary: 'Influência social, PM e negociação.',
  },
  {
    id: VocationType.Empreendedor,
    label: 'Empreendedor',
    stats: '10 FOR / 25 INT / 10 RES / 25 CAR',
    summary: 'Lavagem, investimento e negócio ilícito.',
  },
] as const;

export const skinOptions = [
  { id: 'pele_clara', label: 'Clara', swatch: '#f3c9a3' },
  { id: 'pele_media', label: 'Média', swatch: '#d7a070' },
  { id: 'pele_escura', label: 'Escura', swatch: '#8b5d3c' },
] as const;

export const hairOptions = [
  { id: 'corte_curto', label: 'Curto' },
  { id: 'tranca_media', label: 'Tranca' },
  { id: 'raspado', label: 'Raspado' },
] as const;

export const outfitOptions = [
  { id: 'camisa_branca', label: 'Básica' },
  { id: 'camisa_flamengo', label: 'Fla' },
  { id: 'colete_preto', label: 'Colete' },
] as const;

const regionLabels: Record<RegionId, string> = {
  baixada: 'Baixada',
  centro: 'Centro',
  zona_norte: 'Zona Norte',
  zona_oeste: 'Zona Oeste',
  zona_sudoeste: 'Zona Sudoeste',
  zona_sul: 'Zona Sul',
};

export function getRegionLabel(regionId: RegionId): string {
  return regionLabels[regionId];
}

export function getVocationLabel(vocation: VocationType): string {
  return vocationOptions.find((option) => option.id === vocation)?.label ?? vocation;
}
