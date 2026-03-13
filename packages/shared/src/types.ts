export enum VocationType {
  Cria = 'cria',
  Gerente = 'gerente',
  Soldado = 'soldado',
  Politico = 'politico',
  Empreendedor = 'empreendedor',
}

export enum LevelTitle {
  Pivete = 'pivete',
  Aviaozinho = 'aviaozinho',
  Fogueteiro = 'fogueteiro',
  Vapor = 'vapor',
  Soldado = 'soldado',
  GerenteDeBoca = 'gerente_de_boca',
  Frente = 'frente',
  DonoDaBoca = 'dono_da_boca',
  LiderDaFaccao = 'lider_da_faccao',
  Prefeito = 'prefeito',
}

export enum RegionId {
  ZonaSul = 'zona_sul',
  ZonaNorte = 'zona_norte',
  Centro = 'centro',
  ZonaOeste = 'zona_oeste',
  ZonaSudoeste = 'zona_sudoeste',
  Baixada = 'baixada',
}

export enum DrugType {
  Maconha = 'maconha',
  Lanca = 'lanca',
  Bala = 'bala',
  Doce = 'doce',
  MD = 'md',
  Cocaina = 'cocaina',
  Crack = 'crack',
}

export enum CrimeType {
  Solo = 'solo',
  Faccao = 'faccao',
  Territorial = 'territorial',
}

export type InventoryItemType =
  | 'weapon'
  | 'vest'
  | 'drug'
  | 'consumable'
  | 'boost'
  | 'component'
  | 'property_upgrade';

export type InventoryEquipSlot = 'weapon' | 'vest';
export type PropertyType =
  | 'boca'
  | 'factory'
  | 'puteiro'
  | 'rave'
  | 'house'
  | 'beach_house'
  | 'mansion'
  | 'car'
  | 'boat'
  | 'yacht'
  | 'jet_ski'
  | 'airplane'
  | 'helicopter'
  | 'jewelry'
  | 'art'
  | 'luxury'
  | 'front_store'
  | 'slot_machine';
export type PropertyAssetClass = 'business' | 'real_estate' | 'vehicle' | 'luxury';
export type PropertyTravelMode = 'ground' | 'sea' | 'air';
export type GpType = 'novinha' | 'experiente' | 'premium' | 'vip' | 'diamante';
export type PuteiroGpStatus = 'active' | 'escaped' | 'deceased';
export type FrontStoreKind = 'lava_rapido' | 'barbearia' | 'igreja' | 'acai' | 'oficina';
export type FrontStoreBatchStatus = 'pending' | 'completed' | 'seized';
export type BichoBetMode = 'cabeca' | 'grupo' | 'dezena';
export type BichoBetStatus = 'pending' | 'won' | 'lost';
export type SoldierType =
  | 'olheiro'
  | 'soldado_rua'
  | 'fogueteiro_alerta'
  | 'seguranca_armado'
  | 'mercenario';
export type MarketOrderSide = 'buy' | 'sell';
export type MarketOrderStatus = 'open' | 'filled' | 'cancelled';
export type MarketAuctionStatus = 'open' | 'settled' | 'expired';
export type MarketAuctionNotificationType = 'outbid' | 'returned' | 'sold' | 'won';
export type DrugSaleChannel = 'street' | 'boca' | 'rave' | 'docks';
export type DocksEventPhase = 'active' | 'idle' | 'scheduled';
export type PoliceEventType = 'blitz_pm' | 'faca_na_caveira' | 'operacao_policial';
export type SeasonalEventType = 'ano_novo_copa' | 'carnaval' | 'operacao_verao';
export type SeasonalEventPoliceMood = 'distracted' | 'reinforced';
export type HospitalizationReason = 'combat' | 'overdose';
export type OverdoseTrigger = 'stamina_overflow' | 'max_addiction' | 'poly_drug_mix';
export type HospitalStatItemCode =
  | 'cerebrina'
  | 'pocao_carisma'
  | 'creatina'
  | 'deca_durabolin';
export type PlayerPoliceHeatTier = 'frio' | 'observado' | 'marcado' | 'quente' | 'cacado';
export type RobberyType = 'pedestrian' | 'cellphones' | 'vehicle' | 'truck';
export type VehicleRobberyRoute = 'ransom' | 'chop_shop' | 'paraguay';
export type RobberyExecutorType = 'player' | 'bandits';
export type RobberyFailureOutcome = 'escaped' | 'hospitalized' | 'imprisoned' | 'bandits_arrested';
export type FactionRobberyPolicyMode = 'allowed' | 'forbidden';
export type TrainingType = 'basic' | 'advanced' | 'intensive';
export type FactionRank = 'patrao' | 'general' | 'gerente' | 'vapor' | 'soldado' | 'cria';
export type FactionBankEntryType =
  | 'deposit'
  | 'withdrawal'
  | 'business_commission'
  | 'robbery_commission'
  | 'service_income';
export type FactionBankOriginType =
  | 'manual'
  | 'boca'
  | 'rave'
  | 'puteiro'
  | 'front_store'
  | 'robbery'
  | 'slot_machine'
  | 'favela_service'
  | 'propina';
export type PlayerBankEntryType = 'deposit' | 'withdrawal' | 'interest';
export type RoundStatus = 'scheduled' | 'active' | 'finished';
export type GameConfigStatus = 'active' | 'inactive';
export type GameConfigScope =
  | 'global'
  | 'round'
  | 'region'
  | 'favela'
  | 'faction_template'
  | 'event_type'
  | 'robbery_type'
  | 'property_type'
  | 'service_type';
export type FactionUpgradeType =
  | 'mula_nivel_1'
  | 'mula_nivel_2'
  | 'mula_nivel_3'
  | 'mula_max'
  | 'bonus_atributos_5'
  | 'bonus_atributos_10'
  | 'arsenal_exclusivo'
  | 'exercito_expandido'
  | 'qg_fortificado';
export type FactionLeadershipElectionStatus = 'petitioning' | 'active' | 'resolved';
export type FavelaControlState = 'neutral' | 'controlled' | 'at_war' | 'state';
export type FavelaStateTransitionAction = 'declare_war' | 'attacker_win' | 'defender_hold';
export type FavelaServiceType =
  | 'gatonet'
  | 'tvgato'
  | 'botijao_gas'
  | 'mototaxi'
  | 'van'
  | 'comercio_local';
export type UniversityCourseCode =
  | 'mao_leve'
  | 'corrida_de_fuga'
  | 'olho_clinico'
  | 'rei_da_rua'
  | 'logistica_de_boca'
  | 'rede_de_distribuicao'
  | 'quimico_mestre'
  | 'magnata_do_po'
  | 'tiro_certeiro'
  | 'emboscada_perfeita'
  | 'instinto_de_sobrevivencia'
  | 'maquina_de_guerra'
  | 'labia_de_politico'
  | 'rede_de_contatos'
  | 'manipulacao_de_massa'
  | 'poderoso_chefao'
  | 'engenharia_financeira'
  | 'faro_para_negocios'
  | 'mercado_paralelo'
  | 'imperio_do_crime';
export type TribunalCaseType =
  | 'roubo_entre_moradores'
  | 'talaricagem'
  | 'divida_jogo'
  | 'divida_drogas'
  | 'estupro'
  | 'agressao'
  | 'homicidio_nao_autorizado';
export type TribunalCaseSide = 'accuser' | 'accused';
export type TribunalPunishment =
  | 'aviso'
  | 'surra'
  | 'expulsao'
  | 'matar'
  | 'esquartejar'
  | 'queimar_no_pneu';
export type TribunalCaseSeverity = 'baixa_media' | 'media' | 'media_alta' | 'muito_alta';

export interface PlayerAttributes {
  forca: number;
  inteligencia: number;
  resistencia: number;
  carisma: number;
}

export interface PlayerResources {
  conceito: number;
  stamina: number;
  nerve: number;
  morale: number;
  hp: number;
  addiction: number;
  money: number;
  bankMoney: number;
}

export interface PlayerSummary {
  id: string;
  nickname: string;
  vocation: VocationType;
  level: number;
  title: LevelTitle;
  regionId: RegionId;
  attributes: PlayerAttributes;
  resources: PlayerResources;
}

export interface GameConfigSetSummary {
  code: string;
  description: string | null;
  id: string;
  isDefault: boolean;
  name: string;
  notes: string | null;
  status: GameConfigStatus;
}

export interface GameConfigEntrySummary {
  effectiveFrom: string;
  effectiveUntil: string | null;
  id: string;
  key: string;
  notes: string | null;
  scope: GameConfigScope;
  status: GameConfigStatus;
  targetKey: string;
  valueJson: Record<string, unknown>;
}

export interface RoundConfigOverrideSummary extends GameConfigEntrySummary {
  roundId: string;
}

export interface FeatureFlagSummary {
  effectiveFrom: string;
  effectiveUntil: string | null;
  id: string;
  key: string;
  notes: string | null;
  payloadJson: Record<string, unknown>;
  scope: GameConfigScope;
  status: GameConfigStatus;
  targetKey: string;
}

export interface ResolvedGameConfigEntrySummary {
  key: string;
  scope: GameConfigScope;
  source: 'fallback' | 'round_override' | 'set_entry';
  targetKey: string;
  valueJson: Record<string, unknown>;
}

