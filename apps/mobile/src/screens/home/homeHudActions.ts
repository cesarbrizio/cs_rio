import { colors } from '../../theme/colors';
import type { HudContextAction, HudContextTarget } from '../../features/hudContextActions';
import { resolveEventNotificationAccent, type EventNotificationItem } from '../../features/events';
import type { CriticalUiActionOptions, HomeNavigate } from './homeHudControllerTypes';

type TutorialStep = ReturnType<typeof import('../../features/tutorial').getCurrentTutorialStep>;

interface SharedActionDeps {
  completeTutorialStep: (stepId: 'crimes' | 'market' | 'move' | 'territory') => void;
  logout: () => Promise<void>;
  navigateNow: HomeNavigate;
  playerIsImprisoned: boolean;
  runCriticalUiAction: (options: CriticalUiActionOptions) => void;
  setBootstrapStatus: (status: string) => void;
  setContextTarget: (target: HudContextTarget | null) => void;
  showInteractionFeedback: (message: string, accent?: string) => void;
}

export function executeActionBarPress(buttonId: string, deps: SharedActionDeps): void {
  if (buttonId === 'prison') {
    deps.runCriticalUiAction({
      accent: colors.danger,
      bootstrapMessage: 'Abrindo a central da prisao.',
      feedbackMessage: 'Prisao selecionada.',
      navigate: () => {
        deps.navigateNow('Prison');
      },
    });
    return;
  }

  if (buttonId === 'hospital') {
    deps.runCriticalUiAction({
      accent: colors.warning,
      bootstrapMessage: 'Abrindo a central do hospital.',
      feedbackMessage: 'Hospital selecionado.',
      navigate: () => {
        deps.navigateNow('Hospital');
      },
    });
    return;
  }

  if (deps.playerIsImprisoned && !['profile', 'settings', 'logout'].includes(buttonId)) {
    deps.runCriticalUiAction({
      accent: colors.danger,
      bootstrapMessage: 'Seu personagem esta preso. Veja o timer e as saidas disponiveis na tela da prisao.',
      feedbackMessage: 'Seu personagem esta preso. Redirecionando para a prisao.',
      navigate: () => {
        deps.navigateNow('Prison');
      },
    });
    return;
  }

  const openSimpleScreen = (
    accent: string,
    bootstrapMessage: string,
    feedbackMessage: string,
    navigate: () => void,
    deferredSideEffect?: () => void,
  ) => {
    deps.runCriticalUiAction({
      accent,
      bootstrapMessage,
      deferredSideEffect,
      feedbackMessage,
      navigate,
    });
  };

  switch (buttonId) {
    case 'crimes':
      openSimpleScreen(colors.accent, 'Abrindo Fazer corre.', 'Fazer corre selecionado.', () => {
        deps.navigateNow('Crimes');
      }, () => {
        deps.completeTutorialStep('crimes');
      });
      return;
    case 'inventory':
      openSimpleScreen(colors.info, 'Abrindo Equipar.', 'Equipar selecionado.', () => {
        deps.navigateNow('Inventory');
      });
      return;
    case 'market':
      openSimpleScreen(colors.accent, 'Abrindo Negociar.', 'Negociar selecionado.', () => {
        deps.navigateNow('Market');
      }, () => {
        deps.completeTutorialStep('market');
      });
      return;
    case 'bicho':
      openSimpleScreen(colors.warning, 'Abrindo a banca do Jogo do Bicho.', 'Jogo do Bicho selecionado.', () => {
        deps.navigateNow('Bicho');
      });
      return;
    case 'events':
      openSimpleScreen(colors.info, 'Abrindo Ver eventos.', 'Ver eventos selecionado.', () => {
        deps.navigateNow('Events');
      });
      return;
    case 'ops':
      openSimpleScreen(colors.info, 'Abrindo Gerir ativos.', 'Gerir ativos selecionado.', () => {
        deps.navigateNow('Operations');
      });
      return;
    case 'territory':
      openSimpleScreen(colors.warning, 'Abrindo Dominar area.', 'Dominar area selecionado.', () => {
        deps.navigateNow('Territory');
      }, () => {
        deps.completeTutorialStep('territory');
      });
      return;
    case 'tribunal':
      openSimpleScreen(colors.warning, 'Abrindo Julgar caso.', 'Julgar caso selecionado.', () => {
        deps.navigateNow('Tribunal');
      });
      return;
    case 'faction':
      openSimpleScreen(colors.accent, 'Abrindo Falar com a faccao.', 'Falar com a faccao selecionado.', () => {
        deps.navigateNow('Faction');
      });
      return;
    case 'contacts':
      openSimpleScreen(colors.info, 'Abrindo Contatos.', 'Contatos selecionados.', () => {
        deps.navigateNow('Contacts');
      });
      return;
    case 'university':
      openSimpleScreen(colors.info, 'Abrindo Estudar.', 'Estudar selecionado.', () => {
        deps.navigateNow('University');
      });
      return;
    case 'vocation':
      openSimpleScreen(colors.info, 'Abrindo Gerir vocacao.', 'Gerir vocacao selecionado.', () => {
        deps.navigateNow('Vocation');
      });
      return;
    case 'profile':
      openSimpleScreen(colors.info, 'Abrindo Ver perfil.', 'Ver perfil selecionado.', () => {
        deps.navigateNow('Profile');
      });
      return;
    case 'ranking':
      openSimpleScreen(colors.warning, 'Abrindo o ranking da rodada.', 'Ranking selecionado.', () => {
        deps.navigateNow('Ranking');
      });
      return;
    case 'settings':
      openSimpleScreen(colors.info, 'Abrindo Ajustar jogo.', 'Ajustar jogo selecionado.', () => {
        deps.navigateNow('Settings');
      });
      return;
    case 'logout':
      deps.runCriticalUiAction({
        accent: colors.danger,
        bootstrapMessage: 'Encerrando a sessao deste dispositivo.',
        feedbackMessage: 'Encerrando a sessao...',
        immediateSideEffect: () => {
          void deps.logout();
        },
      });
      return;
    default:
      deps.runCriticalUiAction({
        accent: colors.accent,
        bootstrapMessage: `Acao "${buttonId}" selecionada.`,
        feedbackMessage: `Acao "${buttonId}" selecionada.`,
      });
  }
}

