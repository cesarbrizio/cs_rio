import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AudioProvider, useAudio } from './src/audio/AudioProvider';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { RootModals } from './src/components/RootModals';
import { usePollManager } from './src/hooks/usePollManager';
import { RootNavigator } from './src/navigation/RootNavigator';
import { NotificationProvider, useNotifications } from './src/notifications/NotificationProvider';
import { useAuthStore } from './src/stores/authStore';
import { colors } from './src/theme/colors';

export type { RootStackParamList } from './src/navigation/RootNavigator';

export default function App(): JSX.Element {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <AudioProvider>
            <NotificationProvider>
              <AppContent />
            </NotificationProvider>
          </AudioProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppContent(): JSX.Element {
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const { playSfx, syncRegionMusic } = useAudio();
  const {
    notifyAttack,
    notifyEvent,
    notifyEventResult,
    notifyFactionPromotion,
    notifyPrivateMessage,
    notifySabotageCue,
    notifyTerritoryLoss,
    notifyTribunalCue,
    notifyWarResult,
    syncTimerNotifications,
    syncTrainingNotifications,
    syncUniversityNotifications,
  } = useNotifications();
  const pollManager = usePollManager({
    notifyAttack,
    notifyEvent,
    notifyEventResult,
    notifyFactionPromotion,
    notifyPrivateMessage,
    notifySabotageCue,
    notifyTerritoryLoss,
    notifyTribunalCue,
    notifyWarResult,
    playSfx,
    syncRegionMusic,
    syncTimerNotifications,
    syncTrainingNotifications,
    syncUniversityNotifications,
  });

  useEffect(() => {
    void loadStoredAuth();
  }, [loadStoredAuth]);

  return (
    <View style={styles.appShell}>
      <RootNavigator />
      <RootModals
        activeActivityCue={pollManager.activeActivityCue}
        activeEventResultCue={pollManager.activeEventResultCue}
        activeFactionPromotionCue={pollManager.activeFactionPromotionCue}
        activeSabotageCue={pollManager.activeSabotageCue}
        activeTerritoryLossCue={pollManager.activeTerritoryLossCue}
        activeTribunalCue={pollManager.activeTribunalCue}
        activeWarResultCue={pollManager.activeWarResultCue}
        onCloseActivityCue={pollManager.closeActivityCue}
        onCloseEventResultCue={pollManager.closeEventResultCue}
        onCloseFactionPromotionCue={pollManager.closeFactionPromotionCue}
        onCloseSabotageCue={pollManager.closeSabotageCue}
        onCloseTerritoryLossCue={pollManager.closeTerritoryLossCue}
        onCloseTribunalCue={pollManager.closeTribunalCue}
        onCloseWarResultCue={pollManager.closeWarResultCue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
});