export interface ResolvedGameConfigCatalog {
  activeRoundId: string | null;
  activeSet: GameConfigSetSummary | null;
  entries: ResolvedGameConfigEntrySummary[];
  featureFlags: FeatureFlagSummary[];
  resolvedAt: string;
}

export interface CharacterAppearance {
  skin: string;
  hair: string;
  outfit: string;
}

export interface PlayerLocation {
  regionId: RegionId;
  positionX: number;
  positionY: number;
}

export interface PlayerFactionSummary {
  id: string;
  name: string;
  abbreviation: string;
  rank: FactionRank | null;
}

export interface FactionRobberyPolicy {
  global: FactionRobberyPolicyMode;
  regions: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

export interface FactionSummary {
  availableJoinSlots: number | null;
  abbreviation: string;
  bankMoney: number;
  canConfigure: boolean;
  canDissolve: boolean;
  canSelfJoin: boolean;
  createdAt: string;
  description: string | null;
  id: string;
  internalSatisfaction: number;
  isFixed: boolean;
  isNpcControlled: boolean;
  isPlayerMember: boolean;
  leaderId: string | null;
  memberCount: number;
  myRank: FactionRank | null;
  name: string;
  npcLeaderName: string | null;
  points: number;
  robberyPolicy: FactionRobberyPolicy;
}

export interface FactionCreateInput {
  abbreviation: string;
  description?: string | null;
  name: string;
}

export interface FactionRecruitInput {
  nickname: string;
}

export interface FactionUpdateInput {
  abbreviation?: string;
  description?: string | null;
  name?: string;
}

export interface FactionRobberyPolicyUpdateInput {
  global?: FactionRobberyPolicyMode;
  regions?: Partial<Record<RegionId, FactionRobberyPolicyMode>>;
}

export interface FactionMemberSummary {
  id: string;
  isLeader: boolean;
  isNpc: boolean;
  joinedAt: string;
  level: number | null;
  nickname: string;
  rank: FactionRank;
  vocation: VocationType | null;
}

export interface FactionListResponse {
  factions: FactionSummary[];
  playerFactionId: string | null;
}

export interface FactionMembersResponse {
  faction: FactionSummary;
  members: FactionMemberSummary[];
  playerFactionId: string | null;
}

export interface FactionMutationResponse {
  faction: FactionSummary;
  playerFactionId: string | null;
}

export interface FactionRobberyPolicyResponse {
  faction: FactionSummary;
  playerFactionId: string | null;
}

export interface FactionDissolveResponse {
  dissolvedFactionId: string;
  playerFactionId: null;
}

export interface FactionLeaveResponse {
  factionId: string;
  playerFactionId: null;
}

export interface FactionBankLedgerEntry {
  balanceAfter: number;
  commissionAmount: number;
  createdAt: string;
  description: string;
  entryType: FactionBankEntryType;
  grossAmount: number;
  id: string;
  netAmount: number;
  originType: FactionBankOriginType;
  playerId: string | null;
  playerNickname: string | null;
  propertyId: string | null;
}

export interface FactionBankPermissions {
  canDeposit: boolean;
  canView: boolean;
  canWithdraw: boolean;
}

export interface FactionBankResponse {
  faction: FactionSummary;
  ledger: FactionBankLedgerEntry[];
  permissions: FactionBankPermissions;
  playerFactionId: string;
}

export interface FactionBankDepositInput {
  amount: number;
  description?: string;
}

export interface FactionBankWithdrawInput {
  amount: number;
  description?: string;
}

export interface FactionUpgradeEffectsProfile {
  attributeBonusMultiplier: number;
  canAccessExclusiveArsenal: boolean;
  hasFortifiedHeadquarters: boolean;
  muleDeliveryTier: 0 | 1 | 2 | 3 | 4;
  soldierCapacityMultiplier: number;
}

export interface FactionUpgradeDefinitionSummary {
  effectSummary: string;
  label: string;
  pointsCost: number;
  prerequisiteUpgradeTypes: FactionUpgradeType[];
  type: FactionUpgradeType;
}

export interface FactionUpgradeSummary extends FactionUpgradeDefinitionSummary {
  canUnlock: boolean;
  isUnlocked: boolean;
  lockReason: string | null;
  unlockedAt: string | null;
}

export interface FactionUpgradeCenterResponse {
  availablePoints: number;
  effects: FactionUpgradeEffectsProfile;
  faction: FactionSummary;
  playerFactionId: string;
  upgrades: FactionUpgradeSummary[];
}

export interface FactionUpgradeUnlockResponse extends FactionUpgradeCenterResponse {
  unlockedUpgradeType: FactionUpgradeType;
}

export interface FactionLeaderSummary {
  id: string | null;
  isNpc: boolean;
  level: number | null;
  nickname: string;
  rank: FactionRank;
  vocation: VocationType | null;
}

export interface FactionLeadershipElectionCandidateSummary {
  level: number;
  nickname: string;
  playerId: string;
  rank: FactionRank;
  votes: number;
}

export interface FactionLeadershipElectionSummary {
  candidates: FactionLeadershipElectionCandidateSummary[];
  cooldownEndsAt: string | null;
  createdAt: string;
  endsAt: string | null;
  hasPlayerSupported: boolean;
  hasPlayerVoted: boolean;
  id: string;
  resolvedAt: string | null;
  startedAt: string | null;
  status: FactionLeadershipElectionStatus;
  supportCount: number;
  supportThreshold: number;
  totalVotes: number;
  winnerNickname: string | null;
  winnerPlayerId: string | null;
}

export interface FactionLeadershipChallengeResult {
  challengerConceitoDelta: number;
  challengerHpDelta: number;
  challengerNickname: string;
  challengerPlayerId: string;
  challengerPower: number;
  challengerWon: boolean;
  defenderConceitoDelta: number;
  defenderHpDelta: number;
  defenderNickname: string;
  defenderPlayerId: string | null;
  defenderPower: number;
  defenderWasNpc: boolean;
  resolvedAt: string;
  successChance: number;
}

export interface FactionLeadershipChallengeSummary {
  canChallenge: boolean;
  cooldownEndsAt: string | null;
  cooldownRemainingSeconds: number;
  lastResult: FactionLeadershipChallengeResult | null;
  lockReason: string | null;
  minimumLevel: number;
}

export interface FactionLeadershipCenterResponse {
  challenge: FactionLeadershipChallengeSummary;
  election: FactionLeadershipElectionSummary | null;
  faction: FactionSummary;
  leader: FactionLeaderSummary;
  playerFactionId: string;
}

export interface FactionLeadershipVoteInput {
  candidatePlayerId: string;
}

export interface FactionLeadershipElectionSupportResponse extends FactionLeadershipCenterResponse {
  triggeredElection: boolean;
}

export interface FactionLeadershipVoteResponse extends FactionLeadershipCenterResponse {
  electionResolved: boolean;
}

export interface FactionLeadershipChallengeResponse extends FactionLeadershipCenterResponse {
  result: FactionLeadershipChallengeResult;
}

export interface PlayerInventoryItem {
  equipSlot: InventoryEquipSlot | null;
  id: string;
  isEquipped: boolean;
  itemId: string | null;
  itemName: string | null;
  durability: number | null;
  maxDurability: number | null;
  itemType: InventoryItemType;
  levelRequired: number | null;
  proficiency: number;
  quantity: number;
  stackable: boolean;
  totalWeight: number;
  unitWeight: number;
}

export interface InventoryCapacity {
  availableSlots: number;
  availableWeight: number;
  currentWeight: number;
  maxSlots: number;
  maxWeight: number;
  usedSlots: number;
}

export interface PlayerPropertySummary {
  id: string;
  type: string;
  regionId: RegionId;
  favelaId: string | null;
  level: number;
  soldiersCount: number;
  createdAt: string;
}

export interface RoundSummary {
  currentGameDay: number;
  endsAt: string;
  id: string;
  number: number;
  remainingSeconds: number;
  startedAt: string;
  status: RoundStatus;
  totalGameDays: number;
}

export interface RoundLeaderboardEntry {
  conceito: number;
  factionAbbreviation: string | null;
  level: number;
  nickname: string;
  playerId: string;
  rank: number;
}

export interface RoundCenterResponse {
  leaderboard: RoundLeaderboardEntry[];
  round: RoundSummary;
  topTenCreditReward: number;
}

export interface HallOfFamePlayerEntry {
  conceito: number;
  nickname: string;
  playerId: string;
  rank: number;
}

export interface HallOfFameRoundEntry {
  endedAt: string;
  roundId: string;
  roundNumber: number;
  startedAt: string;
  topThree: HallOfFamePlayerEntry[];
  winnerConceito: number;
  winnerNickname: string;
  winnerPlayerId: string;
}

export interface HallOfFameResponse {
  rounds: HallOfFameRoundEntry[];
  totalFinishedRounds: number;
}

export interface PlayerHospitalizationStatus {
  endsAt: string | null;
  isHospitalized: boolean;
  reason: HospitalizationReason | null;
  remainingSeconds: number;
  startedAt: string | null;
  trigger: OverdoseTrigger | null;
}

export interface PlayerPrisonStatus {
  endsAt: string | null;
  heatScore: number;
  heatTier: PlayerPoliceHeatTier;
  isImprisoned: boolean;
  reason: string | null;
  remainingSeconds: number;
  sentencedAt: string | null;
}

export interface PlayerProfile extends PlayerSummary {
  appearance: CharacterAppearance;
  faction: PlayerFactionSummary | null;
  hasCharacter: boolean;
  hospitalization: PlayerHospitalizationStatus;
  inventory: PlayerInventoryItem[];
  location: PlayerLocation;
  prison: PlayerPrisonStatus;
  properties: PlayerPropertySummary[];
}

export interface PrisonActionAvailability {
  available: boolean;
  creditsCost: number | null;
  factionBankCost: number | null;
  moneyCost: number | null;
  reason: string | null;
  successChancePercent: number | null;
}

export interface PrisonCenterResponse {
  actions: {
    bail: PrisonActionAvailability;
    bribe: PrisonActionAvailability;
    escape: PrisonActionAvailability & {
      alreadyAttempted: boolean;
    };
    factionRescue: PrisonActionAvailability & {
      eligibleTarget: boolean;
    };
  };
  prison: PlayerPrisonStatus;
}

export type PrisonReleaseMethod = 'bail' | 'bribe' | 'escape' | 'faction_rescue';

export interface PrisonActionResponse {
  creditsRemaining: number | null;
  factionBankMoneyRemaining: number | null;
  message: string;
  method: PrisonReleaseMethod;
  moneyRemaining: number | null;
  prison: PlayerPrisonStatus;
  success: boolean;
}

export interface PlayerBankLedgerEntry {
  balanceAfter: number;
  createdAt: string;
  description: string;
  entryType: PlayerBankEntryType;
  feeAmount: number;
  grossAmount: number;
  id: string;
  netAmount: number;
}

export interface PlayerBankProtectionProfile {
  fromDeathLoss: boolean;
  fromPoliceSeizure: boolean;
  fromPvpLoot: boolean;
}

export interface PlayerBankCenterResponse {
  bankMoney: number;
  dailyDepositLimit: number;
  dailyInterestRatePercent: number;
  depositedToday: number;
  ledger: PlayerBankLedgerEntry[];
  pocketMoney: number;
  protection: PlayerBankProtectionProfile;
  remainingDepositLimit: number;
  syncedAt: string;
  withdrawFeeRatePercent: number;
}

export interface PlayerBankDepositInput {
  amount: number;
}

export interface PlayerBankWithdrawInput {
  amount: number;
}

export interface PlayerBankActionResponse {
  bank: PlayerBankCenterResponse;
  bankMoneyDelta: number;
  feePaid: number;
  interestApplied: number;
  message: string;
  pocketMoneyDelta: number;
}

export interface RobberyDefinitionSummary {
  baseCooldownSeconds: number;
  baseFactionCommissionRate: number;
  baseHeatDeltaRange: {
    max: number;
    min: number;
  };
  baseRewardRange: {
    max: number;
    min: number;
  };
  defaultBanditsCommitted: number;
  executorTypes: RobberyExecutorType[];
  id: RobberyType;
  label: string;
  maxBanditsCommitted: number;
  minimumLevel: number;
  riskLabel: 'alto' | 'baixo_medio' | 'medio' | 'medio_alto';
}

export interface VehicleRobberyRouteDefinitionSummary {
  baseFactionCommissionRate: number;
  baseHeatDeltaRange: {
    max: number;
    min: number;
  };
  baseRewardRange: {
    max: number;
    min: number;
  };
  description: string;
  id: VehicleRobberyRoute;
  label: string;
  riskLabel: 'alto' | 'baixo_medio' | 'medio' | 'medio_alto';
}

export interface RobberyCatalogBanditFavelaSummary {
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  id: string;
  name: string;
  nextReturnAt: string | null;
  regionId: RegionId;
}

export interface RobberyCatalogResponse {
  banditFavelas: RobberyCatalogBanditFavelaSummary[];
  factionRobberyPolicy: FactionRobberyPolicy | null;
  playerRegion: {
    densityIndex: number;
    name: string;
    policePressure: number;
    regionId: RegionId;
    wealthIndex: number;
  };
  robberies: RobberyDefinitionSummary[];
  vehicleRoutes: VehicleRobberyRouteDefinitionSummary[];
}

export interface RobberyAttemptInput {
  banditsCommitted?: number;
  executorType: RobberyExecutorType;
  favelaId?: string;
  vehicleRoute?: VehicleRobberyRoute;
}

export interface RobberyBanditImpactSummary {
  activeAfter: number;
  arrestedAfter: number;
  arrestedNow: number;
  committed: number;
  deadRecentAfter: number;
  killedNow: number;
  nextReturnAt: string | null;
  returnBatchesCreated: number;
}

export interface RobberyPlayerImpactSummary {
  heatAfter: number;
  heatBefore: number;
  heatDelta: number;
  heatTierAfter: PlayerPoliceHeatTier;
  heatTierBefore: PlayerPoliceHeatTier;
  hospitalization: PlayerHospitalizationStatus;
  hpAfter: number;
  hpBefore: number;
  hpDelta: number;
  moneyAfter: number;
  moneyBefore: number;
  moneyDelta: number;
  nerveAfter: number;
  nerveBefore: number;
  nerveDelta: number;
  prison: PlayerPrisonStatus;
  staminaAfter: number;
  staminaBefore: number;
  staminaDelta: number;
}

export interface RobberyAttemptResponse {
  bandits: RobberyBanditImpactSummary | null;
  executorType: RobberyExecutorType;
  factionCommissionAmount: number;
  factionCommissionRatePercent: number;
  grossAmount: number;
  message: string;
  netAmount: number;
  outcome: RobberyFailureOutcome | 'success';
  player: RobberyPlayerImpactSummary | null;
  policyDisplacedFromRegionId: RegionId | null;
  regionId: RegionId;
  regionName: string;
  regionPolicePressureAfter: number;
  regionPolicePressureBefore: number;
  regionPolicePressureDelta: number;
  robberyType: RobberyType;
  success: boolean;
  vehicleRoute: VehicleRobberyRoute | null;
}

export interface AuthPlayerIdentity {
  id: string;
  nickname: string;
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  player: AuthPlayerIdentity;
  refreshExpiresIn: number;
  refreshToken: string;
}

export interface AuthLoginInput {
  email: string;
  password: string;
}

export interface AuthRegisterInput {
  email: string;
  nickname: string;
  password: string;
}

export interface AuthRefreshInput {
  refreshToken: string;
}

export interface ApiErrorResponse {
  message: string;
}

export interface PlayerCreationInput {
  vocation: VocationType;
  appearance: CharacterAppearance;
}

export interface PlayerTravelInput {
  regionId: RegionId;
}

export interface InventoryGrantInput {
  itemId: string;
  itemType: InventoryItemType;
  quantity: number;
}

export interface InventoryListResponse {
  capacity: InventoryCapacity;
  items: PlayerInventoryItem[];
}

export interface InventoryQuantityUpdateInput {
  quantity: number;
}

export interface InventoryRepairResponse extends InventoryListResponse {
  repairCost: number;
  repairedItem: PlayerInventoryItem;
}

export interface HospitalServiceAvailability {
  available: boolean;
  creditsCost: number | null;
  moneyCost: number | null;
  reason: string | null;
}

export interface HospitalStatItemOffer {
  available: boolean;
  costMoney: number;
  description: string;
  itemCode: HospitalStatItemCode;
  label: string;
  limitPerCycle: number;
  purchasesInCurrentCycle: number;
  reason: string | null;
  remainingInCurrentCycle: number;
}

export interface HospitalCenterPlayerState {
  addiction: number;
  appearance: CharacterAppearance;
  credits: number;
  dstRecoversAt: string | null;
  hasDst: boolean;
  healthPlanActive: boolean;
  healthPlanCycleKey: string | null;
  hp: number;
  money: number;
  nickname: string;
}

export interface HospitalCenterResponse {
  currentCycleKey: string;
  hospitalization: PlayerHospitalizationStatus;
  player: HospitalCenterPlayerState;
  services: {
    detox: HospitalServiceAvailability;
    dstTreatment: HospitalServiceAvailability;
    healthPlan: HospitalServiceAvailability;
    surgery: HospitalServiceAvailability;
    treatment: HospitalServiceAvailability;
  };
  statItems: HospitalStatItemOffer[];
}

export interface HospitalSurgeryInput {
  appearance?: CharacterAppearance;
  nickname?: string;
}

export interface HospitalStatPurchaseInput {
  itemCode: HospitalStatItemCode;
}

export type HospitalActionType =
  | 'detox'
  | 'dst_treatment'
  | 'health_plan'
  | 'stat_item'
  | 'surgery'
  | 'treatment';

export interface HospitalActionResponse extends HospitalCenterResponse {
  action: HospitalActionType;
  message: string;
  purchasedItemCode: HospitalStatItemCode | null;
}

export interface TrainingDefinitionSummary {
  durationMinutes: number;
  label: string;
  minimumBasicSessionsCompleted: number;
  moneyCost: number;
  rewardMultiplier: number;
  staminaCost: number;
  type: TrainingType;
  unlockLevel: number;
}

export interface TrainingSessionSummary {
  claimedAt: string | null;
  costMoney: number;
  costStamina: number;
  diminishingMultiplier: number;
  endsAt: string;
  id: string;
  progressRatio: number;
  projectedGains: PlayerAttributes;
  readyToClaim: boolean;
  remainingSeconds: number;
  startedAt: string;
  streakIndex: number;
  type: TrainingType;
}

export interface TrainingCatalogItem extends TrainingDefinitionSummary {
  basicSessionsCompleted: number;
  isLocked: boolean;
  isRunnable: boolean;
  lockReason: string | null;
  nextDiminishingMultiplier: number;
  projectedGains: PlayerAttributes;
}

export interface TrainingCenterResponse {
  activeSession: TrainingSessionSummary | null;
  catalog: TrainingCatalogItem[];
  completedBasicSessions: number;
  nextDiminishingMultiplier: number;
  player: PlayerSummary;
}

export interface TrainingStartInput {
  type: TrainingType;
}

export interface TrainingStartResponse {
  player: PlayerSummary;
  session: TrainingSessionSummary;
}

export interface TrainingClaimResponse {
  appliedGains: PlayerAttributes;
  player: PlayerSummary;
  session: TrainingSessionSummary;
}

export interface UniversityPassiveProfile {
  business: {
    bocaDemandMultiplier: number;
    gpRevenueMultiplier: number;
    launderingReturnMultiplier: number;
    passiveRevenueMultiplier: number;
    propertyMaintenanceMultiplier: number;
  };
  crime: {
    arrestChanceMultiplier: number;
    lowLevelSoloRewardMultiplier: number;
    revealsTargetValue: boolean;
    soloSuccessMultiplier: number;
  };
  factory: {
    extraDrugSlots: number;
    productionMultiplier: number;
  };
  faction: {
    factionCharismaAura: number;
  };
  market: {
    feeRate: number;
  };
  police: {
    bribeCostMultiplier: number;
    negotiationSuccessMultiplier: number;
  };
  pvp: {
    ambushPowerMultiplier: number;
    assaultPowerMultiplier: number;
    damageDealtMultiplier: number;
    lowHpDamageTakenMultiplier: number;
  };
  social: {
    communityInfluenceMultiplier: number;
  };
}

export interface UniversityCourseDefinitionSummary {
  attributeRequirements: Partial<PlayerAttributes>;
  code: UniversityCourseCode;
  durationHours: number;
  effectSummary: string;
  label: string;
  moneyCost: number;
  prerequisiteCourseCodes: UniversityCourseCode[];
  unlockLevel: number;
  vocation: VocationType;
}

export interface UniversityCourseSummary extends UniversityCourseDefinitionSummary {
  completedAt: string | null;
  endsAt: string | null;
  isCompleted: boolean;
  isInProgress: boolean;
  isLocked: boolean;
  isUnlocked: boolean;
  lockReason: string | null;
  startedAt: string | null;
}

export interface UniversityCenterResponse {
  activeCourse: UniversityCourseSummary | null;
  completedCourseCodes: UniversityCourseCode[];
  courses: UniversityCourseSummary[];
  passiveProfile: UniversityPassiveProfile;
  player: PlayerSummary;
}

export interface UniversityEnrollInput {
  courseCode: UniversityCourseCode;
}

export interface UniversityEnrollResponse {
  course: UniversityCourseSummary;
  player: PlayerSummary;
}

export interface DrugToleranceSummary {
  current: number;
  decayedBy: number;
  drugId: string;
  effectiveTolerance: number;
  effectivenessMultiplier: number;
  increasedBy: number;
}

export interface DrugConsumeEffectSummary {
  addictionGained: number;
  moraleRecovered: number;
  nerveRecovered: number;
  staminaRecovered: number;
}

export interface DrugOverdoseSummary {
  hospitalization: PlayerHospitalizationStatus;
  knownContactsLost: number;
  penalties: {
    addictionResetTo: number;
    conceitoLost: number;
    moraleResetTo: number;
  };
  recentDrugTypes: DrugType[];
  trigger: OverdoseTrigger;
}

export interface DrugConsumeResponse {
  consumedInventoryItemId: string;
  drug: {
    code: string;
    id: string;
    name: string;
    remainingQuantity: number;
    type: DrugType;
  };
  effects: DrugConsumeEffectSummary;
  overdose: DrugOverdoseSummary | null;
  player: PlayerProfile;
  tolerance: DrugToleranceSummary;
}

export interface MarketOrderSummary {
  createdAt: string;
  expiresAt: string;
  id: string;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  playerId: string;
  pricePerUnit: number;
  quantity: number;
  remainingQuantity: number;
  side: MarketOrderSide;
  sourceLabel?: string | null;
  sourceType?: 'player' | 'system';
  status: MarketOrderStatus;
  systemOfferId?: string | null;
}

export interface MarketTradeSummary {
  buyerId: string;
  feeTotal: number;
  grossTotal: number;
  itemId: string;
  itemName: string;
  itemType: InventoryItemType;
  pricePerUnit: number;
  quantity: number;
  sellerId: string;
  sellerNetTotal: number;
}

export interface MarketOrderCreateInput {
  inventoryItemId?: string | null;
  itemId: string;
  itemType: InventoryItemType;
  pricePerUnit: number;
  quantity: number;
  side: MarketOrderSide;
  systemOfferId?: string | null;
}

export interface MarketOrderBookResponse {
  buyOrders: MarketOrderSummary[];
  marketFeeRate: number;
  myOrders: MarketOrderSummary[];
  sellOrders: MarketOrderSummary[];
}

export interface MarketOrderMutationResponse {
  feeTotal: number;
  matchedTrades: MarketTradeSummary[];
  order: MarketOrderSummary;
  refundedAmount: number;
  returnedQuantity: number;
}

export interface MarketAuctionSummary {
  buyoutPrice: number | null;
  createdAt: string;
  currentBid: number | null;
  endsAt: string;
  id: string;
  itemId: string;
  itemName: string;
  itemType: 'weapon' | 'vest';
  leadingBidderId: string | null;
  minNextBid: number;
  playerId: string;
  quantity: number;
  startingBid: number;
  status: MarketAuctionStatus;
}

export interface MarketAuctionNotification {
  auctionId: string;
  createdAt: string;
  id: string;
  message: string;
  title: string;
  type: MarketAuctionNotificationType;
}

export interface MarketAuctionSettlementSummary {
  feeTotal: number;
  grossTotal: number;
  returnedToSeller: boolean;
  sellerNetTotal: number;
  winnerPlayerId: string | null;
}

export interface MarketAuctionCreateInput {
  buyoutPrice?: number | null;
  durationMinutes: number;
  inventoryItemId: string;
  itemId: string;
  itemType: 'weapon' | 'vest';
  startingBid: number;
}

export interface MarketAuctionBidInput {
  amount: number;
}

export interface MarketAuctionBookResponse {
  auctions: MarketAuctionSummary[];
  marketFeeRate: number;
  myAuctions: MarketAuctionSummary[];
  notifications: MarketAuctionNotification[];
}

export interface MarketAuctionMutationResponse {
  auction: MarketAuctionSummary;
  notifications: MarketAuctionNotification[];
  settlement: MarketAuctionSettlementSummary | null;
}

export interface CrimeDefinition {
  id: string;
  name: string;
  type: CrimeType;
  levelRequired: number;
  staminaCost: number;
  nerveCost: number;
  minPower: number;
  rewardMin: number;
  rewardMax: number;
  conceitoReward: number;
  arrestChance: number;
}

export interface CrimeCatalogItem extends CrimeDefinition {
  cooldownRemainingSeconds: number;
  estimatedSuccessChance: number;
  isLocked: boolean;
  isOnCooldown: boolean;
  isRunnable: boolean;
  lockReason: string | null;
  playerPower: number;
}

export interface CrimeCatalogResponse {
  crimes: CrimeCatalogItem[];
}

export interface CrimeAttemptDrop {
  itemId: string;
  itemName: string;
  itemType: 'drug';
  quantity: number;
}

export interface CrimeAttemptResponse {
  arrestChance: number;
  arrested: boolean;
  chance: number;
  crimeId: string;
  crimeName: string;
  cooldownRemainingSeconds: number;
  conceitoDelta: number;
  drop: CrimeAttemptDrop | null;
  heatAfter: number;
  heatBefore: number;
  hpDelta: number;
  leveledUp: boolean;
  level: number;
  message: string;
  moneyDelta: number;
  nextConceitoRequired: number | null;
  nextLevel: number | null;
  nerveSpent: number;
  playerPower: number;
  resources: Pick<PlayerResources, 'addiction' | 'conceito' | 'hp' | 'money' | 'nerve' | 'stamina'>;
  staminaSpent: number;
  success: boolean;
}

export interface FactionCrimeCrewMemberSummary {
  id: string;
  isCoordinatorEligible: boolean;
  level: number;
  lockReason: string | null;
  nickname: string;
  playerPower: number;
  rank: FactionRank;
  resources: Pick<PlayerResources, 'hp' | 'nerve' | 'stamina'>;
}

export interface FactionCrimeCatalogItem extends CrimeDefinition {
  cooldownRemainingSeconds: number;
  isLocked: boolean;
  isOnCooldown: boolean;
  isRunnable: boolean;
  lockReason: string | null;
  maximumCrewSize: number;
  minimumCrewSize: number;
}

export interface FactionCrimeCatalogResponse {
  coordinatorCanStart: boolean;
  crimes: FactionCrimeCatalogItem[];
  factionId: string;
  members: FactionCrimeCrewMemberSummary[];
  playerFactionId: string | null;
}

export interface FactionCrimeAttemptInput {
  participantIds: string[];
}

export interface FactionCrimeParticipantOutcome {
  conceitoDelta: number;
  hpDelta: number;
  id: string;
  level: number;
  leveledUp: boolean;
  moneyDelta: number;
  nerveSpent: number;
  nickname: string;
  playerPower: number;
  rank: FactionRank;
  resources: Pick<PlayerResources, 'conceito' | 'hp' | 'money' | 'nerve' | 'stamina'>;
  staminaSpent: number;
}

export interface FactionCrimeAttemptResponse {
  busted: boolean;
  bustedChance: number;
  chance: number;
  combinedPower: number;
  conceitoRewardPerParticipant: number;
  cooldownRemainingSeconds: number;
  coordinationMultiplier: number;
  crimeId: string;
  crimeName: string;
  factionId: string;
  message: string;
  minimumPowerRequired: number;
  participantCount: number;
  participants: FactionCrimeParticipantOutcome[];
  rewardTotal: number;
  success: boolean;
}

export type PvpCombatTier =
  | 'clear_victory'
  | 'hard_fail'
  | 'narrow_victory'
  | 'total_takedown';

export type PvpHospitalizationSeverity = 'heavy' | 'light' | 'none' | 'standard';

export interface PvpCombatHospitalizationSummary {
  durationMinutes: number;
  recommended: boolean;
  severity: PvpHospitalizationSeverity;
}

export interface PvpCombatLootSummary {
  amount: number;
  percentage: number;
}

export interface PvpCombatAttributeStealSummary {
  amount: number;
  attribute: keyof Pick<PlayerAttributes, 'carisma' | 'forca' | 'inteligencia' | 'resistencia'>;
  percentage: number;
}

export interface PvpCombatFatalitySummary {
  chance: number;
  defenderDied: boolean;
  eligible: boolean;
}

export interface PvpCombatSideOutcomeSummary {
  conceitoDelta?: number;
  heatAfter?: number;
  heatBefore?: number;
  heatDelta?: number;
  hospitalization: PvpCombatHospitalizationSummary;
  hpAfter: number;
  hpBefore: number;
  hpDelta: number;
  id: string;
  moneyAfter?: number;
  moneyBefore?: number;
  moneyDelta?: number;
  nickname: string;
  prisonFollowUpChance?: number;
  staminaAfter?: number;
  staminaBefore?: number;
  staminaDelta?: number;
}

export interface PvpAssaultResponse {
  attacker: PvpCombatSideOutcomeSummary;
  attributeSteal: PvpCombatAttributeStealSummary | null;
  defender: PvpCombatSideOutcomeSummary;
  fatality: PvpCombatFatalitySummary;
  loot: PvpCombatLootSummary | null;
  message: string;
  mode: 'assault';
  powerRatio: number;
  success: boolean;
  targetCooldownSeconds: number;
  tier: PvpCombatTier;
}

export interface PvpAmbushParticipantOutcomeSummary {
  conceitoAfter: number;
  conceitoBefore: number;
  conceitoDelta: number;
  heatAfter: number;
  heatBefore: number;
  heatDelta: number;
  hospitalization: PvpCombatHospitalizationSummary;
  hpAfter: number;
  hpBefore: number;
  hpDelta: number;
  id: string;
  isInitiator: boolean;
  moneyAfter: number;
  moneyBefore: number;
  moneyDelta: number;
  nickname: string;
  power: number;
  powerSharePercent: number;
  rank: FactionRank;
  staminaAfter: number;
  staminaBefore: number;
  staminaDelta: number;
}

export interface PvpAmbushResponse {
  attackers: PvpAmbushParticipantOutcomeSummary[];
  coordinationMultiplier: number;
  defender: PvpCombatSideOutcomeSummary;
  fatality: PvpCombatFatalitySummary;
  groupPower: number;
  loot: PvpCombatLootSummary | null;
  message: string;
  mode: 'ambush';
  powerRatio: number;
  success: boolean;
  targetCooldownSeconds: number;
  tier: PvpCombatTier;
}

export type AssassinationContractStatus =
  | 'accepted'
  | 'cancelled'
  | 'completed'
  | 'expired'
  | 'failed'
  | 'open';

export type AssassinationContractNotificationType =
  | 'accepted'
  | 'completed'
  | 'expired'
  | 'target_warned';

export interface AssassinationContractSummary {
  acceptedAt: string | null;
  acceptedBy: string | null;
  acceptedByNickname: string | null;
  canAccept: boolean;
  createdAt: string;
  expiresAt: string;
  fee: number;
  id: string;
  isTarget: boolean;
  requesterId: string;
  requesterNickname: string;
  reward: number;
  status: AssassinationContractStatus;
  targetId: string;
  targetNickname: string;
  totalCost: number;
}

export interface AssassinationContractNotification {
  contractId: string;
  createdAt: string;
  id: string;
  message: string;
  title: string;
  type: AssassinationContractNotificationType;
}

export interface PvpAssassinationContractsResponse {
  acceptedContracts: AssassinationContractSummary[];
  availableContracts: AssassinationContractSummary[];
  notifications: AssassinationContractNotification[];
  requestedContracts: AssassinationContractSummary[];
}

export interface PvpContractCreateResponse {
  contract: AssassinationContractSummary;
}

export interface PvpContractAcceptResponse {
  contract: AssassinationContractSummary;
}

export interface PvpContractExecutionResponse {
  assassin: PvpCombatSideOutcomeSummary;
  contract: AssassinationContractSummary;
  defender: PvpCombatSideOutcomeSummary;
  fatality: PvpCombatFatalitySummary;
  loot: PvpCombatLootSummary | null;
  message: string;
  mode: 'contract';
  powerRatio: number;
  success: boolean;
  targetNotified: boolean;
  tier: PvpCombatTier;
}

export interface Faction {
  id: string;
  name: string;
  abbreviation: string;
  isFixed: boolean;
  regionBonuses: Partial<Record<RegionId, number>>;
}

export interface Favela {
  id: string;
  name: string;
  regionId: RegionId;
  population: number;
  difficulty: number;
  satisfaction: number;
}

export interface FavelaFactionSummary {
  abbreviation: string;
  id: string;
  name: string;
}

export type FavelaSatisfactionTier =
  | 'happy'
  | 'stable'
  | 'restless'
  | 'critical'
  | 'collapsed';

export type FavelaSatisfactionFactorCode =
  | 'services'
  | 'security'
  | 'peace'
  | 'war'
  | 'police_pressure'
  | 'state_control'
  | 'baile';

export interface FavelaSatisfactionFactorSummary {
  code: FavelaSatisfactionFactorCode;
  dailyDelta: number;
  label: string;
}

export interface FavelaSatisfactionProfile {
  dailyDeltaEstimate: number;
  dailyX9RiskPercent: number;
  factors: FavelaSatisfactionFactorSummary[];
  populationPressurePercentPerDay: number;
  revenueMultiplier: number;
  tier: FavelaSatisfactionTier;
}

export interface FavelaSoldierForceSummary {
  active: number;
  max: number;
  occupancyPercent: number;
}

export interface FavelaBanditForceSummary {
  active: number;
  arrested: number;
  deadRecent: number;
  nextReturnAt: string | null;
  scheduledReturnBatches: number;
  syncedAt: string;
  targetActive: number;
}

export interface TerritoryFavelaSummary {
  bandits: FavelaBanditForceSummary;
  code: string;
  contestingFaction: FavelaFactionSummary | null;
  controllingFaction: FavelaFactionSummary | null;
  difficulty: number;
  id: string;
  name: string;
  population: number;
  propina: FavelaPropinaSummary | null;
  propinaValue: number;
  regionId: RegionId;
  satisfaction: number;
  satisfactionProfile: FavelaSatisfactionProfile;
  soldiers: FavelaSoldierForceSummary;
  stabilizationEndsAt: string | null;
  state: FavelaControlState;
  stateControlledUntil: string | null;
  war: FactionWarSummary | null;
  warDeclaredAt: string | null;
  x9: FavelaX9Summary | null;
}

export interface FavelaServiceDefinitionSummary {
  baseDailyRevenuePerResident: number;
  installCost: number;
  label: string;
  maxLevel: number;
  satisfactionGainOnUpgrade: number;
  type: FavelaServiceType;
  upgradeRevenueStepMultiplier: number;
}

export interface FavelaServiceRevenueBreakdown {
  factionBonusMultiplier: number;
  propinaPenaltyMultiplier: number;
  regionalMultiplier: number;
  satisfactionMultiplier: number;
  stabilizationMultiplier: number;
  territoryDominationMultiplier: number;
  totalMultiplier: number;
}

export type FavelaPropinaStatus = 'scheduled' | 'warning' | 'severe' | 'state_takeover';
export type FactionWarStatus =
  | 'declared'
  | 'preparing'
  | 'active'
  | 'attacker_won'
  | 'defender_won'
  | 'draw'
  | 'cancelled';
export type FactionWarSide = 'attacker' | 'defender';
export type FactionWarRoundOutcome = 'attacker' | 'defender' | 'draw';

export interface FavelaPropinaSummary {
  baseAmount: number;
  canNegotiate: boolean;
  currentAmount: number;
  daysOverdue: number;
  discountRate: number;
  dueAt: string | null;
  lastPaidAt: string | null;
  negotiatedAt: string | null;
  negotiatedByPlayerId: string | null;
  revenuePenaltyMultiplier: number;
  status: FavelaPropinaStatus;
}

export interface FactionWarPreparationSummary {
  budget: number;
  powerBonus: number;
  preparedAt: string;
  preparedByPlayerId: string;
  regionPresenceCount: number;
  side: FactionWarSide;
  soldierCommitment: number;
}

export interface FactionWarRoundSummary {
  attackerHpLoss: number;
  attackerNerveLoss: number;
  attackerPower: number;
  attackerStaminaLoss: number;
  defenderHpLoss: number;
  defenderNerveLoss: number;
  defenderPower: number;
  defenderStaminaLoss: number;
  message: string;
  outcome: FactionWarRoundOutcome;
  resolvedAt: string;
  roundNumber: number;
}

export interface FactionWarSummary {
  attackerFaction: FavelaFactionSummary;
  attackerPreparation: FactionWarPreparationSummary | null;
  attackerScore: number;
  cooldownEndsAt: string | null;
  declaredAt: string;
  declaredByPlayerId: string | null;
  defenderFaction: FavelaFactionSummary;
  defenderPreparation: FactionWarPreparationSummary | null;
  defenderScore: number;
  endedAt: string | null;
  favelaId: string;
  id: string;
  lootMoney: number;
  nextRoundAt: string | null;
  preparationEndsAt: string | null;
  rounds: FactionWarRoundSummary[];
  roundsResolved: number;
  roundsTotal: number;
  startsAt: string | null;
  status: FactionWarStatus;
  winnerFactionId: string | null;
}

export type FavelaX9Status = 'warning' | 'pending_desenrolo' | 'jailed' | 'resolved';

export interface FavelaX9Summary {
  canAttemptDesenrolo: boolean;
  currentRiskPercent: number;
  desenroloAttemptedAt: string | null;
  desenroloBaseMoneyCost: number | null;
  desenroloBasePointsCost: number | null;
  desenroloMoneySpent: number;
  desenroloPointsSpent: number;
  desenroloSucceeded: boolean | null;
  drugsLost: number;
  id: string;
  incursionAt: string | null;
  moneyLost: number;
  pendingSoldiersReturn: number;
  resolvedAt: string | null;
  soldiersArrested: number;
  soldiersReleaseAt: string | null;
  status: FavelaX9Status;
  triggeredAt: string;
  warningEndsAt: string | null;
  weaponsLost: number;
}

export interface FavelaServiceSummary {
  active: boolean;
  currentDailyRevenue: number;
  definition: FavelaServiceDefinitionSummary;
  grossRevenueTotal: number;
  id: string | null;
  installed: boolean;
  installedAt: string | null;
  isUpgradeable: boolean;
  lastRevenueAt: string | null;
  level: number;
  lockReason: string | null;
  nextUpgradeCost: number | null;
  revenueBreakdown: FavelaServiceRevenueBreakdown;
}

export interface TerritoryRegionSummary {
  atWarFavelas: number;
  controlledFavelas: number;
  dominantFaction: FavelaFactionSummary | null;
  neutralFavelas: number;
  playerFactionControlledFavelas: number;
  regionId: RegionId;
  stateControlledFavelas: number;
  totalFavelas: number;
}

export interface TerritoryOverviewResponse {
  favelas: TerritoryFavelaSummary[];
  playerFactionId: string | null;
  regions: TerritoryRegionSummary[];
}

export interface FavelaStateTransitionInput {
  action: FavelaStateTransitionAction;
}

export interface FavelaStateTransitionResponse extends TerritoryOverviewResponse {
  favela: TerritoryFavelaSummary;
}

export interface FavelaConquestInput {
  participantIds?: string[];
}

export interface TerritoryBossSummary {
  difficulty: number;
  label: string;
  power: number;
}

export interface TerritoryConquestParticipantOutcome {
  conceitoDelta: number;
  hpDelta: number;
  id: string;
  level: number;
  leveledUp: boolean;
  nickname: string;
  playerPower: number;
  rank: FactionRank;
  regionId: RegionId;
  resources: Pick<PlayerResources, 'conceito' | 'hp' | 'nerve' | 'stamina'>;
  nerveSpent: number;
  staminaSpent: number;
}

export interface FavelaConquestResponse extends TerritoryOverviewResponse {
  boss: TerritoryBossSummary;
  chance: number;
  combinedPower: number;
  coordinationMultiplier: number;
  favela: TerritoryFavelaSummary;
  message: string;
  minimumPowerRequired: number;
  participantCount: number;
  participants: TerritoryConquestParticipantOutcome[];
  success: boolean;
}

export interface FavelaServicesResponse {
  canManage: boolean;
  factionBankMoney: number | null;
  favela: TerritoryFavelaSummary;
  playerFactionId: string | null;
  services: FavelaServiceSummary[];
}

export interface FavelaServiceInstallInput {
  serviceType: FavelaServiceType;
}

export interface FavelaServiceMutationResponse extends FavelaServicesResponse {
  service: FavelaServiceSummary;
}

export interface FavelaX9DesenroloResponse extends TerritoryOverviewResponse {
  attemptedAt: string;
  discountMultiplier: number;
  event: FavelaX9Summary;
  favela: TerritoryFavelaSummary;
  message: string;
  moneySpent: number;
  pointsSpent: number;
  releaseAt: string | null;
  success: boolean;
  successChance: number;
}

export interface FavelaPropinaNegotiationResponse extends TerritoryOverviewResponse {
  discountRate: number;
  favela: TerritoryFavelaSummary;
  message: string;
  propina: FavelaPropinaSummary;
  success: boolean;
  successChance: number;
}

export type FavelaBaileMcTier = 'local' | 'regional' | 'estelar';
export type FavelaBaileResultTier = 'total_success' | 'success' | 'mixed' | 'failure';
export type FavelaBaileStatus = 'ready' | 'active' | 'hangover' | 'cooldown';

export interface FavelaBaileSummary {
  activeEndsAt: string | null;
  budget: number | null;
  cooldownEndsAt: string | null;
  entryPrice: number | null;
  factionPointsDelta: number | null;
  hangoverEndsAt: string | null;
  incidentCode: string | null;
  lastOrganizedAt: string | null;
  mcTier: FavelaBaileMcTier | null;
  resultTier: FavelaBaileResultTier | null;
  satisfactionDelta: number | null;
  staminaBoostPercent: number | null;
  status: FavelaBaileStatus;
}

export interface FavelaBaileStatusResponse extends TerritoryOverviewResponse {
  baile: FavelaBaileSummary;
  favela: TerritoryFavelaSummary;
}

export interface FavelaBaileOrganizeInput {
  budget: number;
  entryPrice: number;
  mcTier: FavelaBaileMcTier;
}

export interface FavelaBaileOrganizeResponse extends FavelaBaileStatusResponse {
  message: string;
}

export interface FactionWarStatusResponse extends TerritoryOverviewResponse {
  favela: TerritoryFavelaSummary;
  war: FactionWarSummary | null;
}

export interface FactionWarDeclareResponse extends FactionWarStatusResponse {
  message: string;
}

export interface FactionWarPrepareInput {
  budget: number;
  soldierCommitment: number;
}

export interface FactionWarPrepareResponse extends FactionWarStatusResponse {
  message: string;
  side: FactionWarSide;
}

export interface FactionWarRoundResponse extends FactionWarStatusResponse {
  message: string;
  round: FactionWarRoundSummary | null;
}

export interface TribunalCaseDefinitionSummary {
  allowedPunishments: TribunalPunishment[];
  label: string;
  severity: TribunalCaseSeverity;
  type: TribunalCaseType;
}

export interface TribunalCaseParticipantSummary {
  charismaCommunity: number;
  charismaFaction: number;
  name: string;
  statement: string;
}

export type TribunalPunishmentRead =
  | 'brutal'
  | 'condena_inocente'
  | 'dureza_arriscada'
  | 'leve_demais'
  | 'proporcional'
  | 'prudente';

export interface TribunalPunishmentInsightSummary {
  faccaoImpact: number;
  moradoresImpact: number;
  note: string;
  punishment: TribunalPunishment;
  read: TribunalPunishmentRead;
  recommended: boolean;
}

export interface TribunalAntigaoAdviceSummary {
  balanceWarning: string;
  communityRead: TribunalCaseSide;
  punishmentInsights: TribunalPunishmentInsightSummary[];
  truthRead: TribunalCaseSide;
}

export interface TribunalFavelaSummary {
  id: string;
  name: string;
  regionId: RegionId;
}

export interface TribunalCaseSummary {
  accused: TribunalCaseParticipantSummary;
  accuser: TribunalCaseParticipantSummary;
  antigaoAdvice: TribunalAntigaoAdviceSummary;
  antigaoHint: string;
  antigaoSuggestedPunishment: TribunalPunishment;
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  createdAt: string;
  definition: TribunalCaseDefinitionSummary;
  favelaId: string;
  id: string;
  judgedAt: string | null;
  punishmentChosen: TribunalPunishment | null;
  summary: string;
  truthRead: TribunalCaseSide;
}

export interface TribunalCenterResponse {
  activeCase: TribunalCaseSummary | null;
  favela: TribunalFavelaSummary;
  player: PlayerSummary;
}

export interface TribunalCaseGenerateResponse extends TribunalCenterResponse {
  created: boolean;
}

export interface TribunalJudgmentInput {
  punishment: TribunalPunishment;
}

export type TribunalJudgmentRead =
  | 'arriscada'
  | 'brutal_desnecessaria'
  | 'covarde'
  | 'injusta'
  | 'justa';

export interface TribunalJudgmentSummary {
  conceitoAfter: number;
  conceitoDelta: number;
  faccaoImpact: number;
  factionInternalSatisfactionAfter: number;
  factionInternalSatisfactionDelta: number;
  favelaSatisfactionAfter: number;
  favelaSatisfactionDelta: number;
  moradoresImpact: number;
  punishmentChosen: TribunalPunishment;
  read: TribunalJudgmentRead;
  summary: string;
}

export interface TribunalJudgmentResponse extends TribunalCenterResponse {
  activeCase: TribunalCaseSummary;
  judgment: TribunalJudgmentSummary;
}

export interface ItemDefinition {
  id: string;
  name: string;
  levelRequired: number;
  basePrice: number;
}

export interface WeaponDefinition extends ItemDefinition {
  power: number;
  durability: number;
}

export interface DrugDefinition extends ItemDefinition {
  type: DrugType;
  staminaRecovery: number;
  moraleBoost: number;
  addictionRate: number;
  nerveBoost: number;
}

export interface ComponentDefinition extends ItemDefinition {
  weight: number;
}

export interface PropertyDefinitionSummary {
  assetClass: PropertyAssetClass;
  baseDailyMaintenanceCost: number;
  basePrice: number;
  baseProtectionScore: number;
  factionCommissionRate: number;
  label: string;
  maxLevel: number;
  prestigeScore: number;
  profitable: boolean;
  purchaseMode: 'direct' | 'specialized';
  soldierCapacity: number;
  type: PropertyType;
  unlockLevel: number;
  utility: {
    inventorySlotsBonus: number;
    inventoryWeightBonus: number;
    staminaRecoveryPerHourBonus: number;
    travelMode: PropertyTravelMode | null;
  };
}

export interface SoldierTemplateSummary {
  dailyCost: number;
  label: string;
  power: number;
  type: SoldierType;
  unlockLevel: number;
}

export interface OwnedPropertySummary {
  createdAt: string;
  definition: PropertyDefinitionSummary;
  economics: {
    effectiveFactionCommissionRate: number;
    effectivePrestigeScore: number;
    profitable: boolean;
    totalDailyUpkeep: number;
  };
  favelaId: string | null;
  id: string;
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  protection: {
    defenseScore: number;
    factionProtectionActive: boolean;
    robberyRisk: number;
    soldiersPower: number;
    territoryControlRatio: number;
    territoryTier: 'none' | 'partial' | 'strong' | 'dominant' | 'absolute';
    takeoverRisk: number;
    invasionRisk: number;
  };
  regionId: RegionId;
  soldierRoster: Array<{
    count: number;
    dailyCost: number;
    label: string;
    totalPower: number;
    type: SoldierType;
  }>;
  soldiersCount: number;
  status: 'active' | 'maintenance_blocked';
  type: PropertyType;
}

export interface PropertyCatalogResponse {
  availableProperties: PropertyDefinitionSummary[];
  ownedProperties: OwnedPropertySummary[];
  soldierTemplates: SoldierTemplateSummary[];
}

export interface PropertyPurchaseInput {
  favelaId?: string | null;
  regionId: RegionId;
  type: PropertyType;
}

export interface PropertyPurchaseResponse {
  property: OwnedPropertySummary;
  purchaseCost: number;
}

export interface PropertyUpgradeResponse {
  property: OwnedPropertySummary;
  upgradeCost: number;
}

export interface PropertyHireSoldiersInput {
  quantity: number;
  type: SoldierType;
}

export interface PropertyHireSoldiersResponse {
  hiredQuantity: number;
  property: OwnedPropertySummary;
  soldierType: SoldierType;
  totalDailyCostAdded: number;
}

export interface BocaStockItemSummary {
  baseUnitPrice: number;
  code: string;
  drugId: string;
  drugName: string;
  estimatedQuantityPerCycle: number;
  estimatedUnitPrice: number;
  quantity: number;
}

export interface BocaSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastSaleAt: string;
    totalFactionCommission: number;
  };
  economics: {
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    locationMultiplier: number;
    npcDemandPerCycle: number;
    profitable: boolean;
  };
  favelaId: string | null;
  id: string;
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  status: 'active' | 'maintenance_blocked' | 'out_of_stock';
  stock: BocaStockItemSummary[];
  stockUnits: number;
}

