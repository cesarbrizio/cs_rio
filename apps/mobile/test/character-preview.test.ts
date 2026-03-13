import { VocationType } from '@cs-rio/shared';
import { describe, expect, it } from 'vitest';

import { buildCharacterPreviewModel } from '../src/features/characterPreview';

describe('character preview model', () => {
  it('maps the selected appearance ids to distinct visual palettes', () => {
    const flamengoPreview = buildCharacterPreviewModel({
      hairId: 'tranca_media',
      outfitId: 'camisa_flamengo',
      skinId: 'pele_escura',
      vocation: VocationType.Soldado,
    });

    expect(flamengoPreview.skinColor).toBe('#8b5d3c');
    expect(flamengoPreview.hairShape).toBe('braids');
    expect(flamengoPreview.outfitVariant).toBe('stripes');
    expect(flamengoPreview.accentColor).toBe('#d44b4b');
  });

  it('falls back to the default mid-tone preview when ids are unknown', () => {
    const preview = buildCharacterPreviewModel({
      hairId: 'nao_existe',
      outfitId: 'nao_existe',
      skinId: 'nao_existe',
      vocation: VocationType.Cria,
    });

    expect(preview.skinColor).toBe('#d7a070');
    expect(preview.hairShape).toBe('short');
    expect(preview.outfitVariant).toBe('basic');
    expect(preview.accentColor).toBe('#f07b34');
  });
});