export function executeContextActionPress(
  action: HudContextAction,
  target: HudContextTarget,
  deps: Pick<SharedActionDeps, 'completeTutorialStep' | 'navigateNow' | 'runCriticalUiAction' | 'setContextTarget'>,
): void {
  const closeContext = () => {
    deps.setContextTarget(null);
  };

  const openContextDestination = (accent: string, navigate: () => void, deferredSideEffect?: () => void) => {
    deps.runCriticalUiAction({
      accent,
      bootstrapMessage: `${target.title}: ${action.label}`,
      deferredSideEffect: () => {
        deferredSideEffect?.();
        closeContext();
      },
      feedbackMessage: `${target.title}: ${action.label}.`,
      navigate,
    });
  };

  if (target.entityId.includes('mercado') || target.entityId.includes('black_market')) {
    const initialTab = action.id === 'sell' || action.id === 'repair' ? action.id : 'buy';
    openContextDestination(colors.accent, () => {
      deps.navigateNow('Market', { initialTab });
    }, () => {
      deps.completeTutorialStep('market');
    });
    return;
  }

  if (target.entityId.includes('hospital')) {
    openContextDestination(colors.warning, () => {
      deps.navigateNow('Hospital');
    });
    return;
  }

  if (target.entityId.includes('universidade')) {
    openContextDestination(colors.info, () => {
      deps.navigateNow('University');
    });
    return;
  }

  if (target.entityId.includes('rave') || target.entityId.includes('baile')) {
    if (action.id === 'vibe') {
      openContextDestination(colors.warning, () => {
        deps.navigateNow('Operations', {
          focusPropertyType: 'rave',
          initialTab: 'business',
        });
      });
      return;
    }

    openContextDestination(colors.warning, () => {
      deps.navigateNow('DrugUse', {
        initialVenue: target.entityId.includes('baile') ? 'baile' : 'rave',
      });
    });
    return;
  }

  if (
    target.entityId.includes('doca') ||
    target.entityId.includes('porto') ||
    target.entityId.includes('desmanche')
  ) {
    openContextDestination(
      target.entityId.includes('desmanche') ? colors.warning : colors.info,
      () => {
        deps.navigateNow('Market', { initialTab: 'sell' });
      },
    );
    return;
  }

  if (
    target.entityId.includes('boca') ||
    target.entityId.includes('fabrica') ||
    target.entityId.includes('factory') ||
    target.entityId.includes('laboratorio') ||
    target.entityId.includes('lab')
  ) {
    openContextDestination(colors.success, () => {
      deps.navigateNow('Operations', {
        focusPropertyType: target.entityId.includes('boca') ? 'boca' : 'factory',
        initialTab: 'business',
      });
    });
    return;
  }

  deps.runCriticalUiAction({
    accent: colors.info,
    bootstrapMessage: `${target.title}: ${action.label}`,
    deferredSideEffect: closeContext,
    feedbackMessage: `${target.title}: ${action.label}.`,
  });
}

export function executeEventBannerPress(
  eventBanner: EventNotificationItem,
  deps: Pick<SharedActionDeps, 'navigateNow' | 'runCriticalUiAction'>,
): void {
  switch (eventBanner.destination) {
    case 'territory':
      deps.runCriticalUiAction({
        accent: resolveEventNotificationAccent(eventBanner.severity),
        bootstrapMessage: `${eventBanner.title}: acompanhando o impacto no territorio.`,
        feedbackMessage: `${eventBanner.title}: abrindo territorio.`,
        navigate: () => {
          deps.navigateNow('Territory');
        },
      });
      return;
    case 'market':
      deps.runCriticalUiAction({
        accent: resolveEventNotificationAccent(eventBanner.severity),
        bootstrapMessage: `${eventBanner.title}: abrindo o mercado para reagir ao evento.`,
        feedbackMessage: `${eventBanner.title}: reagindo no mercado.`,
        navigate: () => {
          deps.navigateNow('Market', { initialTab: 'sell' });
        },
      });
      return;
    case 'map':
      deps.runCriticalUiAction({
        accent: resolveEventNotificationAccent(eventBanner.severity),
        bootstrapMessage: `${eventBanner.title}: abrindo o mapa tatico.`,
        feedbackMessage: `${eventBanner.title}: abrindo mapa.`,
        navigate: () => {
          deps.navigateNow('Map');
        },
      });
  }
}

export function executeTutorialPrimaryAction(
  tutorialStep: TutorialStep,
  deps: Pick<SharedActionDeps, 'setBootstrapStatus' | 'showInteractionFeedback'> & {
    handleActionBarPress: (buttonId: string) => void;
  },
): void {
  if (!tutorialStep) {
    return;
  }

  if (tutorialStep.id === 'move') {
    deps.setBootstrapStatus('Toque no chao do mapa para marcar um destino e completar o primeiro passo.');
    deps.showInteractionFeedback('Toque no mapa para marcar um destino.', colors.accent);
    return;
  }

  if (tutorialStep.actionId) {
    deps.handleActionBarPress(tutorialStep.actionId);
  }
}