export interface BocaListResponse {
  bocas: BocaSummary[];
}

export interface BocaStockInput {
  inventoryItemId: string;
  quantity: number;
}

export interface BocaStockResponse {
  boca: BocaSummary;
  drug: {
    id: string;
    name: string;
  };
  transferredQuantity: number;
}

export interface BocaCollectResponse {
  boca: BocaSummary;
  collectedAmount: number;
  playerMoneyAfterCollect: number;
}

export interface RaveLineupItemSummary {
  baseUnitPrice: number;
  code: string;
  configuredPriceMultiplier: number;
  configuredUnitPrice: number;
  drugId: string;
  drugName: string;
  estimatedVisitorsPerCycle: number;
  quantity: number;
}

export interface RaveSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastSaleAt: string;
    totalFactionCommission: number;
  };
  economics: {
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    locationMultiplier: number;
    profitable: boolean;
    visitorFlowPerCycle: number;
  };
  favelaId: string | null;
  id: string;
  level: number;
  lineup: RaveLineupItemSummary[];
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  status: 'active' | 'maintenance_blocked' | 'no_lineup';
}

export interface RaveListResponse {
  raves: RaveSummary[];
}

export interface RaveStockInput {
  inventoryItemId: string;
  quantity: number;
}

export interface RaveStockResponse {
  drug: {
    id: string;
    name: string;
  };
  rave: RaveSummary;
  transferredQuantity: number;
}

