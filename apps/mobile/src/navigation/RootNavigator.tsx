import { type PropertyType } from '@cs-rio/shared';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { BichoScreen } from '../screens/BichoScreen';
import { CharacterCreationScreen } from '../screens/CharacterCreationScreen';
import { CombatScreen } from '../screens/CombatScreen';
import { ContactsScreen } from '../screens/ContactsScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { CrimesScreen } from '../screens/CrimesScreen';
import { DrugUseScreen } from '../screens/DrugUseScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { FactionScreen } from '../screens/FactionScreen';
import { FactoriesScreen } from '../screens/FactoriesScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HospitalScreen } from '../screens/HospitalScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MapScreen } from '../screens/MapScreen';
import { MarketScreen } from '../screens/MarketScreen';
import { OperationsScreen } from '../screens/OperationsScreen';
import { PrisonScreen } from '../screens/PrisonScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { SabotageScreen } from '../screens/SabotageScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TerritoryScreen } from '../screens/TerritoryScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { TribunalScreen } from '../screens/TribunalScreen';
import { UniversityScreen } from '../screens/UniversityScreen';
import { VocationScreen } from '../screens/VocationScreen';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';

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

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

const Stack = createNativeStackNavigator<RootStackParamList>();

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
              <Stack.Screen component={BichoScreen} name="Bicho" options={inGameSheetOptions} />
              <Stack.Screen component={EventsScreen} name="Events" options={inGameSheetOptions} />
              <Stack.Screen component={HospitalScreen} name="Hospital" options={inGameSheetOptions} />
              <Stack.Screen component={CombatScreen} name="Combat" options={inGameSheetOptions} />
              <Stack.Screen component={ContactsScreen} name="Contacts" options={inGameSheetOptions} />
              <Stack.Screen component={ContractsScreen} name="Contracts" options={inGameSheetOptions} />
              <Stack.Screen component={CrimesScreen} name="Crimes" options={inGameSheetOptions} />
              <Stack.Screen component={FactoriesScreen} name="Factories" options={inGameSheetOptions} />
              <Stack.Screen component={FactionScreen} name="Faction" options={inGameSheetOptions} />
              <Stack.Screen component={InventoryScreen} name="Inventory" options={inGameSheetOptions} />
              <Stack.Screen component={DrugUseScreen} name="DrugUse" options={inGameSheetOptions} />
              <Stack.Screen component={ProfileScreen} name="Profile" options={inGameSheetOptions} />
              <Stack.Screen component={MapScreen} name="Map" options={inGameSheetOptions} />
              <Stack.Screen component={MarketScreen} name="Market" options={inGameSheetOptions} />
              <Stack.Screen component={OperationsScreen} name="Operations" options={inGameSheetOptions} />
              <Stack.Screen component={PrisonScreen} name="Prison" options={inGameSheetOptions} />
              <Stack.Screen component={SabotageScreen} name="Sabotage" options={inGameSheetOptions} />
              <Stack.Screen component={SettingsScreen} name="Settings" options={inGameSheetOptions} />
              <Stack.Screen component={TrainingScreen} name="Training" options={inGameSheetOptions} />
              <Stack.Screen component={TribunalScreen} name="Tribunal" options={inGameSheetOptions} />
              <Stack.Screen component={TerritoryScreen} name="Territory" options={inGameSheetOptions} />
              <Stack.Screen component={UniversityScreen} name="University" options={inGameSheetOptions} />
              <Stack.Screen component={VocationScreen} name="Vocation" options={inGameSheetOptions} />
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
