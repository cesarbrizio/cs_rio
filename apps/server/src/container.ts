import { ActionIdempotency } from './api/action-idempotency.js';
import { env } from './config/env.js';
import {
  AuthService,
  RedisKeyValueStore,
  type AuthRepository,
} from './services/auth.js';
import { BankService, type BankServiceContract } from './services/bank.js';
import { BichoService, type BichoServiceContract } from './services/bicho.js';
import { BocaService, type BocaServiceContract } from './services/boca.js';
import { ContactService, type ContactRepository } from './services/contact.js';
import { CrimeService, type CrimeServiceContract } from './services/crime.js';
import { DrugSaleService, type DrugSaleServiceContract } from './services/drug-sale.js';
import { FactionService, type FactionServiceContract } from './services/faction.js';
import { FactoryService, type FactoryServiceContract } from './services/factory.js';
import { FrontStoreService, type FrontStoreServiceContract } from './services/front-store.js';
import { GameConfigService } from './services/game-config.js';
import { GameEventService, type GameEventServiceContract } from './services/game-event.js';
import { HospitalService, type HospitalServiceContract } from './services/hospital.js';
import { MarketService, type MarketServiceContract } from './services/market.js';
import { type PlayerPublicProfileReader, type PlayerRepository, PlayerService } from './services/player.js';
import { PrisonService, type PrisonServiceContract } from './services/prison.js';
import { type PuteiroServiceContract, PuteiroService } from './services/puteiro.js';
import { PrivateMessageService } from './services/private-message.js';
import { PropertyService, type PropertyServiceContract } from './services/property.js';
import { PvpService, type PvpServiceContract } from './services/pvp.js';
import { type RaveServiceContract, RaveService } from './services/rave.js';
import { RobberyService, type RobberyServiceContract } from './services/robbery.js';
import { RoundService, type RoundServiceContract } from './services/round.js';
import { type SlotMachineServiceContract, SlotMachineService } from './services/slot-machine.js';
import { TerritoryService, type TerritoryServiceContract } from './services/territory.js';
import { TrainingService, type TrainingServiceContract } from './services/training.js';
import { TribunalService, type TribunalServiceContract } from './services/tribunal.js';
import {
  UniversityService,
  type UniversityEffectReaderContract,
  type UniversityServiceContract,
} from './services/university.js';
import type { KeyValueStore } from './services/key-value-store.js';
import { PrisonSystem, type PrisonSystemContract } from './systems/PrisonSystem.js';

type Closable = {
  close?: () => Promise<void>;
};

export interface ServiceContainer {
  actionIdempotency: ActionIdempotency;
  authService: AuthService;
  bankService: BankServiceContract;
  bichoService: BichoServiceContract;
  bocaService: BocaServiceContract;
  contactService: ContactService;
  crimeService: CrimeServiceContract;
  drugSaleService: DrugSaleServiceContract;
  factionService: FactionServiceContract;
  factoryService: FactoryServiceContract;
  frontStoreService: FrontStoreServiceContract;
  gameEventService: GameEventServiceContract;
  hospitalService: HospitalServiceContract;
  keyValueStore: KeyValueStore;
  marketService: MarketServiceContract;
  playerService: PlayerService;
  prisonService: PrisonServiceContract;
  prisonSystem: PrisonSystemContract;
  privateMessageService: PrivateMessageService;
  propertyService: PropertyServiceContract;
  puteiroService: PuteiroServiceContract;
  pvpService: PvpServiceContract;
  robberyService: RobberyServiceContract;
  roundService: RoundServiceContract;
  raveService: RaveServiceContract;
  slotMachineService: SlotMachineServiceContract;
  territoryService: TerritoryServiceContract;
  trainingService: TrainingServiceContract;
  tribunalService: TribunalServiceContract;
  universityService: UniversityServiceContract;
  close(): Promise<void>;
}

export interface CreateServiceContainerOptions {
  authRepository?: AuthRepository;
  authService?: AuthService;
  bankService?: BankServiceContract;
  bichoService?: BichoServiceContract;
  bocaService?: BocaServiceContract;
  contactRepository?: ContactRepository;
  contactService?: ContactService;
  crimeService?: CrimeServiceContract;
  drugSaleService?: DrugSaleServiceContract;
  factionService?: FactionServiceContract;
  factoryService?: FactoryServiceContract;
  frontStoreService?: FrontStoreServiceContract;
  gameEventService?: GameEventServiceContract;
  hospitalService?: HospitalServiceContract;
  keyValueStore?: KeyValueStore;
  marketService?: MarketServiceContract;
  playerPublicProfileReader?: PlayerPublicProfileReader;
  playerRepository?: PlayerRepository;
  playerService?: PlayerService;
  prisonRandom?: () => number;
  prisonService?: PrisonServiceContract;
  prisonSystem?: PrisonSystemContract;
  privateMessageService?: PrivateMessageService;
  propertyService?: PropertyServiceContract;
  puteiroService?: PuteiroServiceContract;
  pvpService?: PvpServiceContract;
  robberyService?: RobberyServiceContract;
  roundService?: RoundServiceContract;
  raveService?: RaveServiceContract;
  slotMachineService?: SlotMachineServiceContract;
  territoryService?: TerritoryServiceContract;
  trainingService?: TrainingServiceContract;
  tribunalService?: TribunalServiceContract;
  universityService?: UniversityServiceContract & UniversityEffectReaderContract;
}

