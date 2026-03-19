import type { EnvPort } from '@cs-rio/platform';
import { type ApiErrorResponse } from '@cs-rio/shared';
import axios, {
  AxiosHeaders,
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { createApiModules, type ApiModules } from './endpoints';

export interface ApiMetricInput {
  durationMs: number;
  errorMessage?: string | null;
  method: string;
  path: string;
  statusCode?: number | null;
}

export interface ApiClientOptions {
  env: Pick<EnvPort, 'apiUrl'>;
  onApiMetric?: (input: ApiMetricInput) => void;
  timeoutMs?: number;
}

export interface AuthInterceptorOptions {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
}

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _observability?: {
    method: string;
    path: string;
    startedAt: number;
  };
  _retry?: boolean;
};

export interface ApiClient extends ApiModules {
  api: ReturnType<typeof axios.create>;
  formatApiError: (error: unknown) => Error;
  installApiObservabilityInterceptors: () => void;
  installAuthInterceptors: (options: AuthInterceptorOptions) => void;
}

let sharedApiClient: ApiClient | null = null;

export function createApiClient(options: ApiClientOptions): ApiClient {
  const api = axios.create({
    baseURL: normalizeApiBaseUrl(options.env.apiUrl),
    timeout: options.timeoutMs ?? 10_000,
  });

  let authInterceptorsInstalled = false;
  let diagnosticsInterceptorsInstalled = false;

  const formatApiError = (error: unknown): Error => {
    const maybeAxiosError = error as AxiosError<ApiErrorResponse>;
    const message = maybeAxiosError.response?.data?.message;

    if (typeof message === 'string' && message.length > 0) {
      return new Error(message);
    }

    if (
      maybeAxiosError.code === 'ERR_NETWORK' ||
      maybeAxiosError.message === 'Network Error' ||
      (maybeAxiosError.request && !maybeAxiosError.response)
    ) {
      return new Error(
        'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      );
    }

    if (maybeAxiosError.code === 'ECONNABORTED') {
      return new Error(
        'A API demorou demais para responder. Verifique a conexão e tente novamente.',
      );
    }

    if (maybeAxiosError.response?.status === 404) {
      return new Error('Não foi possível encontrar o endpoint solicitado.');
    }

    return error instanceof Error
      ? error
      : new Error('Falha inesperada na comunicação com a API.');
  };

  const installAuthInterceptors = ({
    getAccessToken,
    refreshAccessToken,
  }: AuthInterceptorOptions): void => {
    if (authInterceptorsInstalled) {
      return;
    }

    authInterceptorsInstalled = true;

    api.interceptors.request.use((config) => {
      const token = getAccessToken();

      if (!token) {
        return config;
      }

      const headers = AxiosHeaders.from(config.headers);
      headers.set('Authorization', `Bearer ${token}`);
      config.headers = headers;
      return config;
    });

    api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError<ApiErrorResponse>) => {
        const originalRequest = error.config as RetryableRequestConfig | undefined;

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry &&
          !isAuthPath(originalRequest.url)
        ) {
          originalRequest._retry = true;
          const nextToken = await refreshAccessToken();

          if (!nextToken) {
            throw error;
          }

          const headers = AxiosHeaders.from(originalRequest.headers);
          headers.set('Authorization', `Bearer ${nextToken}`);
          originalRequest.headers = headers;

          return api.request(originalRequest);
        }

        throw error;
      },
    );
  };

  const installApiObservabilityInterceptors = (): void => {
    if (diagnosticsInterceptorsInstalled) {
      return;
    }

    diagnosticsInterceptorsInstalled = true;

    api.interceptors.request.use((config) => {
      const observableConfig = config as RetryableRequestConfig;
      observableConfig._observability = {
        method: (config.method ?? 'GET').toUpperCase(),
        path: config.url ?? '/unknown',
        startedAt: Date.now(),
      };
      return config;
    });

    api.interceptors.response.use(
      (response) => {
        const observableConfig = response.config as RetryableRequestConfig;
        options.onApiMetric?.({
          durationMs: Date.now() - (observableConfig._observability?.startedAt ?? Date.now()),
          method:
            observableConfig._observability?.method ??
            (response.config.method ?? 'GET').toUpperCase(),
          path: observableConfig._observability?.path ?? response.config.url ?? '/unknown',
          statusCode: response.status,
        });
        return response;
      },
      (error: AxiosError<ApiErrorResponse>) => {
        const observableConfig = error.config as RetryableRequestConfig | undefined;
        const startedAt = observableConfig?._observability?.startedAt ?? Date.now();
        const statusCode = error.response?.status ?? null;

        if (
          !(
            statusCode === 401 &&
            observableConfig &&
            !observableConfig._retry &&
            !isAuthPath(observableConfig.url)
          )
        ) {
          options.onApiMetric?.({
            durationMs: Date.now() - startedAt,
            errorMessage: formatApiError(error).message,
            method:
              observableConfig?._observability?.method ??
              (observableConfig?.method ?? 'GET').toUpperCase(),
            path:
              observableConfig?._observability?.path ??
              observableConfig?.url ??
              '/unknown',
            statusCode,
          });
        }

        return Promise.reject(error);
      },
    );
  };

  const request = async <TResponse, TBody = unknown>(
    config: AxiosRequestConfig<TBody>,
  ): Promise<TResponse> => {
    const response = await api.request<TResponse, { data: TResponse }, TBody>(config);
    return response.data;
  };

  const requester = {
    del<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
      return request<TResponse>({
        ...config,
        method: 'DELETE',
        url,
      });
    },
    get<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
      return request<TResponse>({
        ...config,
        method: 'GET',
        url,
      });
    },
    patch<TResponse, TBody>(
      url: string,
      data: TBody,
      config?: AxiosRequestConfig<TBody>,
    ): Promise<TResponse> {
      return request<TResponse, TBody>({
        ...config,
        data,
        method: 'PATCH',
        url,
      });
    },
    post<TResponse, TBody>(
      url: string,
      data: TBody,
      config?: AxiosRequestConfig<TBody>,
    ): Promise<TResponse> {
      return request<TResponse, TBody>({
        ...config,
        data,
        method: 'POST',
        url,
      });
    },
    postEmpty<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
      return request<TResponse>({
        ...config,
        method: 'POST',
        url,
      });
    },
  };

  return {
    api,
    ...createApiModules(requester),
    formatApiError,
    installApiObservabilityInterceptors,
    installAuthInterceptors,
  };
}

export function configureSharedApiClient(options: ApiClientOptions): ApiClient {
  sharedApiClient = createApiClient(options);
  return sharedApiClient;
}

export function getSharedApiClient(): ApiClient {
  if (!sharedApiClient) {
    throw new Error(
      'Shared API client não configurado. Chame configureSharedApiClient() antes de usar os módulos.',
    );
  }

  return sharedApiClient;
}

function normalizeApiBaseUrl(url: string): string {
  const trimmedUrl = url.replace(/\/+$/u, '');
  return trimmedUrl.endsWith('/api') ? trimmedUrl : `${trimmedUrl}/api`;
}

function isAuthPath(url?: string): boolean {
  return Boolean(
    url?.includes('/auth/login') ||
      url?.includes('/auth/register') ||
      url?.includes('/auth/refresh'),
  );
}
