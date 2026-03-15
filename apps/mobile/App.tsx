import { type PropertyType } from '@cs-rio/shared';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AudioProvider, useAudio } from './src/audio/AudioProvider';
import { ActivityResultModal } from './src/components/ActivityResultModal';
import { FactionPromotionModal } from './src/components/FactionPromotionModal';
import { WarResultModal } from './src/components/WarResultModal';
import { EventToastOverlay } from './src/components/EventToastOverlay';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import {
  buildPendingActivityCues,
  type AsyncActivityCue,
} from './src/features/activity-results';
import {
  buildFactionPromotionCueFromSummary,
  type FactionPromotionCue,
} from './src/features/faction-promotion';
import {
  loadSeenActivityResultKeys,
  rememberSeenActivityResult,
} from './src/features/activity-result-storage';
import { buildEventFeed } from './src/features/events';
import { loadSeenWarResultKeys, rememberSeenWarResult } from './src/features/war-result-storage';
import { buildPendingWarResultCues, type WarResultCue } from './src/features/war-results';
import { CharacterCreationScreen } from './src/screens/CharacterCreationScreen';
import { BichoScreen } from './src/screens/BichoScreen';
import { CombatScreen } from './src/screens/CombatScreen';
import { ContractsScreen } from './src/screens/ContractsScreen';
import { CrimesScreen } from './src/screens/CrimesScreen';
import { DrugUseScreen } from './src/screens/DrugUseScreen';
import { FactionScreen } from './src/screens/FactionScreen';
import { FactoriesScreen } from './src/screens/FactoriesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { HospitalScreen } from './src/screens/HospitalScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { MapScreen } from './src/screens/MapScreen';
import { MarketScreen } from './src/screens/MarketScreen';
import { OperationsScreen } from './src/screens/OperationsScreen';
import { PrisonScreen } from './src/screens/PrisonScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { TerritoryScreen } from './src/screens/TerritoryScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { TribunalScreen } from './src/screens/TribunalScreen';
import { UniversityScreen } from './src/screens/UniversityScreen';
import { NotificationProvider, useNotifications } from './src/notifications/NotificationProvider';
import { eventApi, factionApi, pvpApi, territoryApi, trainingApi, universityApi } from './src/services/api';
import { useAppStore } from './src/stores/appStore';
import { useAuthStore } from './src/stores/authStore';
import { colors } from './src/theme/colors';

