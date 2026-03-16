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
import { EventResultModal } from './src/components/EventResultModal';
import { FactionPromotionModal } from './src/components/FactionPromotionModal';
import { SabotageResultModal } from './src/components/SabotageResultModal';
import { TerritoryLossModal } from './src/components/TerritoryLossModal';
import { TribunalResultModal } from './src/components/TribunalResultModal';
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
  buildPendingPrivateMessageCues,
} from './src/features/private-messages';
import {
  buildPendingSabotageCues,
  type SabotageCue,
} from './src/features/sabotage';
import {
  loadSeenActivityResultKeys,
  rememberSeenActivityResult,
} from './src/features/activity-result-storage';
import {
  loadSeenEventResultKeys,
  rememberSeenEventResult,
} from './src/features/event-result-storage';
import {
  buildPendingEventResultCues,
  type EventResultCue,
} from './src/features/event-results';
import { buildEventFeed } from './src/features/events';
import {
  loadSeenTribunalCueKeys,
  rememberSeenTribunalCue,
} from './src/features/tribunal-result-storage';
import {
  buildPendingTerritoryLossCues,
  type TerritoryLossCue,
} from './src/features/territory-loss';
import {
  loadSeenTerritoryLossKeys,
  rememberSeenTerritoryLoss,
} from './src/features/territory-loss-storage';
import {
  loadSeenPrivateMessageIds,
  rememberSeenPrivateMessage,
} from './src/features/private-message-storage';
import {
  loadSeenSabotageCueKeys,
  rememberSeenSabotageCue,
} from './src/features/sabotage-storage';
import {
  buildPendingTribunalCues,
  type TribunalCue,
} from './src/features/tribunal-results';
import { canPlayerLeadTribunal } from './src/features/tribunal';
import { loadSeenWarResultKeys, rememberSeenWarResult } from './src/features/war-result-storage';
import { buildPendingWarResultCues, type WarResultCue } from './src/features/war-results';
import { CharacterCreationScreen } from './src/screens/CharacterCreationScreen';
import { BichoScreen } from './src/screens/BichoScreen';
import { CombatScreen } from './src/screens/CombatScreen';
import { ContactsScreen } from './src/screens/ContactsScreen';
import { ContractsScreen } from './src/screens/ContractsScreen';
import { CrimesScreen } from './src/screens/CrimesScreen';
import { DrugUseScreen } from './src/screens/DrugUseScreen';
import { EventsScreen } from './src/screens/EventsScreen';
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
import { SabotageScreen } from './src/screens/SabotageScreen';
import { TerritoryScreen } from './src/screens/TerritoryScreen';
import { TrainingScreen } from './src/screens/TrainingScreen';
import { TribunalScreen } from './src/screens/TribunalScreen';
import { UniversityScreen } from './src/screens/UniversityScreen';
import { VocationScreen } from './src/screens/VocationScreen';
import { NotificationProvider, useNotifications } from './src/notifications/NotificationProvider';
import {
  eventApi,
  factionApi,
  privateMessageApi,
  propertyApi,
  pvpApi,
  territoryApi,
  trainingApi,
  tribunalApi,
  universityApi,
} from './src/services/api';
import { useAppStore } from './src/stores/appStore';
import { useAuthStore } from './src/stores/authStore';
import { colors } from './src/theme/colors';

