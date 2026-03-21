import {
  type BichoListResponse,
  type BichoPlaceBetInput,
  type BichoPlaceBetResponse,
  type BocaCollectResponse,
  type BocaListResponse,
  type DrugFactoryCollectResponse,
  type DrugFactoryCreateInput,
  type DrugFactoryCreateResponse,
  type DrugFactoryListResponse,
  type DrugFactoryStockInput,
  type DrugFactoryStockResponse,
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
  type MarketAuctionBidInput,
  type MarketAuctionBookResponse,
  type MarketAuctionCreateInput,
  type MarketAuctionMutationResponse,
  type MarketOrderBookResponse,
  type MarketOrderCreateInput,
  type MarketOrderMutationResponse,
  type PropertyHireSoldiersResponse,
  type PuteiroCollectResponse,
  type PuteiroHireInput,
  type PuteiroHireResponse,
  type PuteiroListResponse,
  type RaveCollectResponse,
  type RaveListResponse,
  type SlotMachineCollectResponse,
  type SlotMachineConfigureInput,
  type SlotMachineConfigureResponse,
  type SlotMachineInstallInput,
  type SlotMachineInstallResponse,
  type SlotMachineListResponse,
  type TerritoryLossFeedResponse,
  type TerritoryOverviewResponse,
  type TribunalCaseGenerateResponse,
  type TribunalCenterResponse,
  type TribunalCueListResponse,
  type TribunalJudgmentInput,
  type TribunalJudgmentResponse,
  type UniversityCenterResponse,
  type UniversityEnrollInput,
  type UniversityEnrollResponse,
} from '@cs-rio/shared';

import type {
  ApiRequester,
  MarketAuctionBookFilters,
  MarketOrderBookFilters,
} from './endpoints-types';

export function buildOperationsApiModules(requester: ApiRequester) {
  const { get, post, postEmpty } = requester;

  return {
    factoryApi: {
      collect(factoryId: string): Promise<DrugFactoryCollectResponse> {
        return postEmpty<DrugFactoryCollectResponse>(`/factories/${factoryId}/collect`);
      },
      create(input: DrugFactoryCreateInput): Promise<DrugFactoryCreateResponse> {
        return post<DrugFactoryCreateResponse, DrugFactoryCreateInput>('/factories', input);
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
        return postEmpty<SlotMachineCollectResponse>(`/slot-machines/${propertyId}/collect`);
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
        return postEmpty<TribunalCaseGenerateResponse>(`/tribunal/favelas/${favelaId}/case`);
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
        return postEmpty<FactionWarDeclareResponse>(`/territory/favelas/${favelaId}/war/declare`);
      },
      getBaile(favelaId: string): Promise<FavelaBaileStatusResponse> {
        return get<FavelaBaileStatusResponse>(`/territory/favelas/${favelaId}/baile`);
      },
      getLosses(): Promise<TerritoryLossFeedResponse> {
        return get<TerritoryLossFeedResponse>('/territory/losses');
      },
      getServices(favelaId: string): Promise<FavelaServicesResponse> {
        return get<FavelaServicesResponse>(`/territory/favelas/${favelaId}/services`);
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
        return postEmpty<FactionWarRoundResponse>(`/territory/favelas/${favelaId}/war/round`);
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
      createAuction(input: MarketAuctionCreateInput): Promise<MarketAuctionMutationResponse> {
        return post<MarketAuctionMutationResponse, MarketAuctionCreateInput>(
          '/market/auctions',
          input,
        );
      },
      createOrder(input: MarketOrderCreateInput): Promise<MarketOrderMutationResponse> {
        return post<MarketOrderMutationResponse, MarketOrderCreateInput>('/market/orders', input);
      },
      getAuctionBook(filters: MarketAuctionBookFilters = {}): Promise<MarketAuctionBookResponse> {
        return get<MarketAuctionBookResponse>('/market/auctions', { params: filters });
      },
      getOrderBook(filters: MarketOrderBookFilters = {}): Promise<MarketOrderBookResponse> {
        return get<MarketOrderBookResponse>('/market/orders', { params: filters });
      },
    },
  };
}
