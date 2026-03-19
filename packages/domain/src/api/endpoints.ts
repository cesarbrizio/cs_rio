import {
  type AuthLoginInput,
  type AuthRefreshInput,
  type AuthRegisterInput,
  type AuthSession,
  type BichoListResponse,
  type BichoPlaceBetInput,
  type BichoPlaceBetResponse,
  type BocaCollectResponse,
  type BocaListResponse,
  type CrimeAttemptResponse,
  type CrimeCatalogResponse,
  type DocksEventStatusResponse,
  type DrugConsumeResponse,
  type DrugFactoryCollectResponse,
  type DrugFactoryCreateInput,
  type DrugFactoryCreateResponse,
  type DrugFactoryListResponse,
  type DrugFactoryStockInput,
  type DrugFactoryStockResponse,
  type EventResultListResponse,
  type FactionBankDepositInput,
  type FactionBankResponse,
  type FactionBankWithdrawInput,
  type FactionCrimeAttemptInput,
  type FactionCrimeAttemptResponse,
  type FactionCrimeCatalogResponse,
  type FactionCreateInput,
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
  type FactionWarDeclareResponse,
  type FactionWarPrepareInput,
  type FactionWarPrepareResponse,
  type FactionWarRoundResponse,
  type FactionWarStatusResponse,
  type FavelaBaileOrganizeInput,
  type FavelaBaileOrganizeResponse,
  type FavelaBaileStatusResponse,
  type FavelaConquestInput,
  type FavelaConquestResponse,
  type FavelaPropinaNegotiationResponse,
  type FavelaServiceInstallInput,
  type FavelaServiceMutationResponse,
  type FavelaServiceType,
  type FavelaServicesResponse,
  type FavelaX9DesenroloResponse,
  type FrontStoreCollectResponse,
  type FrontStoreListResponse,
  type HospitalActionResponse,
  type HospitalCenterResponse,
  type HospitalStatPurchaseInput,
  type HospitalSurgeryInput,
  type InventoryItemType,
  type InventoryListResponse,
  type InventoryRepairResponse,
  type MarketAuctionBidInput,
  type MarketAuctionBookResponse,
  type MarketAuctionCreateInput,
  type MarketAuctionMutationResponse,
  type MarketOrderBookResponse,
  type MarketOrderCreateInput,
  type MarketOrderMutationResponse,
  type PlayerContactCreateInput,
  type PlayerContactMutationResponse,
  type PlayerContactRemovalResponse,
  type PlayerContactsResponse,
  type PlayerCreationInput,
  type PlayerProfile,
  type PlayerPublicProfile,
  type PlayerTravelInput,
  type PlayerVocationCenterResponse,
  type PlayerVocationChangeInput,
  type PlayerVocationChangeResponse,
  type PoliceEventStatusResponse,
  type PrisonActionResponse,
  type PrisonCenterResponse,
  type PrivateMessageSendInput,
  type PrivateMessageSendResponse,
  type PrivateMessageThreadListResponse,
  type PrivateMessageThreadResponse,
  type PropertyCatalogResponse,
  type PropertyHireSoldiersInput,
  type PropertyHireSoldiersResponse,
  type PropertyPurchaseInput,
  type PropertyPurchaseResponse,
  type PropertySabotageAttemptResponse,
  type PropertySabotageCenterResponse,
  type PropertySabotageRecoveryResponse,
  type PropertyUpgradeResponse,
  type PuteiroCollectResponse,
  type PuteiroHireInput,
  type PuteiroHireResponse,
  type PuteiroListResponse,
  type PvpAmbushResponse,
  type PvpAssassinationContractsResponse,
  type PvpAssaultResponse,
  type PvpContractAcceptResponse,
  type PvpContractCreateResponse,
  type PvpContractExecutionResponse,
  type RaveCollectResponse,
  type RaveListResponse,
  type RoundCenterResponse,
  type SeasonalEventStatusResponse,
  type SlotMachineCollectResponse,
  type SlotMachineConfigureInput,
  type SlotMachineConfigureResponse,
  type SlotMachineInstallInput,
  type SlotMachineInstallResponse,
  type SlotMachineListResponse,
  type TerritoryLossFeedResponse,
  type TerritoryOverviewResponse,
  type TrainingCenterResponse,
  type TrainingClaimResponse,
  type TrainingStartInput,
  type TrainingStartResponse,
  type TribunalCaseGenerateResponse,
  type TribunalCenterResponse,
  type TribunalCueListResponse,
  type TribunalJudgmentInput,
  type TribunalJudgmentResponse,
  type UniversityCenterResponse,
  type UniversityEnrollInput,
  type UniversityEnrollResponse,
} from '@cs-rio/shared';
import type { AxiosRequestConfig } from 'axios';