export type RootStackParamList = {
  Bicho: undefined;
  CharacterCreation: undefined;
  Combat: undefined;
  Contracts: undefined;
  Crimes: undefined;
  Factories: undefined;
  DrugUse:
    | {
        initialInventoryItemId?: string;
        initialVenue?: 'baile' | 'rave';
      }
    | undefined;
  Faction:
    | {
        initialTab?:
          | 'overview'
          | 'members'
          | 'bank'
          | 'upgrades'
          | 'war'
          | 'leadership';
      }
    | undefined;
  Home: undefined;
  Hospital: undefined;
  Inventory: undefined;
  Login: undefined;
  Map: undefined;
  Market: { initialTab?: 'auction' | 'buy' | 'repair' | 'sell' } | undefined;
  Operations:
    | {
        focusPropertyId?: string;
        focusPropertyType?: PropertyType;
        initialTab?: 'business' | 'patrimony';
      }
    | undefined;
  Prison: undefined;
  Profile: undefined;
  Register: undefined;
  Settings: undefined;
  Territory:
    | {
        focusFavelaId?: string;
      }
    | undefined;
  Training: undefined;
  Tribunal:
    | {
        focusFavelaId?: string;
      }
    | undefined;
  University: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const inGameSheetOptions = {
  animation: 'fade_from_bottom' as const,
  contentStyle: {
    backgroundColor: 'transparent',
  },
  gestureEnabled: true,
  headerShown: false,
  presentation: 'transparentModal' as const,
};

export default function App(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const loadStoredAuth = useAuthStore((state) => state.loadStoredAuth);
  const player = useAuthStore((state) => state.player);
  const refreshPlayerProfile = useAuthStore((state) => state.refreshPlayerProfile);
  const activeEventToast = useAppStore((state) => state.activeEventToast);
  const dismissEventToast = useAppStore((state) => state.dismissEventToast);
  const resetEventFeed = useAppStore((state) => state.resetEventFeed);
  const setEventFeed = useAppStore((state) => state.setEventFeed);
  const showEventToast = useAppStore((state) => state.showEventToast);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
  const { playSfx, syncRegionMusic } = useAudio();
  const {
    notifyAttack,
    notifyEvent,
    notifyFactionPromotion,
    notifyWarResult,
    syncTimerNotifications,
    syncTrainingNotifications,
    syncUniversityNotifications,
  } = useNotifications();
  const seenContractNotificationIdsRef = useRef<Set<string>>(new Set());
  const contractFeedPrimedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventFeedPrimedRef = useRef(false);
  const seenActivityResultKeysRef = useRef<Set<string>>(new Set());
  const seenActivityResultPlayerIdRef = useRef<string | null>(null);
  const seenWarResultKeysRef = useRef<Set<string>>(new Set());
  const seenWarResultPlayerIdRef = useRef<string | null>(null);
  const [activeActivityCue, setActiveActivityCue] = useState<AsyncActivityCue | null>(null);
  const [activeFactionPromotionCue, setActiveFactionPromotionCue] = useState<FactionPromotionCue | null>(null);
  const [activeWarResultCue, setActiveWarResultCue] = useState<WarResultCue | null>(null);

  useEffect(() => {
    void loadStoredAuth();
  }, [loadStoredAuth]);

  const pollEventFeed = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter) {
      return;
    }

    const [docks, police, seasonal] = await Promise.all([
      eventApi.getDocksStatus(),
      eventApi.getPoliceStatus(),
      eventApi.getSeasonalStatus(),
    ]);
    const feed = buildEventFeed({
      docks,
      police,
      seasonal,
    });

    setEventFeed(feed);

    if (!eventFeedPrimedRef.current) {
      for (const notification of feed.notifications) {
        seenEventIdsRef.current.add(notification.id);
      }
      eventFeedPrimedRef.current = true;
      return;
    }

    const newNotifications = feed.notifications.filter(
      (notification) => !seenEventIdsRef.current.has(notification.id),
    );

    if (newNotifications.length === 0) {
      return;
    }

    for (const notification of newNotifications) {
      seenEventIdsRef.current.add(notification.id);
    }

    showEventToast(newNotifications[0]);
    void playSfx('notification');
    void notifyEvent(newNotifications[0]);
  }, [
    isAuthenticated,
    notifyEvent,
    playSfx,
    player?.hasCharacter,
    setEventFeed,
    showEventToast,
  ]);

  const pollAttackNotifications = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter) {
      return;
    }

    const contractsBook = await pvpApi.listContracts();

    if (!contractFeedPrimedRef.current) {
      for (const notification of contractsBook.notifications) {
        seenContractNotificationIdsRef.current.add(notification.id);
      }
      contractFeedPrimedRef.current = true;
      return;
    }

    const freshNotifications = contractsBook.notifications.filter(
      (notification) => !seenContractNotificationIdsRef.current.has(notification.id),
    );

    if (freshNotifications.length === 0) {
      return;
    }

    for (const notification of freshNotifications) {
      seenContractNotificationIdsRef.current.add(notification.id);
    }

    void notifyAttack(freshNotifications[0]);
  }, [isAuthenticated, notifyAttack, player?.hasCharacter]);

  const ensureSeenWarResultsLoaded = useCallback(async () => {
    if (!player?.id) {
      seenWarResultKeysRef.current = new Set();
      seenWarResultPlayerIdRef.current = null;
      return;
    }

    if (seenWarResultPlayerIdRef.current === player.id) {
      return;
    }

    seenWarResultKeysRef.current = await loadSeenWarResultKeys(player.id);
    seenWarResultPlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenActivityResultsLoaded = useCallback(async () => {
    if (!player?.id) {
      seenActivityResultKeysRef.current = new Set();
      seenActivityResultPlayerIdRef.current = null;
      return;
    }

    if (seenActivityResultPlayerIdRef.current === player.id) {
      return;
    }

    seenActivityResultKeysRef.current = await loadSeenActivityResultKeys(player.id);
    seenActivityResultPlayerIdRef.current = player.id;
  }, [player?.id]);

  const pollWarResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await ensureSeenWarResultsLoaded();

    if (activeWarResultCue || activeActivityCue) {
      return;
    }

    const overview = await territoryApi.list();
    const cues = buildPendingWarResultCues({
      overview,
      player,
      seenKeys: seenWarResultKeysRef.current,
    });
    const nextCue = cues[0];

    if (!nextCue) {
      return;
    }

    seenWarResultKeysRef.current = await rememberSeenWarResult(player.id, nextCue.key);
    setActiveWarResultCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyWarResult(nextCue);
  }, [
    activeActivityCue,
    activeWarResultCue,
    ensureSeenWarResultsLoaded,
    isAuthenticated,
    notifyWarResult,
    player,
    setBootstrapStatus,
  ]);

  const pollAsyncActivityResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await ensureSeenActivityResultsLoaded();

    const [trainingCenter, universityCenter] = await Promise.all([
      trainingApi.getCenter(),
      universityApi.getCenter(),
    ]);

    await Promise.all([
      syncTrainingNotifications(trainingCenter.activeSession),
      syncUniversityNotifications(universityCenter.activeCourse),
    ]);

    if (activeWarResultCue || activeActivityCue) {
      return;
    }

    const cues = buildPendingActivityCues({
      seenKeys: seenActivityResultKeysRef.current,
      trainingCenter,
      universityCenter,
    });
    const nextCue = cues[0];

    if (!nextCue) {
      return;
    }

    seenActivityResultKeysRef.current = await rememberSeenActivityResult(player.id, nextCue.key);
    setActiveActivityCue(nextCue);
    setBootstrapStatus(nextCue.body);
  }, [
    activeActivityCue,
    activeWarResultCue,
    ensureSeenActivityResultsLoaded,
    isAuthenticated,
    player,
    setBootstrapStatus,
    syncTrainingNotifications,
    syncUniversityNotifications,
  ]);

  const pollFactionPromotionResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id) {
      return;
    }

    if (activeWarResultCue || activeActivityCue || activeFactionPromotionCue) {
      return;
    }

    const factionsBook = await factionApi.list();
    const currentFaction =
      factionsBook.factions.find((entry) => entry.id === factionsBook.playerFactionId) ?? null;
    const cue = buildFactionPromotionCueFromSummary(currentFaction);

    if (!cue) {
      return;
    }

    setActiveFactionPromotionCue(cue);
    setBootstrapStatus(cue.body);
    void notifyFactionPromotion(cue);
    void refreshPlayerProfile();
  }, [
    activeActivityCue,
    activeFactionPromotionCue,
    activeWarResultCue,
    isAuthenticated,
    notifyFactionPromotion,
    player?.faction?.id,
    player?.hasCharacter,
    refreshPlayerProfile,
    setBootstrapStatus,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      void syncRegionMusic(null);
      return;
    }

    void syncRegionMusic(player.regionId);
  }, [isAuthenticated, player?.hasCharacter, player?.regionId, syncRegionMusic]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      contractFeedPrimedRef.current = false;
      eventFeedPrimedRef.current = false;
      seenActivityResultKeysRef.current.clear();
      seenActivityResultPlayerIdRef.current = null;
      seenContractNotificationIdsRef.current.clear();
      seenEventIdsRef.current.clear();
      seenWarResultKeysRef.current.clear();
      seenWarResultPlayerIdRef.current = null;
      setActiveActivityCue(null);
      setActiveFactionPromotionCue(null);
      setActiveWarResultCue(null);
      resetEventFeed();
      void syncTimerNotifications(null);
      void syncTrainingNotifications(null);
      void syncUniversityNotifications(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        await Promise.all([
          pollAttackNotifications(),
          pollAsyncActivityResults(),
          pollEventFeed(),
          pollFactionPromotionResults(),
          pollWarResults(),
        ]);
      } catch {
        if (!cancelled) {
          // Silent fail in pre-alpha: the banner should not block auth or map boot.
        }
      }
    };

    void load();
    const intervalId = setInterval(() => {
      void load();
    }, 45_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [
    isAuthenticated,
    player?.hasCharacter,
    pollAttackNotifications,
    pollAsyncActivityResults,
    pollEventFeed,
    pollFactionPromotionResults,
    pollWarResults,
    resetEventFeed,
    syncTimerNotifications,
    syncTrainingNotifications,
    syncUniversityNotifications,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !player?.hasCharacter) {
      void syncTimerNotifications(null);
      return;
    }

    void syncTimerNotifications(player);
  }, [
    isAuthenticated,
    player,
    player?.hasCharacter,
    player?.hospitalization?.endsAt,
    player?.hospitalization?.isHospitalized,
    player?.prison?.endsAt,
    player?.prison?.isImprisoned,
    syncTimerNotifications,
  ]);

  return (
    <View style={styles.appShell}>
      <NavigationContainer ref={navigationRef}>
        <StatusBar style="light" />
        {!isHydrated ? (
          <View style={styles.bootScreen}>
            <ActivityIndicator color={colors.accent} size="large" />
            <Text style={styles.bootTitle}>Inicializando autenticação</Text>
            <Text style={styles.bootCopy}>
              Carregando tokens do dispositivo e verificando o perfil do jogador.
            </Text>
          </View>
        ) : (
          <Stack.Navigator
            screenOptions={{
              animation: 'slide_from_right',
              animationDuration: 150,
              contentStyle: {
                backgroundColor: colors.background,
              },
              fullScreenGestureEnabled: true,
              gestureEnabled: true,
              headerShown: false,
              headerStyle: {
                backgroundColor: colors.panel,
              },
              headerTintColor: colors.text,
              headerTitleStyle: {
                color: colors.text,
                fontWeight: '800',
              },
            }}
          >
            {!isAuthenticated ? (
              <>
                <Stack.Screen
                  component={LoginScreen}
                  name="Login"
                  options={{
                    animation: 'fade_from_bottom',
                  }}
                />
                <Stack.Screen
                  component={RegisterScreen}
                  name="Register"
                  options={{
                    animation: 'slide_from_right',
                  }}
                />
              </>
            ) : player && !player.hasCharacter ? (
              <Stack.Screen
                component={CharacterCreationScreen}
                name="CharacterCreation"
                options={{
                  animation: 'fade_from_bottom',
                }}
              />
            ) : (
              <>
                <Stack.Screen
                  component={HomeScreen}
                  name="Home"
                  options={{
                    animation: 'fade',
                  }}
                />
                  <Stack.Screen
                    component={BichoScreen}
                    name="Bicho"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={HospitalScreen}
                    name="Hospital"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={CombatScreen}
                    name="Combat"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={ContractsScreen}
                    name="Contracts"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={CrimesScreen}
                    name="Crimes"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={FactoriesScreen}
                    name="Factories"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={FactionScreen}
                    name="Faction"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={InventoryScreen}
                    name="Inventory"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={DrugUseScreen}
                    name="DrugUse"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={ProfileScreen}
                    name="Profile"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={MapScreen}
                    name="Map"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={MarketScreen}
                    name="Market"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={OperationsScreen}
                    name="Operations"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={PrisonScreen}
                    name="Prison"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={SettingsScreen}
                    name="Settings"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={TrainingScreen}
                    name="Training"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={TribunalScreen}
                    name="Tribunal"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={TerritoryScreen}
                    name="Territory"
                    options={inGameSheetOptions}
                  />
                  <Stack.Screen
                    component={UniversityScreen}
                    name="University"
                    options={inGameSheetOptions}
                  />
              </>
            )}
          </Stack.Navigator>
        )}
      </NavigationContainer>
      <EventToastOverlay notification={activeEventToast} onDismiss={dismissEventToast} />
      <ActivityResultModal
        cue={activeActivityCue}
        onClose={() => {
          setActiveActivityCue(null);
        }}
        onOpenTarget={(cue) => {
          setActiveActivityCue(null);

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate(cue.kind === 'training' ? 'Training' : 'University');
        }}
        visible={Boolean(activeActivityCue)}
      />
      <FactionPromotionModal
        cue={activeFactionPromotionCue}
        onClose={() => {
          setActiveFactionPromotionCue(null);
        }}
        visible={Boolean(activeFactionPromotionCue)}
      />
      <WarResultModal
        cue={activeWarResultCue}
        onClose={() => {
          setActiveWarResultCue(null);
        }}
        visible={Boolean(activeWarResultCue)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    backgroundColor: colors.background,
    flex: 1,
  },
  bootScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  bootTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  bootCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: 'center',
  },
});
