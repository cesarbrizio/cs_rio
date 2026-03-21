import { type PropsWithChildren } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { LoadingScreen } from '../screens/LoadingScreen';
import { useAuthStore } from '../stores/authStore';

type AccessMode = 'characterless' | 'guest' | 'protected';

interface AuthGuardProps extends PropsWithChildren {
  mode: AccessMode;
}

export function AuthGuard({ children, mode }: AuthGuardProps): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const player = useAuthStore((state) => state.player);
  const location = useLocation();

  if (!isHydrated) {
    return (
      <LoadingScreen
        copy="Abrindo sua sessao e puxando o perfil do personagem."
        title="Inicializando autenticacao"
      />
    );
  }

  if (isAuthenticated && !player) {
    return (
      <LoadingScreen
        copy="Sua sessao abriu. Falta carregar o perfil para decidir para onde voce cai."
        title="Carregando perfil"
      />
    );
  }

  if (mode === 'guest') {
    if (!isAuthenticated) {
      return <>{children ?? <Outlet />}</>;
    }

    return <Navigate replace to={resolveAuthenticatedPath(player?.hasCharacter ?? false)} />;
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ redirectTo: location.pathname }} to="/login" />;
  }

  if (mode === 'characterless') {
    if (player?.hasCharacter) {
      return <Navigate replace to="/home" />;
    }

    return <>{children ?? <Outlet />}</>;
  }

  if (!player?.hasCharacter) {
    return <Navigate replace to="/create-char" />;
  }

  return <>{children ?? <Outlet />}</>;
}

export function RootRedirect(): JSX.Element {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const player = useAuthStore((state) => state.player);

  if (!isHydrated || (isAuthenticated && !player)) {
    return (
      <LoadingScreen
        copy="Definindo se voce cai no login, na criacao do personagem ou direto no jogo."
        title="Preparando rotas"
      />
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }

  return <Navigate replace to={resolveAuthenticatedPath(player?.hasCharacter ?? false)} />;
}

function resolveAuthenticatedPath(hasCharacter: boolean): string {
  return hasCharacter ? '/home' : '/create-char';
}
