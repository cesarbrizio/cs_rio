import {
  type ApiErrorResponse,
  type AuthLoginInput,
  type AuthRefreshInput,
  type AuthRegisterInput,
  type BichoListResponse,
  type BichoPlaceBetInput,
  type BichoPlaceBetResponse,
  type BocaCollectResponse,
  type BocaListResponse,
  type CrimeAttemptResponse,
  type CrimeCatalogResponse,
  type DocksEventStatusResponse,
  type DrugFactoryCollectResponse,
  type DrugFactoryCreateInput,
  type DrugFactoryCreateResponse,
  type DrugFactoryListResponse,
  type DrugFactoryStockInput,
  type DrugFactoryStockResponse,
  type AuthSession,
  type DrugConsumeResponse,
  type HospitalActionResponse,
  type HospitalCenterResponse,
  type HospitalStatPurchaseInput,
  type HospitalSurgeryInput,
  type FactionBankDepositInput,
  type FactionBankResponse,
  type FactionBankWithdrawInput,
  type FactionCreateInput,
  type FactionCrimeAttemptInput,
  type FactionCrimeAttemptResponse,
  type FactionCrimeCatalogResponse,
  type FactionDissolveResponse,
  type FactionLeadershipCenterResponse,
  type FactionLeadershipChallengeResponse,
  type FactionLeadershipElectionSupportResponse,
  type FactionLeadershipVoteInput,
  type FactionLeadershipVoteResponse,
  type FactionLeaveResponse,
  type FactionListResponse,
  type FactionMembersResponse,
  type FactionMutationResponse,
  type FactionRecruitInput,
  type FactionUpdateInput,
  type FactionUpgradeCenterResponse,
  type FactionUpgradeType,
  type FactionUpgradeUnlockResponse,
  type FrontStoreCollectResponse,
  type FrontStoreListResponse,
  type MarketAuctionBidInput,
  type MarketAuctionBookResponse,
  type MarketAuctionCreateInput,
  type MarketAuctionMutationResponse,
  type InventoryItemType,
  type InventoryRepairResponse,
  type MarketOrderBookResponse,
  type MarketOrderCreateInput,
  type MarketOrderMutationResponse,
  type PlayerCreationInput,
  type PlayerProfile,
  type PlayerTravelInput,
  type PrisonActionResponse,
  type PrisonCenterResponse,
  type PropertyCatalogResponse,
  type PropertyHireSoldiersInput,
  type PropertyHireSoldiersResponse,
  type PropertyUpgradeResponse,
  type PuteiroCollectResponse,
  type PuteiroListResponse,
  type PoliceEventStatusResponse,
  type PvpAssassinationContractsResponse,
  type PvpAmbushResponse,
  type PvpAssaultResponse,
  type PvpContractAcceptResponse,
  type PvpContractCreateResponse,
  type PvpContractExecutionResponse,
  type RaveCollectResponse,
  type RaveListResponse,
  type RoundCenterResponse,
  type SlotMachineConfigureInput,
  type SlotMachineConfigureResponse,
  type SlotMachineCollectResponse,
  type SlotMachineInstallInput,
  type SlotMachineInstallResponse,
  type SlotMachineListResponse,
  type SeasonalEventStatusResponse,
  type TrainingCenterResponse,
  type TrainingClaimResponse,
  type TrainingStartInput,
  type TrainingStartResponse,
  type TerritoryOverviewResponse,
  type FavelaConquestInput,
  type FavelaConquestResponse,
  type FavelaServiceInstallInput,
  type FavelaServiceMutationResponse,
  type FavelaServiceType,
  type FavelaServicesResponse,
  type FavelaX9DesenroloResponse,
  type FavelaPropinaNegotiationResponse,
  type FavelaBaileOrganizeInput,
  type FavelaBaileOrganizeResponse,
  type FavelaBaileStatusResponse,
  type FactionWarDeclareResponse,
  type FactionWarPrepareInput,
  type FactionWarPrepareResponse,
  type FactionWarRoundResponse,
  type FactionWarStatusResponse,
  type TribunalCaseGenerateResponse,
  type TribunalCenterResponse,
  type TribunalJudgmentInput,
  type TribunalJudgmentResponse,
  type UniversityCenterResponse,
  type UniversityEnrollInput,
  type UniversityEnrollResponse,
} from '@cs-rio/shared';
import axios, {
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';

import { appEnv } from '../config/env';
import { recordApiMetric } from '../features/mobile-observability';

export const api = axios.create({
  baseURL: normalizeApiBaseUrl(appEnv.apiUrl),
  timeout: 10_000,
});

interface AuthInterceptorOptions {
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

let authInterceptorsInstalled = false;
let diagnosticsInterceptorsInstalled = false;

export const authApi = {
  login(input: AuthLoginInput): Promise<AuthSession> {
    return post<AuthSession, AuthLoginInput>('/auth/login', input);
  },
  refresh(input: AuthRefreshInput): Promise<AuthSession> {
    return post<AuthSession, AuthRefreshInput>('/auth/refresh', input);
  },
  register(input: AuthRegisterInput): Promise<AuthSession> {
    return post<AuthSession, AuthRegisterInput>('/auth/register', input);
  },
};

export const playerApi = {
  createCharacter(input: PlayerCreationInput): Promise<PlayerProfile> {
    return post<PlayerProfile, PlayerCreationInput>('/players/create', input);
  },
  getProfile(): Promise<PlayerProfile> {
    return get<PlayerProfile>('/players/me');
  },
  travel(input: PlayerTravelInput): Promise<PlayerProfile> {
    return post<PlayerProfile, PlayerTravelInput>('/players/travel', input);
  },
};

export const prisonApi = {
  bail(): Promise<PrisonActionResponse> {
    return postEmpty<PrisonActionResponse>('/prison/bail');
  },
  bribe(): Promise<PrisonActionResponse> {
    return postEmpty<PrisonActionResponse>('/prison/bribe');
  },
  escape(): Promise<PrisonActionResponse> {
    return postEmpty<PrisonActionResponse>('/prison/escape');
  },
  getCenter(): Promise<PrisonCenterResponse> {
    return get<PrisonCenterResponse>('/prison');
  },
  rescueFactionMember(targetPlayerId: string): Promise<PrisonActionResponse> {
    return postEmpty<PrisonActionResponse>(`/prison/faction-rescue/${targetPlayerId}`);
  },
};

export const roundApi = {
  getCenter(): Promise<RoundCenterResponse> {
    return get<RoundCenterResponse>('/round');
  },
};

export const eventApi = {
  getDocksStatus(): Promise<DocksEventStatusResponse> {
    return get<DocksEventStatusResponse>('/events/docks');
  },
  getPoliceStatus(): Promise<PoliceEventStatusResponse> {
    return get<PoliceEventStatusResponse>('/events/police');
  },
  getSeasonalStatus(): Promise<SeasonalEventStatusResponse> {
    return get<SeasonalEventStatusResponse>('/events/seasonal');
  },
};

export const hospitalApi = {
  applyDstTreatment(): Promise<HospitalActionResponse> {
    return postEmpty<HospitalActionResponse>('/hospital/dst-treatment');
  },
  applyTreatment(): Promise<HospitalActionResponse> {
    return postEmpty<HospitalActionResponse>('/hospital/treatment');
  },
  detox(): Promise<HospitalActionResponse> {
    return postEmpty<HospitalActionResponse>('/hospital/detox');
  },
  getCenter(): Promise<HospitalCenterResponse> {
    return get<HospitalCenterResponse>('/hospital');
  },
  purchaseHealthPlan(): Promise<HospitalActionResponse> {
    return postEmpty<HospitalActionResponse>('/hospital/health-plan');
  },
  purchaseStatItem(input: HospitalStatPurchaseInput): Promise<HospitalActionResponse> {
    return post<HospitalActionResponse, HospitalStatPurchaseInput>('/hospital/stat-items', input);
  },
  surgery(input: HospitalSurgeryInput): Promise<HospitalActionResponse> {
    return post<HospitalActionResponse, HospitalSurgeryInput>('/hospital/surgery', input);
  },
};

export const crimesApi = {
  attempt(crimeId: string): Promise<CrimeAttemptResponse> {
    return postEmpty<CrimeAttemptResponse>(`/crimes/${crimeId}/attempt`);
  },
  list(): Promise<CrimeCatalogResponse> {
    return get<CrimeCatalogResponse>('/crimes');
  },
};

export const factionCrimeApi = {
  attempt(
    factionId: string,
    crimeId: string,
    input: FactionCrimeAttemptInput,
  ): Promise<FactionCrimeAttemptResponse> {
    return post<FactionCrimeAttemptResponse, FactionCrimeAttemptInput>(
      `/crimes/faction/${factionId}/${crimeId}/attempt`,
      input,
    );
  },
  getCatalog(factionId: string): Promise<FactionCrimeCatalogResponse> {
    return get<FactionCrimeCatalogResponse>(`/crimes/faction/${factionId}`);
  },
};

export const factionApi = {
  challengeLeadership(factionId: string): Promise<FactionLeadershipChallengeResponse> {
    return postEmpty<FactionLeadershipChallengeResponse>(`/factions/${factionId}/leadership/challenge`);
  },
  create(input: FactionCreateInput): Promise<FactionMutationResponse> {
    return post<FactionMutationResponse, FactionCreateInput>('/factions', input);
  },
  demote(factionId: string, memberPlayerId: string): Promise<FactionMembersResponse> {
    return postEmpty<FactionMembersResponse>(`/factions/${factionId}/members/${memberPlayerId}/demote`);
  },
  deposit(factionId: string, input: FactionBankDepositInput): Promise<FactionBankResponse> {
    return post<FactionBankResponse, FactionBankDepositInput>(`/factions/${factionId}/bank/deposit`, input);
  },
  dissolve(factionId: string): Promise<FactionDissolveResponse> {
    return del<FactionDissolveResponse>(`/factions/${factionId}`);
  },
  expel(factionId: string, memberPlayerId: string): Promise<FactionMembersResponse> {
    return del<FactionMembersResponse>(`/factions/${factionId}/members/${memberPlayerId}`);
  },
  getBank(factionId: string): Promise<FactionBankResponse> {
    return get<FactionBankResponse>(`/factions/${factionId}/bank`);
  },
  join(factionId: string): Promise<FactionMutationResponse> {
    return postEmpty<FactionMutationResponse>(`/factions/${factionId}/join`);
  },
  getLeadership(factionId: string): Promise<FactionLeadershipCenterResponse> {
    return get<FactionLeadershipCenterResponse>(`/factions/${factionId}/leadership`);
  },
  getMembers(factionId: string): Promise<FactionMembersResponse> {
    return get<FactionMembersResponse>(`/factions/${factionId}/members`);
  },
  getUpgrades(factionId: string): Promise<FactionUpgradeCenterResponse> {
    return get<FactionUpgradeCenterResponse>(`/factions/${factionId}/upgrades`);
  },
  leave(factionId: string): Promise<FactionLeaveResponse> {
    return postEmpty<FactionLeaveResponse>(`/factions/${factionId}/leave`);
  },
  list(): Promise<FactionListResponse> {
    return get<FactionListResponse>('/factions');
  },
  promote(factionId: string, memberPlayerId: string): Promise<FactionMembersResponse> {
    return postEmpty<FactionMembersResponse>(`/factions/${factionId}/members/${memberPlayerId}/promote`);
  },
  recruit(factionId: string, input: FactionRecruitInput): Promise<FactionMembersResponse> {
    return post<FactionMembersResponse, FactionRecruitInput>(`/factions/${factionId}/members`, input);
  },
  supportLeadershipElection(
    factionId: string,
  ): Promise<FactionLeadershipElectionSupportResponse> {
    return postEmpty<FactionLeadershipElectionSupportResponse>(
      `/factions/${factionId}/leadership/election/support`,
    );
  },
  unlockUpgrade(
    factionId: string,
    upgradeType: FactionUpgradeType,
  ): Promise<FactionUpgradeUnlockResponse> {
    return postEmpty<FactionUpgradeUnlockResponse>(`/factions/${factionId}/upgrades/${upgradeType}/unlock`);
  },
  update(factionId: string, input: FactionUpdateInput): Promise<FactionMutationResponse> {
    return patch<FactionMutationResponse, FactionUpdateInput>(`/factions/${factionId}`, input);
  },
  voteLeadership(
    factionId: string,
    input: FactionLeadershipVoteInput,
  ): Promise<FactionLeadershipVoteResponse> {
    return post<FactionLeadershipVoteResponse, FactionLeadershipVoteInput>(
      `/factions/${factionId}/leadership/election/vote`,
      input,
    );
  },
  withdraw(factionId: string, input: FactionBankWithdrawInput): Promise<FactionBankResponse> {
    return post<FactionBankResponse, FactionBankWithdrawInput>(`/factions/${factionId}/bank/withdraw`, input);
  },
};

export const propertyApi = {
  hireSoldiers(
    propertyId: string,
    input: PropertyHireSoldiersInput,
  ): Promise<PropertyHireSoldiersResponse> {
    return post<PropertyHireSoldiersResponse, PropertyHireSoldiersInput>(
      `/properties/${propertyId}/soldiers`,
      input,
    );
  },
  list(): Promise<PropertyCatalogResponse> {
    return get<PropertyCatalogResponse>('/properties');
  },
  upgrade(propertyId: string): Promise<PropertyUpgradeResponse> {
    return postEmpty<PropertyUpgradeResponse>(`/properties/${propertyId}/upgrade`);
  },
};

export interface MarketOrderBookFilters {
  itemId?: string;
  itemType?: InventoryItemType;
}

export interface MarketAuctionBookFilters {
  itemId?: string;
  itemType?: 'vest' | 'weapon';
}

export const inventoryApi = {
  consume(inventoryItemId: string): Promise<DrugConsumeResponse> {
    return postEmpty<DrugConsumeResponse>(`/inventory/${inventoryItemId}/consume`);
  },
  repair(inventoryItemId: string): Promise<InventoryRepairResponse> {
    return postEmpty<InventoryRepairResponse>(`/inventory/${inventoryItemId}/repair`);
  },
};

export const factoryApi = {
  collect(factoryId: string): Promise<DrugFactoryCollectResponse> {
    return postEmpty<DrugFactoryCollectResponse>(`/factories/${factoryId}/collect`);
  },
  create(input: DrugFactoryCreateInput): Promise<DrugFactoryCreateResponse> {
    return post<DrugFactoryCreateResponse, DrugFactoryCreateInput>('/factories', input);
  },
  list(): Promise<DrugFactoryListResponse> {
    return get<DrugFactoryListResponse>('/factories');
  },
  stockComponent(factoryId: string, input: DrugFactoryStockInput): Promise<DrugFactoryStockResponse> {
    return post<DrugFactoryStockResponse, DrugFactoryStockInput>(
      `/factories/${factoryId}/components`,
      input,
    );
  },
};

export const bocaApi = {
  collect(propertyId: string): Promise<BocaCollectResponse> {
    return postEmpty<BocaCollectResponse>(`/bocas/${propertyId}/collect`);
  },
  list(): Promise<BocaListResponse> {
    return get<BocaListResponse>('/bocas');
  },
};

export const raveApi = {
  collect(propertyId: string): Promise<RaveCollectResponse> {
    return postEmpty<RaveCollectResponse>(`/raves/${propertyId}/collect`);
  },
  list(): Promise<RaveListResponse> {
    return get<RaveListResponse>('/raves');
  },
};

export const puteiroApi = {
  collect(propertyId: string): Promise<PuteiroCollectResponse> {
    return postEmpty<PuteiroCollectResponse>(`/puteiros/${propertyId}/collect`);
  },
  list(): Promise<PuteiroListResponse> {
    return get<PuteiroListResponse>('/puteiros');
  },
};

export const frontStoreApi = {
  collect(propertyId: string): Promise<FrontStoreCollectResponse> {
    return postEmpty<FrontStoreCollectResponse>(`/front-stores/${propertyId}/collect`);
  },
  list(): Promise<FrontStoreListResponse> {
    return get<FrontStoreListResponse>('/front-stores');
  },
};

export const bichoApi = {
  getState(): Promise<BichoListResponse> {
    return get<BichoListResponse>('/jogo-do-bicho');
  },
  placeBet(input: BichoPlaceBetInput): Promise<BichoPlaceBetResponse> {
    return post<BichoPlaceBetResponse, BichoPlaceBetInput>('/jogo-do-bicho/bets', input);
  },
};

export const slotMachineApi = {
  configure(
    propertyId: string,
    input: SlotMachineConfigureInput,
  ): Promise<SlotMachineConfigureResponse> {
    return post<SlotMachineConfigureResponse, SlotMachineConfigureInput>(
      `/slot-machines/${propertyId}/configure`,
      input,
    );
  },
  collect(propertyId: string): Promise<SlotMachineCollectResponse> {
    return postEmpty<SlotMachineCollectResponse>(`/slot-machines/${propertyId}/collect`);
  },
  install(
    propertyId: string,
    input: SlotMachineInstallInput,
  ): Promise<SlotMachineInstallResponse> {
    return post<SlotMachineInstallResponse, SlotMachineInstallInput>(
      `/slot-machines/${propertyId}/install`,
      input,
    );
  },
  list(): Promise<SlotMachineListResponse> {
    return get<SlotMachineListResponse>('/slot-machines');
  },
};

export const trainingApi = {
  claim(sessionId: string): Promise<TrainingClaimResponse> {
    return postEmpty<TrainingClaimResponse>(`/training-center/sessions/${sessionId}/claim`);
  },
  getCenter(): Promise<TrainingCenterResponse> {
    return get<TrainingCenterResponse>('/training-center');
  },
  start(input: TrainingStartInput): Promise<TrainingStartResponse> {
    return post<TrainingStartResponse, TrainingStartInput>('/training-center/sessions', input);
  },
};

export const universityApi = {
  enroll(input: UniversityEnrollInput): Promise<UniversityEnrollResponse> {
    return post<UniversityEnrollResponse, UniversityEnrollInput>('/university/enrollments', input);
  },
  getCenter(): Promise<UniversityCenterResponse> {
    return get<UniversityCenterResponse>('/university');
  },
};

export const tribunalApi = {
  generateCase(favelaId: string): Promise<TribunalCaseGenerateResponse> {
    return postEmpty<TribunalCaseGenerateResponse>(`/tribunal/favelas/${favelaId}/case`);
  },
  getCenter(favelaId: string): Promise<TribunalCenterResponse> {
    return get<TribunalCenterResponse>(`/tribunal/favelas/${favelaId}/case`);
  },
  judgeCase(
    favelaId: string,
    input: TribunalJudgmentInput,
  ): Promise<TribunalJudgmentResponse> {
    return post<TribunalJudgmentResponse, TribunalJudgmentInput>(
      `/tribunal/favelas/${favelaId}/case/judgment`,
      input,
    );
  },
};

export const pvpApi = {
  acceptContract(contractId: string): Promise<PvpContractAcceptResponse> {
    return postEmpty<PvpContractAcceptResponse>(`/pvp/contracts/${contractId}/accept`);
  },
  ambush(targetPlayerId: string, participantIds: string[]): Promise<PvpAmbushResponse> {
    return post<PvpAmbushResponse, { participantIds: string[] }>(
      `/pvp/ambush/${targetPlayerId}`,
      { participantIds },
    );
  },
  assault(targetPlayerId: string): Promise<PvpAssaultResponse> {
    return postEmpty<PvpAssaultResponse>(`/pvp/assault/${targetPlayerId}`);
  },
  createContract(
    targetPlayerId: string,
    reward: number,
  ): Promise<PvpContractCreateResponse> {
    return post<PvpContractCreateResponse, { reward: number; targetPlayerId: string }>(
      '/pvp/contracts',
      {
        reward,
        targetPlayerId,
      },
    );
  },
  executeContract(contractId: string): Promise<PvpContractExecutionResponse> {
    return postEmpty<PvpContractExecutionResponse>(`/pvp/contracts/${contractId}/execute`);
  },
  listContracts(): Promise<PvpAssassinationContractsResponse> {
    return get<PvpAssassinationContractsResponse>('/pvp/contracts');
  },
};

export const territoryApi = {
  attemptX9Desenrolo(favelaId: string): Promise<FavelaX9DesenroloResponse> {
    return postEmpty<FavelaX9DesenroloResponse>(`/territory/favelas/${favelaId}/x9/desenrolo`);
  },
  conquer(
    favelaId: string,
    input: FavelaConquestInput = {},
  ): Promise<FavelaConquestResponse> {
    return post<FavelaConquestResponse, FavelaConquestInput>(
      `/territory/favelas/${favelaId}/conquer`,
      input,
    );
  },
  declareWar(favelaId: string): Promise<FactionWarDeclareResponse> {
    return postEmpty<FactionWarDeclareResponse>(`/territory/favelas/${favelaId}/war/declare`);
  },
  getBaile(favelaId: string): Promise<FavelaBaileStatusResponse> {
    return get<FavelaBaileStatusResponse>(`/territory/favelas/${favelaId}/baile`);
  },
  getServices(favelaId: string): Promise<FavelaServicesResponse> {
    return get<FavelaServicesResponse>(`/territory/favelas/${favelaId}/services`);
  },
  getWar(favelaId: string): Promise<FactionWarStatusResponse> {
    return get<FactionWarStatusResponse>(`/territory/favelas/${favelaId}/war`);
  },
  list(): Promise<TerritoryOverviewResponse> {
    return get<TerritoryOverviewResponse>('/territory/favelas');
  },
  negotiatePropina(favelaId: string): Promise<FavelaPropinaNegotiationResponse> {
    return postEmpty<FavelaPropinaNegotiationResponse>(`/territory/favelas/${favelaId}/propina/negotiate`);
  },
  organizeBaile(
    favelaId: string,
    input: FavelaBaileOrganizeInput,
  ): Promise<FavelaBaileOrganizeResponse> {
    return post<FavelaBaileOrganizeResponse, FavelaBaileOrganizeInput>(
      `/territory/favelas/${favelaId}/baile`,
      input,
    );
  },
  prepareWar(
    favelaId: string,
    input: FactionWarPrepareInput,
  ): Promise<FactionWarPrepareResponse> {
    return post<FactionWarPrepareResponse, FactionWarPrepareInput>(
      `/territory/favelas/${favelaId}/war/prepare`,
      input,
    );
  },
  resolveWarRound(favelaId: string): Promise<FactionWarRoundResponse> {
    return postEmpty<FactionWarRoundResponse>(`/territory/favelas/${favelaId}/war/round`);
  },
  installService(
    favelaId: string,
    input: FavelaServiceInstallInput,
  ): Promise<FavelaServiceMutationResponse> {
    return post<FavelaServiceMutationResponse, FavelaServiceInstallInput>(
      `/territory/favelas/${favelaId}/services`,
      input,
    );
  },
  upgradeService(
    favelaId: string,
    serviceType: FavelaServiceType,
  ): Promise<FavelaServiceMutationResponse> {
    return postEmpty<FavelaServiceMutationResponse>(
      `/territory/favelas/${favelaId}/services/${serviceType}/upgrade`,
    );
  },
};

export const marketApi = {
  bidAuction(auctionId: string, input: MarketAuctionBidInput): Promise<MarketAuctionMutationResponse> {
    return post<MarketAuctionMutationResponse, MarketAuctionBidInput>(
      `/market/auctions/${auctionId}/bid`,
      input,
    );
  },
  cancel(orderId: string): Promise<MarketOrderMutationResponse> {
    return postEmpty<MarketOrderMutationResponse>(`/market/orders/${orderId}/cancel`);
  },
  createAuction(input: MarketAuctionCreateInput): Promise<MarketAuctionMutationResponse> {
    return post<MarketAuctionMutationResponse, MarketAuctionCreateInput>('/market/auctions', input);
  },
  createOrder(input: MarketOrderCreateInput): Promise<MarketOrderMutationResponse> {
    return post<MarketOrderMutationResponse, MarketOrderCreateInput>('/market/orders', input);
  },
  getAuctionBook(filters: MarketAuctionBookFilters = {}): Promise<MarketAuctionBookResponse> {
    return get<MarketAuctionBookResponse>('/market/auctions', {
      params: filters,
    });
  },
  getOrderBook(filters: MarketOrderBookFilters = {}): Promise<MarketOrderBookResponse> {
    return get<MarketOrderBookResponse>('/market/orders', {
      params: filters,
    });
  },
};

export function formatApiError(error: unknown): Error {
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
      `Não foi possível conectar ao backend em ${normalizeApiBaseUrl(appEnv.apiUrl)}. Verifique se o celular consegue abrir ${normalizeApiBaseUrl(appEnv.apiUrl)}/health.`,
    );
  }

  if (maybeAxiosError.code === 'ECONNABORTED') {
    return new Error('A API demorou demais para responder. Verifique a conexão e tente novamente.');
  }

  if (maybeAxiosError.response?.status === 404) {
    return new Error('Não foi possível encontrar o endpoint solicitado.');
  }

  return error instanceof Error ? error : new Error('Falha inesperada na comunicação com a API.');
}

