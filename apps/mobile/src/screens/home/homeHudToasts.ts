import { resolveEventDestinationLabel, resolveEventNotificationAccent, resolveEventNotificationTimeLabel, type EventNotificationItem } from '../../features/events';
import { colors } from '../../theme/colors';
import type { HomeHudToastConfig } from './HomeHudOverlay';
import type { PlayerProfile } from '@cs-rio/shared';

type TutorialStep = ReturnType<typeof import('../../features/tutorial').getCurrentTutorialStep>;

export function buildTopToast({
  dismissTutorial,
  eventBanner,
  handleDismissEventBanner,
  handleEventBannerPress,
  handleTutorialPrimaryAction,
  onOpenHospital,
  onOpenPrison,
  player,
  tutorialActive,
  tutorialProgress,
  tutorialRemainingMinutes,
  tutorialStep,
}: {
  dismissTutorial: () => void;
  eventBanner: EventNotificationItem | null;
  handleDismissEventBanner: () => void;
  handleEventBannerPress: () => void;
  handleTutorialPrimaryAction: () => void;
  onOpenHospital: () => void;
  onOpenPrison: () => void;
  player: PlayerProfile | null;
  tutorialActive: boolean;
  tutorialProgress: { current: number; total: number };
  tutorialRemainingMinutes: number;
  tutorialStep: TutorialStep;
}): HomeHudToastConfig | null {
  if (player?.prison.isImprisoned) {
    return {
      accent: colors.danger,
      autoDismissMs: 0,
      ctaLabel: 'Abrir prisao',
      message: `Preso · ${Math.max(1, Math.ceil(player.prison.remainingSeconds / 60))}min restantes`,
      onCta: onOpenPrison,
    };
  }

  if (player?.hospitalization.isHospitalized) {
    return {
      accent: colors.warning,
      autoDismissMs: 0,
      ctaLabel: 'Abrir hospital',
      message: `Internado · ${Math.max(1, Math.ceil(player.hospitalization.remainingSeconds / 60))}min restantes`,
      onCta: onOpenHospital,
    };
  }

  if (eventBanner) {
    return {
      accent: resolveEventNotificationAccent(eventBanner.severity),
      ctaLabel: resolveEventDestinationLabel(eventBanner.destination),
      message: `${eventBanner.title} · ${eventBanner.regionLabel} · ${resolveEventNotificationTimeLabel(eventBanner.remainingSeconds)}`,
      onCta: handleEventBannerPress,
      onDismiss: handleDismissEventBanner,
    };
  }

  if (tutorialActive && tutorialStep) {
    return {
      accent: colors.accent,
      autoDismissMs: 15000,
      ctaLabel: tutorialStep.ctaLabel,
      message: `Tutorial ${tutorialProgress.current}/${tutorialProgress.total}: ${tutorialStep.title} · ${tutorialRemainingMinutes} min restantes`,
      onCta: handleTutorialPrimaryAction,
      onDismiss: dismissTutorial,
    };
  }

  return null;
}
