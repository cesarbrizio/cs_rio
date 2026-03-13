import { RegionId } from '@cs-rio/shared';

import crimeArrestSound from '../../assets/audio/crime-arrest.wav';
import crimeFailureSound from '../../assets/audio/crime-failure.wav';
import crimeSuccessSound from '../../assets/audio/crime-success.wav';

export type AudioSfxKey =
  | 'combat'
  | 'crimeArrest'
  | 'crimeFailure'
  | 'crimeSuccess'
  | 'death'
  | 'levelUp'
  | 'notification'
  | 'walk';

export type AudioMusicTrackKey =
  | 'baixada'
  | 'centro'
  | 'zona_norte'
  | 'zona_oeste'
  | 'zona_sudoeste'
  | 'zona_sul';

// Placeholder mapping for the pre-alpha. Final assets arrive after the first playable cut.
export const AUDIO_SFX_SOURCES: Record<AudioSfxKey, number> = {
  combat: crimeFailureSound,
  crimeArrest: crimeArrestSound,
  crimeFailure: crimeFailureSound,
  crimeSuccess: crimeSuccessSound,
  death: crimeArrestSound,
  levelUp: crimeSuccessSound,
  notification: crimeSuccessSound,
  walk: crimeFailureSound,
};

export const REGION_MUSIC_TRACKS: Record<RegionId, AudioMusicTrackKey> = {
  [RegionId.Baixada]: 'baixada',
  [RegionId.Centro]: 'centro',
  [RegionId.ZonaNorte]: 'zona_norte',
  [RegionId.ZonaOeste]: 'zona_oeste',
  [RegionId.ZonaSudoeste]: 'zona_sudoeste',
  [RegionId.ZonaSul]: 'zona_sul',
};

// Region ambience is intentionally placeholder in the pre-alpha.
export const AUDIO_MUSIC_SOURCES: Record<AudioMusicTrackKey, number> = {
  baixada: crimeFailureSound,
  centro: crimeSuccessSound,
  zona_norte: crimeFailureSound,
  zona_oeste: crimeArrestSound,
  zona_sudoeste: crimeSuccessSound,
  zona_sul: crimeArrestSound,
};
