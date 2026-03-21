import { type PropertyType } from '@cs-rio/shared';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { type ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { CharacterCreationScreen } from '../screens/CharacterCreationScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

export type RootStackParamList = {
  Bicho: undefined;
  CharacterCreation: undefined;
  Contacts: undefined;
  Crimes: undefined;
  Events: undefined;
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
  Ranking: undefined;
  Register: undefined;
  Settings: undefined;
  Territory:
    | {
        focusFavelaId?: string;
      }
    | undefined;
  Tribunal:
    | {
        focusFavelaId?: string;
      }
    | undefined;
  University: undefined;
  Vocation: undefined;
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();

type DeferredScreenName = Exclude<
  keyof RootStackParamList,
  'CharacterCreation' | 'Home' | 'Login' | 'Register'
>;
type DeferredScreenModule = Record<string, ComponentType<object>>;
type DeferredScreenDefinition = {
  getComponent: () => ComponentType<object>;
  name: DeferredScreenName;
};

function loadDeferredScreen<TModule extends DeferredScreenModule, TExportName extends keyof TModule>(
  loader: () => TModule,
  exportName: TExportName,
): () => TModule[TExportName] {
  return () => loader()[exportName];
}

/* eslint-disable @typescript-eslint/no-require-imports */
const inGameDeferredScreens: readonly DeferredScreenDefinition[] = [
  {
    getComponent: loadDeferredScreen(() => require('../screens/BichoScreen'), 'BichoScreen'),
    name: 'Bicho',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/EventsScreen'), 'EventsScreen'),
    name: 'Events',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/HospitalScreen'), 'HospitalScreen'),
    name: 'Hospital',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/ContactsScreen'), 'ContactsScreen'),
    name: 'Contacts',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/CrimesScreen'), 'CrimesScreen'),
    name: 'Crimes',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/FactoriesScreen'), 'FactoriesScreen'),
    name: 'Factories',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/FactionScreen'), 'FactionScreen'),
    name: 'Faction',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/InventoryScreen'), 'InventoryScreen'),
    name: 'Inventory',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/DrugUseScreen'), 'DrugUseScreen'),
    name: 'DrugUse',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/ProfileScreen'), 'ProfileScreen'),
    name: 'Profile',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/RankingScreen'), 'RankingScreen'),
    name: 'Ranking',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/MapScreen'), 'MapScreen'),
    name: 'Map',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/MarketScreen'), 'MarketScreen'),
    name: 'Market',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/OperationsScreen'), 'OperationsScreen'),
    name: 'Operations',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/PrisonScreen'), 'PrisonScreen'),
    name: 'Prison',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/SettingsScreen'), 'SettingsScreen'),
    name: 'Settings',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/TribunalScreen'), 'TribunalScreen'),
    name: 'Tribunal',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/TerritoryScreen'), 'TerritoryScreen'),
    name: 'Territory',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/UniversityScreen'), 'UniversityScreen'),
    name: 'University',
  },
  {
    getComponent: loadDeferredScreen(() => require('../screens/VocationScreen'), 'VocationScreen'),
    name: 'Vocation',
  },
] as const;
/* eslint-enable @typescript-eslint/no-require-imports */

const inGameSheetOptions = {
  animation: 'fade_from_bottom' as const,
  contentStyle: {
    backgroundColor: 'transparent',
  },
  gestureEnabled: true,
  headerShown: false,
  presentation: 'transparentModal' as const,
};

const rootScreenOptions = {
  animation: 'slide_from_right' as const,
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
    fontWeight: '800' as const,
  },
};

export function RootNavigator(): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const player = useAuthStore((state) => state.player);

  return (
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
        <Stack.Navigator screenOptions={rootScreenOptions}>
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
              {inGameDeferredScreens.map((screen) => (
                <Stack.Screen
                  getComponent={screen.getComponent}
                  key={screen.name}
                  name={screen.name}
                  options={inGameSheetOptions}
                />
              ))}
            </>
          )}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: 14,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  bootCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 280,
    textAlign: 'center',
  },
  bootTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
});