export function createServiceContainer(
  options: CreateServiceContainerOptions = {},
): ServiceContainer {
  const ownedClosers: Array<() => Promise<void>> = [];
  const trackOwnedClose = (service: Closable | undefined, owns: boolean): void => {
    if (owns && service?.close) {
      ownedClosers.push(() => service.close!());
    }
  };

  const keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
  const actionIdempotency = new ActionIdempotency(keyValueStore);
  const authService =
    options.authService ??
    new AuthService({
      keyValueStore,
      repository: options.authRepository,
    });
  trackOwnedClose(authService, !options.authService);

  const bankService =
    options.bankService ??
    new BankService({
      keyValueStore,
    });
  trackOwnedClose(bankService, !options.bankService);

  const bichoService =
    options.bichoService ??
    new BichoService({
      keyValueStore,
    });
  trackOwnedClose(bichoService, !options.bichoService);

  const contactService =
    options.contactService ??
    new ContactService({
      repository: options.contactRepository,
    });

  const factionService =
    options.factionService ??
    new FactionService({
      contactSync: contactService,
      keyValueStore,
    });
  trackOwnedClose(factionService, !options.factionService);

  const prisonSystem =
    options.prisonSystem ??
    new PrisonSystem({
      keyValueStore,
    });
  trackOwnedClose(prisonSystem, !options.prisonSystem);

  const playerService =
    options.playerService ??
    new PlayerService({
      factionUpgradeReader: factionService,
      keyValueStore,
      prisonSystem,
      publicProfileReader:
        options.playerPublicProfileReader ??
        (options.playerRepository as PlayerPublicProfileReader | undefined),
      repository: options.playerRepository,
    });
  trackOwnedClose(playerService, !options.playerService);

  const universityService =
    options.universityService ??
    new UniversityService({
      keyValueStore,
    });
  trackOwnedClose(universityService, !options.universityService);

  const prisonService =
    options.prisonService ??
    new PrisonService({
      keyValueStore,
      random: options.prisonRandom,
      prisonSystem,
      universityReader: universityService,
    });
  trackOwnedClose(prisonService, !options.prisonService);

  const bocaService =
    options.bocaService ??
    new BocaService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(bocaService, !options.bocaService);

  const crimeService =
    options.crimeService ??
    new CrimeService({
      factionUpgradeReader: factionService,
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(crimeService, !options.crimeService);

  const drugSaleService =
    options.drugSaleService ??
    new DrugSaleService({
      keyValueStore,
    });
  trackOwnedClose(drugSaleService, !options.drugSaleService);

  const gameEventService =
    options.gameEventService ??
    new GameEventService({
      gameConfigService: new GameConfigService(),
    });

  const factoryService =
    options.factoryService ??
    new FactoryService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(factoryService, !options.factoryService);

  const frontStoreService =
    options.frontStoreService ??
    new FrontStoreService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(frontStoreService, !options.frontStoreService);

  const marketService =
    options.marketService ??
    new MarketService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(marketService, !options.marketService);

  const hospitalService =
    options.hospitalService ??
    new HospitalService({
      keyValueStore,
    });
  trackOwnedClose(hospitalService, !options.hospitalService);

  const propertyService =
    options.propertyService ??
    new PropertyService({
      factionUpgradeReader: factionService,
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(propertyService, !options.propertyService);

  const robberyService =
    options.robberyService ??
    new RobberyService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(robberyService, !options.robberyService);

  const roundService = options.roundService ?? new RoundService();
  trackOwnedClose(roundService, !options.roundService);

  const pvpService =
    options.pvpService ??
    new PvpService({
      factionUpgradeReader: factionService,
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(pvpService, !options.pvpService);

  const privateMessageService =
    options.privateMessageService ??
    new PrivateMessageService({
      contactRepository: options.contactRepository,
    });

  const puteiroService =
    options.puteiroService ??
    new PuteiroService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(puteiroService, !options.puteiroService);

  const raveService =
    options.raveService ??
    new RaveService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(raveService, !options.raveService);

  const slotMachineService =
    options.slotMachineService ??
    new SlotMachineService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(slotMachineService, !options.slotMachineService);

  const territoryService =
    options.territoryService ??
    new TerritoryService({
      factionUpgradeReader: factionService,
      keyValueStore,
    });
  trackOwnedClose(territoryService, !options.territoryService);

  const tribunalService =
    options.tribunalService ??
    new TribunalService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(tribunalService, !options.tribunalService);

  const trainingService =
    options.trainingService ??
    new TrainingService({
      keyValueStore,
      universityReader: universityService,
    });
  trackOwnedClose(trainingService, !options.trainingService);

  return {
    actionIdempotency,
    authService,
    bankService,
    bichoService,
    bocaService,
    contactService,
    crimeService,
    drugSaleService,
    factionService,
    factoryService,
    frontStoreService,
    gameEventService,
    hospitalService,
    keyValueStore,
    marketService,
    playerService,
    prisonService,
    prisonSystem,
    privateMessageService,
    propertyService,
    puteiroService,
    pvpService,
    robberyService,
    roundService,
    raveService,
    slotMachineService,
    territoryService,
    trainingService,
    tribunalService,
    universityService,
    async close(): Promise<void> {
      for (const close of ownedClosers) {
        await close();
      }
    },
  };
}
