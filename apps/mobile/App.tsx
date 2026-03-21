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
    notifyEvent,
    notifyEventResult,
    notifyFactionPromotion,
    notifyPrivateMessage,
    notifyTerritoryAlert,
    notifyTerritoryLoss,
    notifyTribunalCue,
    notifyWarResult,
    syncTimerNotifications,
    syncUniversityNotifications,
  } = useNotifications();
  const pollManager = usePollManager({
    notifyEvent,
    notifyEventResult,
    notifyFactionPromotion,
    notifyPrivateMessage,
    notifyTerritoryAlert,
    notifyTerritoryLoss,
    notifyTribunalCue,
    notifyWarResult,
    playSfx,
    syncRegionMusic,
    syncTimerNotifications,
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
        activeTerritoryLossCue={pollManager.activeTerritoryLossCue}
        activeTribunalCue={pollManager.activeTribunalCue}
        activeWarResultCue={pollManager.activeWarResultCue}
        onCloseActivityCue={pollManager.closeActivityCue}
        onCloseEventResultCue={pollManager.closeEventResultCue}
        onCloseFactionPromotionCue={pollManager.closeFactionPromotionCue}
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