export interface RavePricingInput {
  drugId: string;
  priceMultiplier: number;
}

export interface RavePricingResponse {
  configuredDrugId: string;
  priceMultiplier: number;
  rave: RaveSummary;
}

export interface RaveCollectResponse {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
  rave: RaveSummary;
}

export interface GpTemplateSummary {
  baseDailyRevenue: number;
  label: string;
  purchasePrice: number;
  staminaRestorePercent: number;
  type: GpType;
}

export interface PuteiroWorkerSummary {
  baseDailyRevenue: number;
  dstRecoversAt: string | null;
  hasDst: boolean;
  hourlyGrossRevenueEstimate: number;
  id: string;
  incidentRisk: {
    deathChancePerCycle: number;
    dstChancePerCycle: number;
    escapeChancePerCycle: number;
  };
  label: string;
  lastIncidentAt: string | null;
  purchasePrice: number;
  staminaRestorePercent: number;
  status: PuteiroGpStatus;
  type: GpType;
}

export interface PuteiroSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastRevenueAt: string;
    totalFactionCommission: number;
  };
  economics: {
    activeGps: number;
    availableSlots: number;
    capacity: number;
    charismaMultiplier: number;
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    locationMultiplier: number;
    profitable: boolean;
  };
  favelaId: string | null;
  id: string;
  incidents: {
    activeDstCases: number;
    totalDeaths: number;
    totalDstIncidents: number;
    totalEscapes: number;
  };
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  roster: PuteiroWorkerSummary[];
  status: 'active' | 'maintenance_blocked' | 'no_gps';
}