export type RootStackParamList = {
  Bicho: undefined;
  CharacterCreation: undefined;
  Combat: undefined;
  Contacts: undefined;
  Contracts: undefined;
  Crimes: undefined;
  Events: undefined;
  Factories: undefined;
  Sabotage:
    | {
        focusPropertyId?: string;
      }
    | undefined;
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
  Vocation: undefined;
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
  const resetPrivateMessageFeed = useAppStore((state) => state.resetPrivateMessageFeed);
  const setEventFeed = useAppStore((state) => state.setEventFeed);
  const setEventResultFeed = useAppStore((state) => state.setEventResultFeed);
  const setPrivateMessageFeed = useAppStore((state) => state.setPrivateMessageFeed);
  const showEventToast = useAppStore((state) => state.showEventToast);
  const setBootstrapStatus = useAppStore((state) => state.setBootstrapStatus);
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
  const seenContractNotificationIdsRef = useRef<Set<string>>(new Set());
  const contractFeedPrimedRef = useRef(false);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventFeedPrimedRef = useRef(false);
  const privateMessageFeedPrimedRef = useRef(false);
  const seenActivityResultKeysRef = useRef<Set<string>>(new Set());
  const seenActivityResultPlayerIdRef = useRef<string | null>(null);
  const seenEventResultKeysRef = useRef<Set<string>>(new Set());
  const seenEventResultPlayerIdRef = useRef<string | null>(null);
  const seenPrivateMessageIdsRef = useRef<Set<string>>(new Set());
  const seenPrivateMessagePlayerIdRef = useRef<string | null>(null);
  const seenSabotageCueKeysRef = useRef<Set<string>>(new Set());
  const seenTerritoryLossKeysRef = useRef<Set<string>>(new Set());
  const seenTerritoryLossPlayerIdRef = useRef<string | null>(null);
  const seenTribunalCueKeysRef = useRef<Set<string>>(new Set());
  const seenTribunalCuePlayerIdRef = useRef<string | null>(null);
  const seenWarResultKeysRef = useRef<Set<string>>(new Set());
  const seenWarResultPlayerIdRef = useRef<string | null>(null);
  const [activeActivityCue, setActiveActivityCue] = useState<AsyncActivityCue | null>(null);
  const [activeEventResultCue, setActiveEventResultCue] = useState<EventResultCue | null>(null);
  const [activeFactionPromotionCue, setActiveFactionPromotionCue] = useState<FactionPromotionCue | null>(null);
  const [activeSabotageCue, setActiveSabotageCue] = useState<SabotageCue | null>(null);
  const [activeTerritoryLossCue, setActiveTerritoryLossCue] = useState<TerritoryLossCue | null>(null);
  const [activeTribunalCue, setActiveTribunalCue] = useState<TribunalCue | null>(null);
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

  const ensureSeenEventResultsLoaded = useCallback(async () => {
    if (!player?.id) {
      seenEventResultKeysRef.current = new Set();
      seenEventResultPlayerIdRef.current = null;
      return;
    }

    if (seenEventResultPlayerIdRef.current === player.id) {
      return;
    }

    seenEventResultKeysRef.current = await loadSeenEventResultKeys(player.id);
    seenEventResultPlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenTerritoryLossesLoaded = useCallback(async () => {
    if (!player?.id) {
      seenTerritoryLossKeysRef.current = new Set();
      seenTerritoryLossPlayerIdRef.current = null;
      return;
    }

    if (seenTerritoryLossPlayerIdRef.current === player.id) {
      return;
    }

    seenTerritoryLossKeysRef.current = await loadSeenTerritoryLossKeys(player.id);
    seenTerritoryLossPlayerIdRef.current = player.id;
  }, [player?.id]);

  const ensureSeenPrivateMessagesLoaded = useCallback(async () => {
    if (!player?.id) {
      seenPrivateMessageIdsRef.current = new Set();
      seenPrivateMessagePlayerIdRef.current = null;
      return;
    }

    if (seenPrivateMessagePlayerIdRef.current === player.id) {
      return;
    }

    seenPrivateMessageIdsRef.current = await loadSeenPrivateMessageIds(player.id);
    seenPrivateMessagePlayerIdRef.current = player.id;
    privateMessageFeedPrimedRef.current = false;
  }, [player?.id]);

  const refreshSeenSabotageCues = useCallback(async () => {
    if (!player?.id) {
      seenSabotageCueKeysRef.current = new Set();
      return;
    }

    seenSabotageCueKeysRef.current = await loadSeenSabotageCueKeys(player.id);
  }, [player?.id]);

  const ensureSeenTribunalCuesLoaded = useCallback(async () => {
    if (!player?.id) {
      seenTribunalCueKeysRef.current = new Set();
      seenTribunalCuePlayerIdRef.current = null;
      return;
    }

    if (seenTribunalCuePlayerIdRef.current === player.id) {
      return;
    }

    seenTribunalCueKeysRef.current = await loadSeenTribunalCueKeys(player.id);
    seenTribunalCuePlayerIdRef.current = player.id;
  }, [player?.id]);

  const pollEventResults = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await ensureSeenEventResultsLoaded();

    const results = await eventApi.getResults();
    setEventResultFeed(results);

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
      return;
    }

    const cues = buildPendingEventResultCues({
      results,
      seenKeys: seenEventResultKeysRef.current,
    });
    const nextCue = cues[0];

    if (!nextCue) {
      return;
    }

    seenEventResultKeysRef.current = await rememberSeenEventResult(player.id, nextCue.key);
    setActiveEventResultCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyEventResult(nextCue);
  }, [
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    ensureSeenEventResultsLoaded,
    isAuthenticated,
    notifyEventResult,
    player,
    setBootstrapStatus,
    setEventResultFeed,
  ]);

  const pollPrivateMessages = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await ensureSeenPrivateMessagesLoaded();

    const feed = await privateMessageApi.listThreads();
    setPrivateMessageFeed(feed);

    const pendingCues = buildPendingPrivateMessageCues({
      feed,
      seenMessageIds: seenPrivateMessageIdsRef.current,
    });

    if (!privateMessageFeedPrimedRef.current) {
      for (const cue of pendingCues) {
        seenPrivateMessageIdsRef.current = await rememberSeenPrivateMessage(player.id, cue.messageId);
      }
      privateMessageFeedPrimedRef.current = true;
      return;
    }

    const nextCue = pendingCues[0];

    if (!nextCue) {
      return;
    }

    seenPrivateMessageIdsRef.current = await rememberSeenPrivateMessage(player.id, nextCue.messageId);
    setBootstrapStatus(`${nextCue.contactNickname} te mandou uma mensagem privada.`);
    void notifyPrivateMessage(nextCue);
  }, [
    ensureSeenPrivateMessagesLoaded,
    isAuthenticated,
    notifyPrivateMessage,
    player?.hasCharacter,
    player?.id,
    setBootstrapStatus,
    setPrivateMessageFeed,
  ]);

  const pollSabotageCues = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player.id) {
      return;
    }

    await refreshSeenSabotageCues();

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
      return;
    }

    const center = await propertyApi.getSabotageCenter();
    const nextCue = buildPendingSabotageCues({
      center,
      playerId: player.id,
      seenKeys: seenSabotageCueKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenSabotageCueKeysRef.current = await rememberSeenSabotageCue(player.id, nextCue.key);
    setActiveSabotageCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifySabotageCue(nextCue);
    void refreshPlayerProfile();
  }, [
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    isAuthenticated,
    notifySabotageCue,
    player?.hasCharacter,
    player?.id,
    refreshPlayerProfile,
    refreshSeenSabotageCues,
    setBootstrapStatus,
  ]);

  const pollTribunalCues = useCallback(async () => {
    if (
      !isAuthenticated ||
      !player?.hasCharacter ||
      !player.id ||
      !canPlayerLeadTribunal(player.faction?.rank ?? null)
    ) {
      return;
    }

    await ensureSeenTribunalCuesLoaded();

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
      return;
    }

    const feed = await tribunalApi.getCues();
    const nextCue = buildPendingTribunalCues({
      feed,
      seenKeys: seenTribunalCueKeysRef.current,
    })[0];

    if (!nextCue) {
      return;
    }

    seenTribunalCueKeysRef.current = await rememberSeenTribunalCue(player.id, nextCue.key);
    setActiveTribunalCue(nextCue);
    setBootstrapStatus(nextCue.body);
    void notifyTribunalCue(nextCue);

    if (nextCue.kind === 'resolved') {
      void refreshPlayerProfile();
    }
  }, [
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    ensureSeenTribunalCuesLoaded,
    isAuthenticated,
    notifyTribunalCue,
    player,
    refreshPlayerProfile,
    setBootstrapStatus,
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

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
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
    activeEventResultCue,
    activeFactionPromotionCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    ensureSeenWarResultsLoaded,
    isAuthenticated,
    notifyWarResult,
    player,
    setBootstrapStatus,
  ]);

  const pollTerritoryLosses = useCallback(async () => {
    if (!isAuthenticated || !player?.hasCharacter || !player?.faction?.id || !player.id) {
      return;
    }

    await Promise.all([ensureSeenTerritoryLossesLoaded(), ensureSeenWarResultsLoaded()]);

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
      return;
    }

    const [feed, overview] = await Promise.all([territoryApi.getLosses(), territoryApi.list()]);
    const warCues = buildPendingWarResultCues({
      overview,
      player,
      seenKeys: seenWarResultKeysRef.current,
    });
    const nextResult = buildPendingTerritoryLossCues({
      feed,
      seenKeys: seenTerritoryLossKeysRef.current,
      warCues,
    })[0];

    if (!nextResult) {
      return;
    }

    seenTerritoryLossKeysRef.current = await rememberSeenTerritoryLoss(
      player.id,
      nextResult.cue.key,
    );

    if (nextResult.dedupedByWar) {
      return;
    }

    setActiveTerritoryLossCue(nextResult.cue);
    setBootstrapStatus(nextResult.cue.body);
    void notifyTerritoryLoss(nextResult.cue);
  }, [
    activeActivityCue,
    activeEventResultCue,
    activeFactionPromotionCue,
    activeTerritoryLossCue,
    activeTribunalCue,
    activeWarResultCue,
    ensureSeenTerritoryLossesLoaded,
    ensureSeenWarResultsLoaded,
    isAuthenticated,
    notifyTerritoryLoss,
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

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
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
    activeEventResultCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
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

    if (
      activeEventResultCue ||
      activeWarResultCue ||
      activeActivityCue ||
      activeFactionPromotionCue ||
      activeSabotageCue ||
      activeTerritoryLossCue ||
      activeTribunalCue
    ) {
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
    activeEventResultCue,
    activeFactionPromotionCue,
    activeSabotageCue,
    activeTerritoryLossCue,
    activeTribunalCue,
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
      privateMessageFeedPrimedRef.current = false;
      seenActivityResultKeysRef.current.clear();
      seenActivityResultPlayerIdRef.current = null;
      seenContractNotificationIdsRef.current.clear();
      seenEventIdsRef.current.clear();
      seenEventResultKeysRef.current.clear();
      seenEventResultPlayerIdRef.current = null;
      seenPrivateMessageIdsRef.current.clear();
      seenPrivateMessagePlayerIdRef.current = null;
      seenSabotageCueKeysRef.current.clear();
      seenTerritoryLossKeysRef.current.clear();
      seenTerritoryLossPlayerIdRef.current = null;
      seenTribunalCueKeysRef.current.clear();
      seenTribunalCuePlayerIdRef.current = null;
      seenWarResultKeysRef.current.clear();
      seenWarResultPlayerIdRef.current = null;
      setActiveActivityCue(null);
      setActiveEventResultCue(null);
      setActiveFactionPromotionCue(null);
      setActiveSabotageCue(null);
      setActiveTerritoryLossCue(null);
      setActiveTribunalCue(null);
      setActiveWarResultCue(null);
      resetEventFeed();
      resetPrivateMessageFeed();
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
          pollEventResults(),
          pollFactionPromotionResults(),
          pollPrivateMessages(),
          pollSabotageCues(),
          pollTerritoryLosses(),
          pollTribunalCues(),
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
    pollEventResults,
    pollFactionPromotionResults,
    pollPrivateMessages,
    pollSabotageCues,
    pollTerritoryLosses,
    pollTribunalCues,
    pollWarResults,
    resetEventFeed,
    resetPrivateMessageFeed,
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
                  component={EventsScreen}
                  name="Events"
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
                  component={ContactsScreen}
                  name="Contacts"
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
                  component={SabotageScreen}
                  name="Sabotage"
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
                  <Stack.Screen
                    component={VocationScreen}
                    name="Vocation"
                    options={inGameSheetOptions}
                  />
              </>
            )}
          </Stack.Navigator>
        )}
      </NavigationContainer>
      <EventToastOverlay notification={activeEventToast} onDismiss={dismissEventToast} />
      <EventResultModal
        cue={activeEventResultCue}
        onClose={() => {
          setActiveEventResultCue(null);
        }}
        onOpenTarget={(cue) => {
          setActiveEventResultCue(null);

          if (!navigationRef.isReady()) {
            return;
          }

          switch (cue.destination) {
            case 'territory':
              navigationRef.navigate('Territory');
              return;
            case 'market':
              navigationRef.navigate('Market');
              return;
            case 'prison':
              navigationRef.navigate('Prison');
              return;
            case 'map':
              navigationRef.navigate('Map');
              return;
          }
        }}
        visible={Boolean(activeEventResultCue)}
      />
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
      <SabotageResultModal
        cue={activeSabotageCue}
        onClose={() => {
          setActiveSabotageCue(null);
        }}
        onOpenTarget={(cue) => {
          setActiveSabotageCue(null);

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate('Sabotage', {
            focusPropertyId: cue.propertyId,
          });
        }}
        visible={Boolean(activeSabotageCue)}
      />
      <TribunalResultModal
        cue={activeTribunalCue}
        onClose={() => {
          setActiveTribunalCue(null);
        }}
        onOpenTarget={(cue) => {
          setActiveTribunalCue(null);

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate('Tribunal', {
            focusFavelaId: cue.case.favelaId,
          });
        }}
        visible={Boolean(activeTribunalCue)}
      />
      <TerritoryLossModal
        cue={activeTerritoryLossCue}
        onClose={() => {
          setActiveTerritoryLossCue(null);
        }}
        onOpenTarget={(cue) => {
          setActiveTerritoryLossCue(null);

          if (!navigationRef.isReady()) {
            return;
          }

          navigationRef.navigate('Territory', {
            focusFavelaId: cue.favelaId,
          });
        }}
        visible={Boolean(activeTerritoryLossCue)}
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