export interface MarketOrderBookFilters {
  itemId?: string;
  itemType?: InventoryItemType;
}

export interface MarketAuctionBookFilters {
  itemId?: string;
  itemType?: 'vest' | 'weapon';
}

export interface ApiRequester {
  del: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  get: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
  patch: <TResponse, TBody>(
    url: string,
    data: TBody,
    config?: AxiosRequestConfig<TBody>,
  ) => Promise<TResponse>;
  post: <TResponse, TBody>(
    url: string,
    data: TBody,
    config?: AxiosRequestConfig<TBody>,
  ) => Promise<TResponse>;
  postEmpty: <TResponse>(url: string, config?: AxiosRequestConfig) => Promise<TResponse>;
}

export function createApiModules(requester: ApiRequester) {
  const { del, get, patch, post, postEmpty } = requester;

  return {
    authApi: {
      login(input: AuthLoginInput): Promise<AuthSession> {
        return post<AuthSession, AuthLoginInput>('/auth/login', input);
      },
      refresh(input: AuthRefreshInput): Promise<AuthSession> {
        return post<AuthSession, AuthRefreshInput>('/auth/refresh', input);
      },
      register(input: AuthRegisterInput): Promise<AuthSession> {
        return post<AuthSession, AuthRegisterInput>('/auth/register', input);
      },
    },
    playerApi: {
      changeVocation(
        input: PlayerVocationChangeInput,
      ): Promise<PlayerVocationChangeResponse> {
        return post<PlayerVocationChangeResponse, PlayerVocationChangeInput>(
          '/players/vocation/change',
          input,
        );
      },
      createCharacter(input: PlayerCreationInput): Promise<PlayerProfile> {
        return post<PlayerProfile, PlayerCreationInput>('/players/create', input);
      },
      getProfile(): Promise<PlayerProfile> {
        return get<PlayerProfile>('/players/me');
      },
      getPublicProfile(nickname: string): Promise<PlayerPublicProfile> {
        return get<PlayerPublicProfile>(`/players/public/${nickname}`);
      },
      getVocationCenter(): Promise<PlayerVocationCenterResponse> {
        return get<PlayerVocationCenterResponse>('/players/vocation');
      },
      travel(input: PlayerTravelInput): Promise<PlayerProfile> {
        return post<PlayerProfile, PlayerTravelInput>('/players/travel', input);
      },
    },
    contactApi: {
      add(input: PlayerContactCreateInput): Promise<PlayerContactMutationResponse> {
        return post<PlayerContactMutationResponse, PlayerContactCreateInput>(
          '/contacts',
          input,
        );
      },
      list(): Promise<PlayerContactsResponse> {
        return get<PlayerContactsResponse>('/contacts');
      },
      remove(contactId: string): Promise<PlayerContactRemovalResponse> {
        return del<PlayerContactRemovalResponse>(`/contacts/${contactId}`);
      },
    },
    privateMessageApi: {
      getThread(contactId: string): Promise<PrivateMessageThreadResponse> {
        return get<PrivateMessageThreadResponse>(
          `/private-messages/threads/${contactId}`,
        );
      },
      listThreads(): Promise<PrivateMessageThreadListResponse> {
        return get<PrivateMessageThreadListResponse>('/private-messages/threads');
      },
      send(
        contactId: string,
        input: PrivateMessageSendInput,
      ): Promise<PrivateMessageSendResponse> {
        return post<PrivateMessageSendResponse, PrivateMessageSendInput>(
          `/private-messages/threads/${contactId}`,
          input,
        );
      },
    },
    prisonApi: {
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
        return postEmpty<PrisonActionResponse>(
          `/prison/faction-rescue/${targetPlayerId}`,
        );
      },
    },
    roundApi: {
      getCenter(): Promise<RoundCenterResponse> {
        return get<RoundCenterResponse>('/round');
      },
    },
    eventApi: {
      getDocksStatus(): Promise<DocksEventStatusResponse> {
        return get<DocksEventStatusResponse>('/events/docks');
      },
      getPoliceStatus(): Promise<PoliceEventStatusResponse> {
        return get<PoliceEventStatusResponse>('/events/police');
      },
      getResults(): Promise<EventResultListResponse> {
        return get<EventResultListResponse>('/events/results');
      },
      getSeasonalStatus(): Promise<SeasonalEventStatusResponse> {
        return get<SeasonalEventStatusResponse>('/events/seasonal');
      },
    },
    hospitalApi: {
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
      purchaseStatItem(
        input: HospitalStatPurchaseInput,
      ): Promise<HospitalActionResponse> {
        return post<HospitalActionResponse, HospitalStatPurchaseInput>(
          '/hospital/stat-items',
          input,
        );
      },
      surgery(input: HospitalSurgeryInput): Promise<HospitalActionResponse> {
        return post<HospitalActionResponse, HospitalSurgeryInput>(
          '/hospital/surgery',
          input,
        );
      },
    },
    crimesApi: {
      attempt(crimeId: string): Promise<CrimeAttemptResponse> {
        return postEmpty<CrimeAttemptResponse>(`/crimes/${crimeId}/attempt`);
      },
      list(): Promise<CrimeCatalogResponse> {
        return get<CrimeCatalogResponse>('/crimes');
      },
    },
    factionCrimeApi: {
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
    },
    factionApi: {
      challengeLeadership(
        factionId: string,
      ): Promise<FactionLeadershipChallengeResponse> {
        return postEmpty<FactionLeadershipChallengeResponse>(
          `/factions/${factionId}/leadership/challenge`,
        );
      },
      create(input: FactionCreateInput): Promise<FactionMutationResponse> {
        return post<FactionMutationResponse, FactionCreateInput>('/factions', input);
      },
      demote(
        factionId: string,
        memberPlayerId: string,
      ): Promise<FactionMembersResponse> {
        return postEmpty<FactionMembersResponse>(
          `/factions/${factionId}/members/${memberPlayerId}/demote`,
        );
      },
      deposit(
        factionId: string,
        input: FactionBankDepositInput,
      ): Promise<FactionBankResponse> {
        return post<FactionBankResponse, FactionBankDepositInput>(
          `/factions/${factionId}/bank/deposit`,
          input,
        );
      },
      dissolve(factionId: string): Promise<FactionDissolveResponse> {
        return del<FactionDissolveResponse>(`/factions/${factionId}`);
      },
      expel(factionId: string, memberPlayerId: string): Promise<FactionMembersResponse> {
        return del<FactionMembersResponse>(
          `/factions/${factionId}/members/${memberPlayerId}`,
        );
      },
      getBank(factionId: string): Promise<FactionBankResponse> {
        return get<FactionBankResponse>(`/factions/${factionId}/bank`);
      },
      getLeadership(factionId: string): Promise<FactionLeadershipCenterResponse> {
        return get<FactionLeadershipCenterResponse>(
          `/factions/${factionId}/leadership`,
        );
      },
      getMembers(factionId: string): Promise<FactionMembersResponse> {
        return get<FactionMembersResponse>(`/factions/${factionId}/members`);
      },
      getUpgrades(factionId: string): Promise<FactionUpgradeCenterResponse> {
        return get<FactionUpgradeCenterResponse>(`/factions/${factionId}/upgrades`);
      },
      join(factionId: string): Promise<FactionMutationResponse> {
        return postEmpty<FactionMutationResponse>(`/factions/${factionId}/join`);
      },
      leave(factionId: string): Promise<FactionLeaveResponse> {
        return postEmpty<FactionLeaveResponse>(`/factions/${factionId}/leave`);
      },
      list(): Promise<FactionListResponse> {
        return get<FactionListResponse>('/factions');
      },
      promote(
        factionId: string,
        memberPlayerId: string,
      ): Promise<FactionMembersResponse> {
        return postEmpty<FactionMembersResponse>(
          `/factions/${factionId}/members/${memberPlayerId}/promote`,
        );
      },
      recruit(
        factionId: string,
        input: FactionRecruitInput,
      ): Promise<FactionMembersResponse> {
        return post<FactionMembersResponse, FactionRecruitInput>(
          `/factions/${factionId}/members`,
          input,
        );
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
        return postEmpty<FactionUpgradeUnlockResponse>(
          `/factions/${factionId}/upgrades/${upgradeType}/unlock`,
        );
      },
      update(
        factionId: string,
        input: FactionUpdateInput,
      ): Promise<FactionMutationResponse> {
        return patch<FactionMutationResponse, FactionUpdateInput>(
          `/factions/${factionId}`,
          input,
        );
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
      withdraw(
        factionId: string,
        input: FactionBankWithdrawInput,
      ): Promise<FactionBankResponse> {
        return post<FactionBankResponse, FactionBankWithdrawInput>(
          `/factions/${factionId}/bank/withdraw`,
          input,
        );
      },
    },
    propertyApi: {
      attemptSabotage(propertyId: string): Promise<PropertySabotageAttemptResponse> {
        return postEmpty<PropertySabotageAttemptResponse>(
          `/properties/${propertyId}/sabotage`,
        );
      },
      getSabotageCenter(): Promise<PropertySabotageCenterResponse> {
        return get<PropertySabotageCenterResponse>('/properties/sabotage');
      },
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
      purchase(input: PropertyPurchaseInput): Promise<PropertyPurchaseResponse> {
        return post<PropertyPurchaseResponse, PropertyPurchaseInput>(
          '/properties',
          input,
        );
      },
      recoverSabotage(propertyId: string): Promise<PropertySabotageRecoveryResponse> {
        return postEmpty<PropertySabotageRecoveryResponse>(
          `/properties/${propertyId}/sabotage/recover`,
        );
      },
      upgrade(propertyId: string): Promise<PropertyUpgradeResponse> {
        return postEmpty<PropertyUpgradeResponse>(`/properties/${propertyId}/upgrade`);
      },
    },
    inventoryApi: {
      consume(inventoryItemId: string): Promise<DrugConsumeResponse> {
        return postEmpty<DrugConsumeResponse>(`/inventory/${inventoryItemId}/consume`);
      },
      equip(inventoryItemId: string): Promise<InventoryListResponse> {
        return postEmpty<InventoryListResponse>(`/inventory/${inventoryItemId}/equip`);
      },
      repair(inventoryItemId: string): Promise<InventoryRepairResponse> {
        return postEmpty<InventoryRepairResponse>(`/inventory/${inventoryItemId}/repair`);
      },
      unequip(inventoryItemId: string): Promise<InventoryListResponse> {
        return postEmpty<InventoryListResponse>(`/inventory/${inventoryItemId}/unequip`);
      },
    },
    factoryApi: {
      collect(factoryId: string): Promise<DrugFactoryCollectResponse> {
        return postEmpty<DrugFactoryCollectResponse>(`/factories/${factoryId}/collect`);
      },
      create(input: DrugFactoryCreateInput): Promise<DrugFactoryCreateResponse> {
        return post<DrugFactoryCreateResponse, DrugFactoryCreateInput>(
          '/factories',
          input,
        );
      },
      list(): Promise<DrugFactoryListResponse> {
        return get<DrugFactoryListResponse>('/factories');
      },
      stockComponent(
        factoryId: string,
        input: DrugFactoryStockInput,
      ): Promise<DrugFactoryStockResponse> {
        return post<DrugFactoryStockResponse, DrugFactoryStockInput>(
          `/factories/${factoryId}/components`,
          input,
        );
      },
    },
    bocaApi: {
      collect(propertyId: string): Promise<BocaCollectResponse> {
        return postEmpty<BocaCollectResponse>(`/bocas/${propertyId}/collect`);
      },
      list(): Promise<BocaListResponse> {
        return get<BocaListResponse>('/bocas');
      },
    },
    raveApi: {
      collect(propertyId: string): Promise<RaveCollectResponse> {
        return postEmpty<RaveCollectResponse>(`/raves/${propertyId}/collect`);
      },
      list(): Promise<RaveListResponse> {
        return get<RaveListResponse>('/raves');
      },
    },
    puteiroApi: {
      collect(propertyId: string): Promise<PuteiroCollectResponse> {
        return postEmpty<PuteiroCollectResponse>(`/puteiros/${propertyId}/collect`);
      },
      hireGps(propertyId: string, input: PuteiroHireInput): Promise<PuteiroHireResponse> {
        return post<PuteiroHireResponse, PuteiroHireInput>(
          `/puteiros/${propertyId}/gps`,
          input,
        );
      },
      list(): Promise<PuteiroListResponse> {
        return get<PuteiroListResponse>('/puteiros');
      },
    },
    frontStoreApi: {
      collect(propertyId: string): Promise<FrontStoreCollectResponse> {
        return postEmpty<FrontStoreCollectResponse>(`/front-stores/${propertyId}/collect`);
      },
      list(): Promise<FrontStoreListResponse> {
        return get<FrontStoreListResponse>('/front-stores');
      },
    },
    bichoApi: {
      getState(): Promise<BichoListResponse> {
        return get<BichoListResponse>('/jogo-do-bicho');
      },
      placeBet(input: BichoPlaceBetInput): Promise<BichoPlaceBetResponse> {
        return post<BichoPlaceBetResponse, BichoPlaceBetInput>(
          '/jogo-do-bicho/bets',
          input,
        );
      },
    },
    slotMachineApi: {
      collect(propertyId: string): Promise<SlotMachineCollectResponse> {
        return postEmpty<SlotMachineCollectResponse>(
          `/slot-machines/${propertyId}/collect`,
        );
      },
      configure(
        propertyId: string,
        input: SlotMachineConfigureInput,
      ): Promise<SlotMachineConfigureResponse> {
        return post<SlotMachineConfigureResponse, SlotMachineConfigureInput>(
          `/slot-machines/${propertyId}/configure`,
          input,
        );
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
    },
    trainingApi: {
      claim(sessionId: string): Promise<TrainingClaimResponse> {
        return postEmpty<TrainingClaimResponse>(
          `/training-center/sessions/${sessionId}/claim`,
        );
      },
      getCenter(): Promise<TrainingCenterResponse> {
        return get<TrainingCenterResponse>('/training-center');
      },
      start(input: TrainingStartInput): Promise<TrainingStartResponse> {
        return post<TrainingStartResponse, TrainingStartInput>(
          '/training-center/sessions',
          input,
        );
      },
    },
    universityApi: {
      enroll(input: UniversityEnrollInput): Promise<UniversityEnrollResponse> {
        return post<UniversityEnrollResponse, UniversityEnrollInput>(
          '/university/enrollments',
          input,
        );
      },
      getCenter(): Promise<UniversityCenterResponse> {
        return get<UniversityCenterResponse>('/university');
      },
    },
    tribunalApi: {
      generateCase(favelaId: string): Promise<TribunalCaseGenerateResponse> {
        return postEmpty<TribunalCaseGenerateResponse>(
          `/tribunal/favelas/${favelaId}/case`,
        );
      },
      getCenter(favelaId: string): Promise<TribunalCenterResponse> {
        return get<TribunalCenterResponse>(`/tribunal/favelas/${favelaId}/case`);
      },
      getCues(): Promise<TribunalCueListResponse> {
        return get<TribunalCueListResponse>('/tribunal/cues');
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
    },
    pvpApi: {
      acceptContract(contractId: string): Promise<PvpContractAcceptResponse> {
        return postEmpty<PvpContractAcceptResponse>(`/pvp/contracts/${contractId}/accept`);
      },
      ambush(
        targetPlayerId: string,
        participantIds: string[],
      ): Promise<PvpAmbushResponse> {
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
        return postEmpty<PvpContractExecutionResponse>(
          `/pvp/contracts/${contractId}/execute`,
        );
      },
      listContracts(): Promise<PvpAssassinationContractsResponse> {
        return get<PvpAssassinationContractsResponse>('/pvp/contracts');
      },
    },
    territoryApi: {
      attemptX9Desenrolo(favelaId: string): Promise<FavelaX9DesenroloResponse> {
        return postEmpty<FavelaX9DesenroloResponse>(
          `/territory/favelas/${favelaId}/x9/desenrolo`,
        );
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
        return postEmpty<FactionWarDeclareResponse>(
          `/territory/favelas/${favelaId}/war/declare`,
        );
      },
      getBaile(favelaId: string): Promise<FavelaBaileStatusResponse> {
        return get<FavelaBaileStatusResponse>(`/territory/favelas/${favelaId}/baile`);
      },
      getLosses(): Promise<TerritoryLossFeedResponse> {
        return get<TerritoryLossFeedResponse>('/territory/losses');
      },
      getServices(favelaId: string): Promise<FavelaServicesResponse> {
        return get<FavelaServicesResponse>(
          `/territory/favelas/${favelaId}/services`,
        );
      },
      getWar(favelaId: string): Promise<FactionWarStatusResponse> {
        return get<FactionWarStatusResponse>(`/territory/favelas/${favelaId}/war`);
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
      list(): Promise<TerritoryOverviewResponse> {
        return get<TerritoryOverviewResponse>('/territory/favelas');
      },
      negotiatePropina(favelaId: string): Promise<FavelaPropinaNegotiationResponse> {
        return postEmpty<FavelaPropinaNegotiationResponse>(
          `/territory/favelas/${favelaId}/propina/negotiate`,
        );
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
        return postEmpty<FactionWarRoundResponse>(
          `/territory/favelas/${favelaId}/war/round`,
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
    },
    marketApi: {
      bidAuction(
        auctionId: string,
        input: MarketAuctionBidInput,
      ): Promise<MarketAuctionMutationResponse> {
        return post<MarketAuctionMutationResponse, MarketAuctionBidInput>(
          `/market/auctions/${auctionId}/bid`,
          input,
        );
      },
      cancel(orderId: string): Promise<MarketOrderMutationResponse> {
        return postEmpty<MarketOrderMutationResponse>(`/market/orders/${orderId}/cancel`);
      },
      createAuction(
        input: MarketAuctionCreateInput,
      ): Promise<MarketAuctionMutationResponse> {
        return post<MarketAuctionMutationResponse, MarketAuctionCreateInput>(
          '/market/auctions',
          input,
        );
      },
      createOrder(input: MarketOrderCreateInput): Promise<MarketOrderMutationResponse> {
        return post<MarketOrderMutationResponse, MarketOrderCreateInput>(
          '/market/orders',
          input,
        );
      },
      getAuctionBook(
        filters: MarketAuctionBookFilters = {},
      ): Promise<MarketAuctionBookResponse> {
        return get<MarketAuctionBookResponse>('/market/auctions', {
          params: filters,
        });
      },
      getOrderBook(
        filters: MarketOrderBookFilters = {},
      ): Promise<MarketOrderBookResponse> {
        return get<MarketOrderBookResponse>('/market/orders', {
          params: filters,
        });
      },
    },
  };
}

export type ApiModules = ReturnType<typeof createApiModules>;