export interface PuteiroListResponse {
  puteiros: PuteiroSummary[];
  templates: GpTemplateSummary[];
}

export interface PuteiroHireInput {
  quantity: number;
  type: GpType;
}

export interface PuteiroHireResponse {
  hiredGps: PuteiroWorkerSummary[];
  playerMoneyAfterPurchase: number;
  puteiro: PuteiroSummary;
  totalPurchaseCost: number;
}

export interface PuteiroCollectResponse {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
  puteiro: PuteiroSummary;
}

export interface FrontStoreKindTemplateSummary {
  baseDailyLegitRevenue: number;
  baseInvestigationRisk: number;
  baseLaunderingCapacityPerDay: number;
  cleanReturnMultiplier: number;
  kind: FrontStoreKind;
  label: string;
}

export interface FrontStoreBatchSummary {
  completedAt: string;
  expectedCleanReturn: number;
  id: string;
  investedAmount: number;
  investigationRisk: number;
  resolvedAt: string | null;
  resolvedCleanAmount: number;
  seizedAmount: number;
  startedAt: string;
  status: FrontStoreBatchStatus;
}

export interface FrontStoreSummary {
  batches: FrontStoreBatchSummary[];
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastRevenueAt: string;
    totalFactionCommission: number;
    totalLaunderedClean: number;
    totalSeizedAmount: number;
  };
  economics: {
    charismaRiskReduction: number;
    cleanReturnMultiplier: number | null;
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyLegitRevenue: number;
    launderingCapacityPerDay: number;
    launderingCapacityRemaining: number;
    legitRevenuePerCycle: number;
    locationMultiplier: number;
    profitable: boolean;
  };
  favelaId: string | null;
  id: string;
  investigation: {
    activeUntil: string | null;
    investigationsTotal: number;
    isUnderInvestigation: boolean;
    lastInvestigationAt: string | null;
  };
  kind: FrontStoreKind | null;
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  status: 'active' | 'investigation_blocked' | 'maintenance_blocked' | 'setup_required';
}

