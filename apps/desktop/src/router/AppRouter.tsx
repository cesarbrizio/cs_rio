import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthLayout } from '../layouts/AuthLayout';
import { FullscreenLayout } from '../layouts/FullscreenLayout';
import { GameLayout } from '../layouts/GameLayout';
import { DesktopShellProvider } from '../providers/DesktopShellProvider';
import { CharacterCreationScreen } from '../screens/CharacterCreationScreen';
import { CombatScreen } from '../screens/CombatScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { CrimesScreen } from '../screens/CrimesScreen';
import { BichoScreen } from '../screens/BichoScreen';
import { HospitalScreen } from '../screens/HospitalScreen';
import { InventoryScreen } from '../screens/InventoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MapScreen } from '../screens/MapScreen';
import { MarketScreen } from '../screens/MarketScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { OperationsScreen } from '../screens/OperationsScreen';
import { PrisonScreen } from '../screens/PrisonScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RankingScreen } from '../screens/RankingScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { FactionScreen } from '../screens/FactionScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TerritoryScreen } from '../screens/TerritoryScreen';
import { TrainingScreen } from '../screens/TrainingScreen';
import { TribunalScreen } from '../screens/TribunalScreen';
import { UniversityScreen } from '../screens/UniversityScreen';
import { WarScreen } from '../screens/WarScreen';

import { AuthGuard, RootRedirect } from './AuthGuard';

export function AppRouter(): JSX.Element {
  return (
    <HashRouter>
      <DesktopShellProvider>
        <Routes>
          <Route element={<RootRedirect />} path="/" />

          <Route
            element={
              <AuthGuard mode="guest">
                <AuthLayout />
              </AuthGuard>
            }
          >
            <Route element={<LoginScreen />} path="/login" />
            <Route element={<RegisterScreen />} path="/register" />
          </Route>

          <Route
            element={
              <AuthGuard mode="characterless">
                <FullscreenLayout />
              </AuthGuard>
            }
          >
            <Route element={<CharacterCreationScreen />} path="/create-char" />
          </Route>

          <Route
            element={
              <AuthGuard mode="protected">
                <GameLayout />
              </AuthGuard>
            }
          >
            <Route element={<HomeScreen />} path="/home" />
            <Route element={<CrimesScreen />} path="/crimes" />
            <Route element={<CombatScreen />} path="/combat" />
            <Route element={<ContractsScreen />} path="/contracts" />
            <Route element={<MarketScreen />} path="/market" />
            <Route element={<InventoryScreen />} path="/inventory" />
            <Route element={<OperationsScreen />} path="/operations" />
            <Route element={<FactionScreen />} path="/faction" />
            <Route element={<TerritoryScreen />} path="/territory" />
            <Route element={<WarScreen />} path="/war" />
            <Route element={<TribunalScreen />} path="/tribunal" />
            <Route element={<TrainingScreen />} path="/training" />
            <Route element={<UniversityScreen />} path="/university" />
            <Route element={<HospitalScreen />} path="/hospital" />
            <Route element={<PrisonScreen />} path="/prison" />
            <Route element={<BichoScreen />} path="/bicho" />
            <Route element={<MessagesScreen />} path="/messages" />
            <Route element={<RankingScreen />} path="/ranking" />
            <Route element={<MapScreen />} path="/map" />
            <Route element={<ProfileScreen />} path="/profile" />
            <Route element={<NotificationsScreen />} path="/notifications" />
            <Route element={<SettingsScreen />} path="/settings" />
          </Route>

          <Route
            element={
              <AuthGuard mode="protected">
                <FullscreenLayout />
              </AuthGuard>
            }
          >
            <Route element={<HomeScreen mode="fullscreen" />} path="/map/fullscreen" />
          </Route>

          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
      </DesktopShellProvider>
    </HashRouter>
  );
}
