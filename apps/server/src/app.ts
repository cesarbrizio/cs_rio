import cors from '@fastify/cors';
import Fastify from 'fastify';

import { resolveCorsOptions } from './config/cors.js';
import { ActionIdempotency } from './api/action-idempotency.js';
import { env } from './config/env.js';
import { installHttpInputHardening, HTTP_BODY_LIMIT_BYTES } from './api/http-hardening.js';
import { installGlobalHttpErrorHandler } from './api/http-errors.js';
import { bindRequestContext, refreshRequestContext } from './observability/request-context.js';
import { createApiRoutes } from './api/routes/index.js';
import {
  AuthService,
  RedisKeyValueStore,
  type AuthRepository,
  type KeyValueStore,
} from './services/auth.js';
import { BankService, type BankServiceContract } from './services/bank.js';
import { BichoService, type BichoServiceContract } from './services/bicho.js';
import { BocaService, type BocaServiceContract } from './services/boca.js';
import { CrimeService, type CrimeServiceContract } from './services/crime.js';
import { DrugSaleService, type DrugSaleServiceContract } from './services/drug-sale.js';
import { GameConfigService } from './services/game-config.js';
import { GameEventService, type GameEventServiceContract } from './services/game-event.js';
import { FactionService, type FactionServiceContract } from './services/faction.js';
import { FactoryService, type FactoryServiceContract } from './services/factory.js';
import { FrontStoreService, type FrontStoreServiceContract } from './services/front-store.js';
import { HospitalService, type HospitalServiceContract } from './services/hospital.js';
import { MarketService, type MarketServiceContract } from './services/market.js';
import { PlayerService, type PlayerRepository } from './services/player.js';
import { PrisonService, type PrisonServiceContract } from './services/prison.js';
import { PvpService, type PvpServiceContract } from './services/pvp.js';
import { PuteiroService, type PuteiroServiceContract } from './services/puteiro.js';
import { PropertyService, type PropertyServiceContract } from './services/property.js';
import { RobberyService, type RobberyServiceContract } from './services/robbery.js';
import { RoundService, type RoundServiceContract } from './services/round.js';
import { RaveService, type RaveServiceContract } from './services/rave.js';
import { SlotMachineService, type SlotMachineServiceContract } from './services/slot-machine.js';
import { TerritoryService, type TerritoryServiceContract } from './services/territory.js';
import { TribunalService, type TribunalServiceContract } from './services/tribunal.js';
import { TrainingService, type TrainingServiceContract } from './services/training.js';
import {
  UniversityService,
  type UniversityEffectReaderContract,
  type UniversityServiceContract,
} from './services/university.js';
import { PrisonSystem, type PrisonSystemContract } from './systems/PrisonSystem.js';