export function installAuthInterceptors({
  getAccessToken,
  refreshAccessToken,
}: AuthInterceptorOptions): void {
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
}

export function installApiObservabilityInterceptors(): void {
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
      recordApiMetric({
        durationMs: Date.now() - (observableConfig._observability?.startedAt ?? Date.now()),
        method: observableConfig._observability?.method ?? (response.config.method ?? 'GET').toUpperCase(),
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
        recordApiMetric({
          durationMs: Date.now() - startedAt,
          errorMessage: formatApiError(error).message,
          method:
            observableConfig?._observability?.method ??
            (observableConfig?.method ?? 'GET').toUpperCase(),
          path: observableConfig?._observability?.path ?? observableConfig?.url ?? '/unknown',
          statusCode,
        });
      }

      return Promise.reject(error);
    },
  );
}

function normalizeApiBaseUrl(url: string): string {
  const trimmedUrl = url.replace(/\/+$/u, '');
  return trimmedUrl.endsWith('/api') ? trimmedUrl : `${trimmedUrl}/api`;
}

function get<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
  return request<TResponse>({
    ...config,
    method: 'GET',
    url,
  });
}

function post<TResponse, TBody>(url: string, data: TBody, config?: AxiosRequestConfig<TBody>): Promise<TResponse> {
  return request<TResponse, TBody>({
    ...config,
    data,
    method: 'POST',
    url,
  });
}

function postEmpty<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
  return request<TResponse>({
    ...config,
    method: 'POST',
    url,
  });
}

function patch<TResponse, TBody>(url: string, data: TBody, config?: AxiosRequestConfig<TBody>): Promise<TResponse> {
  return request<TResponse, TBody>({
    ...config,
    data,
    method: 'PATCH',
    url,
  });
}

function del<TResponse>(url: string, config?: AxiosRequestConfig): Promise<TResponse> {
  return request<TResponse>({
    ...config,
    method: 'DELETE',
    url,
  });
}

async function request<TResponse, TBody = unknown>(
  config: AxiosRequestConfig<TBody>,
): Promise<TResponse> {
  const response = await api.request<TResponse, { data: TResponse }, TBody>(config);
  return response.data;
}

function isAuthPath(url?: string): boolean {
  return Boolean(
    url?.includes('/auth/login') ||
      url?.includes('/auth/register') ||
      url?.includes('/auth/refresh'),
  );
}
