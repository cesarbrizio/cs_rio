import { VocationType } from '@cs-rio/shared';

export type PreviewHairShape = 'braids' | 'buzz' | 'short';
export type PreviewOutfitVariant = 'basic' | 'stripes' | 'vest';

export interface CharacterPreviewModel {
  accentColor: string;
  accentSoftColor: string;
  hairColor: string;
  hairShape: PreviewHairShape;
  outfitPrimary: string;
  outfitSecondary: string;
  outfitTrim: string;
  outfitVariant: PreviewOutfitVariant;
  pantsColor: string;
  skinColor: string;
  skinShadow: string;
}

interface CharacterPreviewSelection {
  hairId: string;
  outfitId: string;
  skinId: string;
  vocation: VocationType;
}

const DEFAULT_SKIN_ID = 'pele_media';
const DEFAULT_HAIR_ID = 'corte_curto';
const DEFAULT_OUTFIT_ID = 'camisa_branca';

const SKIN_TONES = {
  pele_clara: {
    skinColor: '#f3c9a3',
    skinShadow: '#deaf86',
  },
  pele_media: {
    skinColor: '#d7a070',
    skinShadow: '#b37d4f',
  },
  pele_escura: {
    skinColor: '#8b5d3c',
    skinShadow: '#68442a',
  },
} as const;

const HAIR_STYLES = {
  corte_curto: {
    hairColor: '#161616',
    hairShape: 'short' as const,
  },
  tranca_media: {
    hairColor: '#0d0d0d',
    hairShape: 'braids' as const,
  },
  raspado: {
    hairColor: '#4d3f37',
    hairShape: 'buzz' as const,
  },
} as const;

const OUTFIT_STYLES = {
  camisa_branca: {
    outfitPrimary: '#ece7da',
    outfitSecondary: '#c9c0aa',
    outfitTrim: '#8c7d62',
    outfitVariant: 'basic' as const,
    pantsColor: '#3b5062',
  },
  camisa_flamengo: {
    outfitPrimary: '#aa2121',
    outfitSecondary: '#141414',
    outfitTrim: '#f0ddc0',
    outfitVariant: 'stripes' as const,
    pantsColor: '#101419',
  },
  colete_preto: {
    outfitPrimary: '#2d3134',
    outfitSecondary: '#151515',
    outfitTrim: '#877049',
    outfitVariant: 'vest' as const,
    pantsColor: '#2f363f',
  },
} as const;

const VOCATION_ACCENTS = {
  [VocationType.Cria]: '#f07b34',
  [VocationType.Gerente]: '#56c2a8',
  [VocationType.Soldado]: '#d44b4b',
  [VocationType.Politico]: '#d5b254',
  [VocationType.Empreendedor]: '#5d95cb',
} as const;

export function buildCharacterPreviewModel(
  selection: CharacterPreviewSelection,
): CharacterPreviewModel {
  const skinTone = SKIN_TONES[normalizeSkinId(selection.skinId)];
  const hairStyle = HAIR_STYLES[normalizeHairId(selection.hairId)];
  const outfitStyle = OUTFIT_STYLES[normalizeOutfitId(selection.outfitId)];
  const accentColor = VOCATION_ACCENTS[selection.vocation] ?? VOCATION_ACCENTS[VocationType.Cria];

  return {
    accentColor,
    accentSoftColor: withAlpha(accentColor, '33'),
    hairColor: hairStyle.hairColor,
    hairShape: hairStyle.hairShape,
    outfitPrimary: outfitStyle.outfitPrimary,
    outfitSecondary: outfitStyle.outfitSecondary,
    outfitTrim: outfitStyle.outfitTrim,
    outfitVariant: outfitStyle.outfitVariant,
    pantsColor: outfitStyle.pantsColor,
    skinColor: skinTone.skinColor,
    skinShadow: skinTone.skinShadow,
  };
}

function normalizeHairId(hairId: string): keyof typeof HAIR_STYLES {
  return hairId in HAIR_STYLES ? (hairId as keyof typeof HAIR_STYLES) : DEFAULT_HAIR_ID;
}

function normalizeOutfitId(outfitId: string): keyof typeof OUTFIT_STYLES {
  return outfitId in OUTFIT_STYLES ? (outfitId as keyof typeof OUTFIT_STYLES) : DEFAULT_OUTFIT_ID;
}

function normalizeSkinId(skinId: string): keyof typeof SKIN_TONES {
  return skinId in SKIN_TONES ? (skinId as keyof typeof SKIN_TONES) : DEFAULT_SKIN_ID;
}

function withAlpha(hexColor: string, alphaHex: string): string {
  return `${hexColor}${alphaHex}`;
}