export interface CreateAppOptions {
  authRepository?: AuthRepository;
  authService?: AuthService;
  bankService?: BankServiceContract;
  bichoService?: BichoServiceContract;
  bocaService?: BocaServiceContract;
  crimeService?: CrimeServiceContract;
  drugSaleService?: DrugSaleServiceContract;
  gameEventService?: GameEventServiceContract;
  factionService?: FactionServiceContract;
  factoryService?: FactoryServiceContract;
  frontStoreService?: FrontStoreServiceContract;
  hospitalService?: HospitalServiceContract;
  keyValueStore?: KeyValueStore;
  marketService?: MarketServiceContract;
  playerService?: PlayerService;
  playerRepository?: PlayerRepository;
  pvpService?: PvpServiceContract;
  prisonService?: PrisonServiceContract;
  puteiroService?: PuteiroServiceContract;
  propertyService?: PropertyServiceContract;
  robberyService?: RobberyServiceContract;
  roundService?: RoundServiceContract;
  raveService?: RaveServiceContract;
  slotMachineService?: SlotMachineServiceContract;
  territoryService?: TerritoryServiceContract;
  tribunalService?: TribunalServiceContract;
  trainingService?: TrainingServiceContract;
  universityService?: UniversityServiceContract & UniversityEffectReaderContract;
  prisonSystem?: PrisonSystemContract;
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({
    bodyLimit: HTTP_BODY_LIMIT_BYTES,
    logger: true,
    requestIdHeader: 'x-request-id',
  });
  const ownsAuthService = !options.authService;
  const ownsBankService = !options.bankService;
  const ownsBichoService = !options.bichoService;
  const ownsBocaService = !options.bocaService;
  const ownsCrimeService = !options.crimeService;
  const ownsDrugSaleService = !options.drugSaleService;
  const ownsFactionService = !options.factionService;
  const ownsFactoryService = !options.factoryService;
  const ownsFrontStoreService = !options.frontStoreService;
  const ownsHospitalService = !options.hospitalService;
  const ownsMarketService = !options.marketService;
  const ownsPlayerService = !options.playerService;
  const ownsPrisonService = !options.prisonService;
  const ownsPuteiroService = !options.puteiroService;
  const ownsPvpService = !options.pvpService;
  const ownsPropertyService = !options.propertyService;
  const ownsRobberyService = !options.robberyService;
  const ownsRoundService = !options.roundService;
  const ownsRaveService = !options.raveService;
  const ownsSlotMachineService = !options.slotMachineService;
  const ownsTerritoryService = !options.territoryService;
  const ownsTribunalService = !options.tribunalService;
  const ownsTrainingService = !options.trainingService;
  const ownsUniversityService = !options.universityService;
  const ownsPrisonSystem = !options.prisonSystem;
  const keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
  const actionIdempotency = new ActionIdempotency(keyValueStore);
  const authService =
    options.authService ??
    new AuthService({
      keyValueStore,
      repository: options.authRepository,
    });
  const bankService =
    options.bankService ??
    new BankService({
      keyValueStore,
    });
  const bichoService =
    options.bichoService ??
    new BichoService({
      keyValueStore,
    });
  const factionService =
    options.factionService ??
    new FactionService({
      keyValueStore,
    });
  const prisonSystem =
    options.prisonSystem ??
    new PrisonSystem({
      keyValueStore,
    });
  const playerService =
    options.playerService ??
    new PlayerService({
      factionUpgradeReader: factionService,
      keyValueStore,
      prisonSystem,
      repository: options.playerRepository,
    });
  const universityService =
    options.universityService ??
    new UniversityService({
      keyValueStore,
    });
  const prisonService =
    options.prisonService ??
    new PrisonService({
      keyValueStore,
      prisonSystem,
      universityReader: universityService,
    });
  const bocaService =
    options.bocaService ??
    new BocaService({
      keyValueStore,
      universityReader: universityService,
    });
  const crimeService =
    options.crimeService ??
    new CrimeService({
      factionUpgradeReader: factionService,
      keyValueStore,
      universityReader: universityService,
    });
  const drugSaleService =
    options.drugSaleService ??
    new DrugSaleService({
      keyValueStore,
    });
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
  const frontStoreService =
    options.frontStoreService ??
    new FrontStoreService({
      keyValueStore,
      universityReader: universityService,
    });
  const marketService =
    options.marketService ??
    new MarketService({
      keyValueStore,
      universityReader: universityService,
    });
  const hospitalService =
    options.hospitalService ??
    new HospitalService({
      keyValueStore,
    });
  const propertyService =
    options.propertyService ??
    new PropertyService({
      factionUpgradeReader: factionService,
      keyValueStore,
      universityReader: universityService,
    });
  const robberyService =
    options.robberyService ??
    new RobberyService({
      keyValueStore,
      universityReader: universityService,
    });
  const roundService = options.roundService ?? new RoundService();
  const pvpService =
    options.pvpService ??
    new PvpService({
      factionUpgradeReader: factionService,
      keyValueStore,
      universityReader: universityService,
    });
  const puteiroService =
    options.puteiroService ??
    new PuteiroService({
      keyValueStore,
      universityReader: universityService,
    });
  const raveService =
    options.raveService ??
    new RaveService({
      keyValueStore,
      universityReader: universityService,
    });
  const slotMachineService =
    options.slotMachineService ??
    new SlotMachineService({
      keyValueStore,
      universityReader: universityService,
    });
  const territoryService =
    options.territoryService ??
    new TerritoryService({
      factionUpgradeReader: factionService,
    });
  const tribunalService = options.tribunalService ?? new TribunalService();
  const trainingService =
    options.trainingService ??
    new TrainingService({
      keyValueStore,
      universityReader: universityService,
    });

