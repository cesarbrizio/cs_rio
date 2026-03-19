export type AppPlatformEnv = 'development' | 'production' | 'staging';

export interface EnvPort {
  apiUrl: string;
  wsUrl: string;
  appEnv: AppPlatformEnv;
}
