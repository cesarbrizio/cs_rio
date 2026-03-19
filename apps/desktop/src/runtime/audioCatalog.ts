import { RegionId } from '@cs-rio/shared';

import crimeArrestSound from '../../../mobile/assets/audio/crime-arrest.wav';
import crimeFailureSound from '../../../mobile/assets/audio/crime-failure.wav';
import crimeSuccessSound from '../../../mobile/assets/audio/crime-success.wav';

export type DesktopAudioSfxKey =
  | 'combat'
  | 'crimeArrest'
  | 'crimeFailure'
  | 'crimeSuccess'
  | 'death'
  | 'levelUp'
  | 'notification'
  | 'walk';

export type DesktopAudioMusicTrackKey =
  | 'baixada'
  | 'centro'
  | 'zona_norte'
  | 'zona_oeste'
  | 'zona_sudoeste'
  | 'zona_sul';

export const DESKTOP_AUDIO_SFX_SOURCES: Record<DesktopAudioSfxKey, string> = {
  combat: crimeFailureSound,
  crimeArrest: crimeArrestSound,
  crimeFailure: crimeFailureSound,
  crimeSuccess: crimeSuccessSound,
  death: crimeArrestSound,
  levelUp: crimeSuccessSound,
  notification: crimeSuccessSound,
  walk: crimeFailureSound,
};

export const DESKTOP_REGION_MUSIC_TRACKS: Record<RegionId, DesktopAudioMusicTrackKey> = {
  [RegionId.Baixada]: 'baixada',
  [RegionId.Centro]: 'centro',
  [RegionId.ZonaNorte]: 'zona_norte',
  [RegionId.ZonaOeste]: 'zona_oeste',
  [RegionId.ZonaSudoeste]: 'zona_sudoeste',
  [RegionId.ZonaSul]: 'zona_sul',
};

export const DESKTOP_AUDIO_MUSIC_SOURCES: Record<DesktopAudioMusicTrackKey, string> = {
  baixada: crimeFailureSound,
  centro: crimeSuccessSound,
  zona_norte: crimeFailureSound,
  zona_oeste: crimeArrestSound,
  zona_sudoeste: crimeSuccessSound,
  zona_sul: crimeArrestSound,
};
