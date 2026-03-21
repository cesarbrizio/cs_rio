import { type VocationType } from '@cs-rio/shared';
import { useMemo } from 'react';

import { buildCharacterPreviewModel } from './characterPreview';

interface CharacterPreviewProps {
  hairId: string;
  outfitId: string;
  skinId: string;
  vocation: VocationType;
  vocationLabel: string;
}

export function CharacterPreview({
  hairId,
  outfitId,
  skinId,
  vocation,
  vocationLabel,
}: CharacterPreviewProps): JSX.Element {
  const preview = useMemo(
    () => buildCharacterPreviewModel({ hairId, outfitId, skinId, vocation }),
    [hairId, outfitId, skinId, vocation],
  );

  return (
    <div aria-label={`Preview de ${vocationLabel}`} className="character-preview" role="img">
      <div className="character-preview__chip" style={{ backgroundColor: preview.accentColor }}>
        {vocationLabel}
      </div>
      <div className="character-preview__glow" style={{ backgroundColor: preview.accentSoftColor }} />
      <svg aria-hidden="true" className="character-preview__canvas" viewBox="0 0 176 168">
        <rect fill="rgba(10, 10, 10, 0.12)" height="18" rx="10" width="86" x="45" y="138" />
        <rect fill={preview.skinColor} height="46" rx="7" width="14" x="46" y="84" />
        <rect fill={preview.skinColor} height="46" rx="7" width="14" x="98" y="86" />
        <rect fill={preview.skinColor} height="34" rx="15" width="34" x="62" y="34" />
        <rect fill={preview.skinShadow} height="6" width="20" x="69" y="63" />
        <rect fill={preview.outfitPrimary} height="50" rx="10" width="42" x="58" y="74" />
        <rect fill={preview.outfitTrim} height="8" rx="5" width="18" x="70" y="78" />

        {preview.outfitVariant === 'stripes' ? (
          <>
            <rect fill={preview.outfitSecondary} height="8" width="42" x="58" y="88" />
            <rect fill={preview.outfitSecondary} height="8" width="42" x="58" y="102" />
          </>
        ) : null}

        {preview.outfitVariant === 'vest' ? (
          <>
            <rect fill={preview.outfitSecondary} height="44" rx="8" width="14" x="58" y="78" />
            <rect fill={preview.outfitSecondary} height="44" rx="8" width="14" x="86" y="78" />
            <rect fill={preview.outfitTrim} height="38" width="4" x="77" y="82" />
          </>
        ) : null}

        <rect fill={preview.pantsColor} height="50" rx="7" width="14" x="66" y="116" />
        <rect fill={preview.pantsColor} height="50" rx="7" width="14" x="80" y="120" />
        <rect fill="#f2efe6" height="6" width="16" x="65" y="160" />
        <rect fill="#f2efe6" height="6" width="16" x="79" y="164" />

        {preview.hairShape === 'short' ? (
          <rect fill={preview.hairColor} height="14" rx="8" width="30" x="64" y="32" />
        ) : null}

        {preview.hairShape === 'buzz' ? (
          <>
            <rect fill={preview.hairColor} height="8" rx="5" width="22" x="68" y="35" />
            <rect fill={preview.skinShadow} height="3" width="14" x="72" y="39" />
          </>
        ) : null}

        {preview.hairShape === 'braids' ? (
          <>
            <rect fill={preview.hairColor} height="14" rx="8" width="30" x="64" y="32" />
            <rect fill={preview.hairColor} height="22" rx="4" width="6" x="60" y="42" />
            <rect fill={preview.hairColor} height="22" rx="4" width="6" x="94" y="42" />
            <circle cx="63" cy="64" fill={preview.outfitTrim} r="2" />
            <circle cx="97" cy="64" fill={preview.outfitTrim} r="2" />
          </>
        ) : null}

        <circle cx="114" cy="46" fill={preview.accentSoftColor} r="12" />
        <circle cx="114" cy="46" fill={preview.accentColor} r="5" />
      </svg>
    </div>
  );
}