  await app.register(cors, {
    ...resolveCorsOptions({
      corsAllowedOrigins: env.corsAllowedOrigins,
      nodeEnv: env.nodeEnv,
    }),
  });

  app.decorateRequest('contextLog', undefined);
  app.decorateRequest('playerId', undefined);
  app.decorateRequest('requestContext', undefined);

  app.addHook('onRequest', async (request, reply) => {
    bindRequestContext(request);
    reply.header('x-request-id', request.id);
  });

  app.addHook('preHandler', async (request) => {
    refreshRequestContext(request);
  });

  installHttpInputHardening(app);
  installGlobalHttpErrorHandler(app);

  app.addHook('onClose', async () => {
    if (ownsAuthService) {
      await authService.close();
    }

    if (ownsBankService) {
      await bankService.close?.();
    }

    if (ownsBichoService) {
      await bichoService.close?.();
    }

    if (ownsPlayerService) {
      await playerService.close();
    }

    if (ownsPrisonService) {
      await prisonService.close?.();
    }

    if (ownsBocaService) {
      await bocaService.close?.();
    }

    if (ownsCrimeService) {
      await crimeService.close?.();
    }

    if (ownsDrugSaleService) {
      await drugSaleService.close?.();
    }

    if (ownsFactionService) {
      await factionService.close?.();
    }

    if (ownsFactoryService) {
      await factoryService.close?.();
    }

    if (ownsFrontStoreService) {
      await frontStoreService.close?.();
    }

    if (ownsMarketService) {
      await marketService.close?.();
    }

    if (ownsHospitalService) {
      await hospitalService.close?.();
    }

    if (ownsPropertyService) {
      await propertyService.close?.();
    }

    if (ownsRobberyService) {
      await robberyService.close?.();
    }

    if (ownsRoundService) {
      await roundService.close?.();
    }

    if (ownsPuteiroService) {
      await puteiroService.close?.();
    }

    if (ownsPvpService) {
      await pvpService.close?.();
    }

    if (ownsRaveService) {
      await raveService.close?.();
    }

    if (ownsSlotMachineService) {
      await slotMachineService.close?.();
    }

    if (ownsTerritoryService) {
      await territoryService.close?.();
    }

    if (ownsTribunalService) {
      await tribunalService.close?.();
    }

    if (ownsTrainingService) {
      await trainingService.close?.();
    }

    if (ownsUniversityService) {
      await universityService.close?.();
    }

    if (ownsPrisonSystem) {
      await prisonSystem.close?.();
    }
  });

  await app.register(
    createApiRoutes({
      actionIdempotency,
      authService,
      bankService,
      bichoService,
      bocaService,
      crimeService,
      drugSaleService,
      gameEventService,
      factionService,
      factoryService,
      frontStoreService,
      hospitalService,
      keyValueStore,
      marketService,
      playerService,
      prisonService,
      prisonSystem,
      propertyService,
      puteiroService,
      pvpService,
      robberyService,
      roundService,
      raveService,
      slotMachineService,
      territoryService,
      tribunalService,
      trainingService,
      universityService,
    }),
    {
      prefix: '/api',
    },
  );

  return app;
}
