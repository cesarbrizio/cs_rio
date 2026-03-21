import {
  type AuthLoginInput,
  type AuthRefreshInput,
  type AuthRegisterInput,
  type AuthSession,
  type CrimeAttemptResponse,
  type CrimeCatalogResponse,
  type DocksEventStatusResponse,
  type EventResultListResponse,
  type FactionCrimeAttemptInput,
  type FactionCrimeAttemptResponse,
  type FactionCrimeCatalogResponse,
  type HospitalActionResponse,
  type HospitalCenterResponse,
  type HospitalStatPurchaseInput,
  type HospitalSurgeryInput,
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
  type RoundCenterResponse,
  type SeasonalEventStatusResponse,
} from '@cs-rio/shared';

import type { ApiRequester } from './endpoints-types';

export function buildCoreApiModules(requester: ApiRequester) {
  const { del, get, post, postEmpty } = requester;

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
      changeVocation(input: PlayerVocationChangeInput): Promise<PlayerVocationChangeResponse> {
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
        return post<PlayerContactMutationResponse, PlayerContactCreateInput>('/contacts', input);
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
        return get<PrivateMessageThreadResponse>(`/private-messages/threads/${contactId}`);
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
        return postEmpty<PrisonActionResponse>(`/prison/faction-rescue/${targetPlayerId}`);
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
      purchaseStatItem(input: HospitalStatPurchaseInput): Promise<HospitalActionResponse> {
        return post<HospitalActionResponse, HospitalStatPurchaseInput>(
          '/hospital/stat-items',
          input,
        );
      },
      surgery(input: HospitalSurgeryInput): Promise<HospitalActionResponse> {
        return post<HospitalActionResponse, HospitalSurgeryInput>('/hospital/surgery', input);
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
  };
}
