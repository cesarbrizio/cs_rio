import Constants from 'expo-constants';
import { NativeModules } from 'react-native';
import { resolveAppEnv } from './env-resolver';

function resolveScriptUrl(): string | null {
  const sourceCodeModule = NativeModules.SourceCode as
    | { getConstants?: () => { scriptURL?: string | null }; scriptURL?: string | null }
    | undefined;

  return (
    sourceCodeModule?.scriptURL ??
    sourceCodeModule?.getConstants?.().scriptURL ??
    null
  );
}

export const appEnv = resolveAppEnv({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  debuggerHost: Constants.expoGoConfig?.debuggerHost ?? null,
  expoHostUri: Constants.expoConfig?.hostUri ?? null,
  scriptUrl: resolveScriptUrl(),
  wsUrl: process.env.EXPO_PUBLIC_WS_URL,
});
