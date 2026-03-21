import {
  type DrugConsumeResponse,
  type FactionBankDepositInput,
  type FactionBankResponse,
  type FactionBankWithdrawInput,
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
  type InventoryListResponse,
  type InventoryRepairResponse,
  type PropertyCatalogResponse,
  type PropertyHireSoldiersInput,
  type PropertyHireSoldiersResponse,
  type PropertyPurchaseInput,
  type PropertyPurchaseResponse,
  type PropertyUpgradeResponse,
} from '@cs-rio/shared';

import type { ApiRequester } from './endpoints-types';

export function buildFactionApiModules(requester: ApiRequester) {
  const { del, get, patch, post, postEmpty } = requester;

  return {
    factionApi: {
      challengeLeadership(factionId: string): Promise<FactionLeadershipChallengeResponse> {
        return postEmpty<FactionLeadershipChallengeResponse>(
          `/factions/${factionId}/leadership/challenge`,
        );
      },
      create(input: FactionCreateInput): Promise<FactionMutationResponse> {
        return post<FactionMutationResponse, FactionCreateInput>('/factions', input);
      },
      demote(factionId: string, memberPlayerId: string): Promise<FactionMembersResponse> {
        return postEmpty<FactionMembersResponse>(
          `/factions/${factionId}/members/${memberPlayerId}/demote`,
        );
      },
      deposit(factionId: string, input: FactionBankDepositInput): Promise<FactionBankResponse> {
        return post<FactionBankResponse, FactionBankDepositInput>(
          `/factions/${factionId}/bank/deposit`,
          input,
        );
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
      getLeadership(factionId: string): Promise<FactionLeadershipCenterResponse> {
        return get<FactionLeadershipCenterResponse>(`/factions/${factionId}/leadership`);
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
      promote(factionId: string, memberPlayerId: string): Promise<FactionMembersResponse> {
        return postEmpty<FactionMembersResponse>(
          `/factions/${factionId}/members/${memberPlayerId}/promote`,
        );
      },
      recruit(factionId: string, input: FactionRecruitInput): Promise<FactionMembersResponse> {
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
      update(factionId: string, input: FactionUpdateInput): Promise<FactionMutationResponse> {
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
        return post<PropertyPurchaseResponse, PropertyPurchaseInput>('/properties', input);
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
  };
}