export interface FrontStoreListResponse {
  frontStores: FrontStoreSummary[];
  kinds: FrontStoreKindTemplateSummary[];
}

export interface FrontStoreInvestInput {
  dirtyAmount: number;
  storeKind?: FrontStoreKind;
}

export interface FrontStoreInvestResponse {
  batch: FrontStoreBatchSummary;
  frontStore: FrontStoreSummary;
  playerMoneyAfterInvest: number;
}

export interface FrontStoreCollectResponse {
  collectedAmount: number;
  frontStore: FrontStoreSummary;
  playerBankMoneyAfterCollect: number;
}

export interface SlotMachineSummary {
  cashbox: {
    availableToCollect: number;
    grossRevenueLifetime: number;
    lastCollectedAt: string | null;
    lastPlayAt: string;
    totalFactionCommission: number;
  };
  config: {
    houseEdge: number;
    jackpotChance: number;
    maxBet: number;
    minBet: number;
  };
  economics: {
    capacity: number;
    cycleMinutes: number;
    effectiveFactionCommissionRate: number;
    estimatedHourlyGrossRevenue: number;
    expectedGrossRevenuePerCycle: number;
    installedMachines: number;
    locationMultiplier: number;
    playerTrafficMultiplier: number;
    profitable: boolean;
  };
  favelaId: string | null;
  id: string;
  level: number;
  maintenanceStatus: {
    blocked: boolean;
    lastMaintenanceAt: string;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  regionId: RegionId;
  status: 'active' | 'installation_required' | 'maintenance_blocked';
}

export interface SlotMachineListResponse {
  slotMachines: SlotMachineSummary[];
}

export interface SlotMachineInstallInput {
  quantity: number;
}

export interface SlotMachineInstallResponse {
  installedQuantity: number;
  playerMoneyAfterInstall: number;
  slotMachine: SlotMachineSummary;
  totalInstallCost: number;
}

export interface SlotMachineConfigureInput {
  houseEdge: number;
  jackpotChance: number;
  maxBet: number;
  minBet: number;
}

export interface SlotMachineConfigureResponse {
  slotMachine: SlotMachineSummary;
}

export interface SlotMachineCollectResponse {
  collectedAmount: number;
  playerMoneyAfterCollect: number;
  slotMachine: SlotMachineSummary;
}

export interface BichoAnimalSummary {
  groupNumbers: number[];
  label: string;
  number: number;
}

export interface BichoCurrentDrawSummary {
  closesAt: string;
  id: string;
  opensAt: string;
  sequence: number;
}

export interface BichoHistoryDrawSummary {
  closesAt: string;
  id: string;
  opensAt: string;
  sequence: number;
  settledAt: string;
  totalBetAmount: number;
  totalPayoutAmount: number;
  winningAnimalNumber: number;
  winningDozen: number;
}

export interface BichoBetSummary {
  amount: number;
  animalNumber: number | null;
  dozen: number | null;
  drawClosesAt: string;
  drawId: string;
  id: string;
  mode: BichoBetMode;
  payout: number;
  placedAt: string;
  settledAt: string | null;
  status: BichoBetStatus;
}

export interface BichoListResponse {
  animals: BichoAnimalSummary[];
  bets: BichoBetSummary[];
  currentDraw: BichoCurrentDrawSummary;
  recentDraws: BichoHistoryDrawSummary[];
}

export interface BichoPlaceBetInput {
  amount: number;
  animalNumber?: number;
  dozen?: number;
  mode: BichoBetMode;
}

export interface BichoPlaceBetResponse {
  bet: BichoBetSummary;
  currentDraw: BichoCurrentDrawSummary;
  playerMoneyAfterBet: number;
}

export interface DrugFactoryRequirementSummary {
  availableQuantity: number;
  componentId: string;
  componentName: string;
  quantityPerCycle: number;
}

export interface DrugFactoryRecipeSummary {
  baseProduction: number;
  cycleMinutes: number;
  dailyMaintenanceCost: number;
  drugId: string;
  drugName: string;
  levelRequired: number;
  requirements: DrugFactoryRequirementSummary[];
}

export interface DrugFactorySummary {
  baseProduction: number;
  blockedReason: 'components' | 'maintenance' | null;
  createdAt: string;
  cycleMinutes: number;
  dailyMaintenanceCost: number;
  drugId: string;
  drugName: string;
  id: string;
  maintenanceStatus: {
    blocked: boolean;
    moneySpentOnSync: number;
    overdueDays: number;
  };
  multipliers: {
    impulse: number;
    intelligence: number;
    universityProduction: number;
    vocation: number;
  };
  outputPerCycle: number;
  regionId: RegionId;
  requirements: DrugFactoryRequirementSummary[];
  storedOutput: number;
}

export interface DrugFactoryListResponse {
  availableRecipes: DrugFactoryRecipeSummary[];
  factories: DrugFactorySummary[];
}

export interface DrugFactoryCreateInput {
  drugId: string;
}

export interface DrugFactoryCreateResponse {
  factory: DrugFactorySummary;
}

export interface DrugFactoryStockInput {
  inventoryItemId: string;
  quantity: number;
}

export interface DrugFactoryStockResponse {
  component: {
    id: string;
    name: string;
  };
  factory: DrugFactorySummary;
  transferredQuantity: number;
}

export interface DrugFactoryCollectResponse {
  collectedQuantity: number;
  drug: {
    id: string;
    name: string;
  };
  factory: DrugFactorySummary;
}

export interface DrugSaleInput {
  channel: DrugSaleChannel;
  inventoryItemId: string;
  propertyId?: string;
  quantity: number;
}

export interface DrugSaleModifierSummary {
  label: string;
  multiplier: number;
  source: 'attribute' | 'channel' | 'event' | 'property' | 'region';
}

export interface DrugSaleQuoteResponse {
  channel: {
    commissionRate: number;
    id: DrugSaleChannel;
    label: string;
    propertyTypeRequired: 'boca' | 'rave' | null;
    staminaCost: number;
  };
  drug: {
    code: string;
    id: string;
    inventoryItemId: string;
    name: string;
  };
  location: {
    propertyId: string | null;
    propertyType: 'boca' | 'rave' | null;
    regionId: RegionId;
  };
  modifiers: DrugSaleModifierSummary[];
  pricing: {
    baseUnitPrice: number;
    commissionAmount: number;
    finalUnitPrice: number;
    grossRevenue: number;
    netRevenue: number;
  };
  quantity: {
    available: number;
    demandCap: number;
    remainingAfterSale: number;
    requested: number;
    sellable: number;
  };
  warnings: string[];
}

export interface DocksEventStatusResponse {
  endsAt: string | null;
  isActive: boolean;
  phase: DocksEventPhase;
  premiumMultiplier: number;
  regionId: RegionId;
  remainingSeconds: number;
  secondsUntilStart: number;
  startsAt: string | null;
  unlimitedDemand: boolean;
}

export interface PoliceEventStatusItem {
  banditsArrested: number | null;
  banditsKilledEstimate: number | null;
  drugsLost: number | null;
  endsAt: string;
  eventType: PoliceEventType;
  favelaId: string | null;
  favelaName: string | null;
  headline: string | null;
  internalSatisfactionAfter: number | null;
  internalSatisfactionBefore: number | null;
  policePressureAfter: number | null;
  policePressureBefore: number | null;
  regionId: RegionId;
  regionName: string;
  remainingSeconds: number;
  satisfactionAfter: number | null;
  satisfactionBefore: number | null;
  soldiersLost: number | null;
  startedAt: string;
  weaponsLost: number | null;
}

export interface PoliceEventStatusResponse {
  events: PoliceEventStatusItem[];
  generatedAt: string;
}

export interface SeasonalEventStatusItem {
  bonusSummary: string[];
  endsAt: string;
  eventType: SeasonalEventType;
  headline: string;
  policeMood: SeasonalEventPoliceMood;
  regionId: RegionId;
  regionName: string;
  remainingSeconds: number;
  startedAt: string;
}

export interface SeasonalEventStatusResponse {
  events: SeasonalEventStatusItem[];
  generatedAt: string;
}

export interface DrugSaleExecuteResponse extends DrugSaleQuoteResponse {
  playerMoneyAfterSale: number;
  playerStaminaAfterSale: number;
  soldAt: string;
}
