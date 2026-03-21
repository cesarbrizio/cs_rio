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
  | 'front_store'
  | 'slot_machine';
export type PropertyCategory = 'business' | 'realty' | 'luxury_item';
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
export type GameEventResultType =
  | 'navio_docas'
  | 'saidinha_natal'
  | PoliceEventType
  | SeasonalEventType;
export type GameEventResultSeverity = 'danger' | 'info' | 'warning';
export type GameEventResultDestination = 'map' | 'market' | 'prison' | 'territory';
export type HospitalizationReason = 'combat' | 'overdose';
export type OverdoseTrigger = 'cansaco_overflow' | 'max_addiction' | 'poly_drug_mix';
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
export type FactionRank = 'patrao' | 'general' | 'gerente' | 'vapor' | 'soldado' | 'cria';
export type PlayerContactType = 'partner' | 'known';
export type PlayerContactOrigin = 'manual' | 'same_faction';
export type FactionBankEntryType =
  | 'deposit'
  | 'withdrawal'
  | 'business_commission'
  | 'robbery_commission'
  | 'service_income';
export type FactionBankOriginType =
  | 'manual'
  | 'bicho'
  | 'boca'
  | 'rave'
  | 'puteiro'
  | 'front_store'
  | 'robbery'
  | 'slot_machine'
  | 'favela_service'
  | 'propina'
  | 'upgrade';
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
