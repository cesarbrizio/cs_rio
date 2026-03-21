import { colors } from '../../theme/colors';
import type { CriticalUiActionOptions, HomeNavigate } from './homeHudControllerTypes';

export function createHomeHudRuntimeActions({
  cameraMode,
  issueCameraCommand,
  navigateNow,
  runCriticalUiAction,
}: {
  cameraMode: 'follow' | 'free';
  issueCameraCommand: (type: 'follow' | 'free' | 'recenter') => void;
  navigateNow: HomeNavigate;
  runCriticalUiAction: (options: CriticalUiActionOptions) => void;
}) {
  return {
    openHospital: () => {
      runCriticalUiAction({
        accent: colors.warning,
        bootstrapMessage: 'Abrindo a central do hospital.',
        feedbackMessage: 'Hospital selecionado.',
        navigate: () => {
          navigateNow('Hospital');
        },
      });
    },
    openMap: () => {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo o mapa tatico.',
        feedbackMessage: 'Mapa tatico selecionado.',
        navigate: () => {
          navigateNow('Map');
        },
      });
    },
    openPrison: () => {
      runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Abrindo a central da prisao.',
        feedbackMessage: 'Prisao selecionada.',
        navigate: () => {
          navigateNow('Prison');
        },
      });
    },
    openProfile: () => {
      runCriticalUiAction({
        accent: colors.info,
        bootstrapMessage: 'Abrindo Ver perfil.',
        feedbackMessage: 'Ver perfil selecionado.',
        navigate: () => {
          navigateNow('Profile');
        },
      });
    },
    recenterPlayer: () => {
      runCriticalUiAction({
        accent: colors.info,
        feedbackMessage: 'Jogador recentralizado.',
        haptic: 'light',
        immediateSideEffect: () => {
          issueCameraCommand('recenter');
        },
      });
    },
    toggleCameraMode: () => {
      const nextMode = cameraMode === 'follow' ? 'free' : 'follow';
      runCriticalUiAction({
        accent: nextMode === 'follow' ? colors.success : colors.muted,
        feedbackMessage: nextMode === 'follow' ? 'Camera em seguir jogador.' : 'Camera livre ativada.',
        haptic: 'light',
        immediateSideEffect: () => {
          issueCameraCommand(nextMode);
        },
      });
    },
  };
}
