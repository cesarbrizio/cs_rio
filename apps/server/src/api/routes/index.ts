import { type FastifyPluginAsync } from 'fastify';

import { type ActionIdempotency } from '../action-idempotency.js';
import { createHttpRateLimitHook } from '../http-hardening.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createPrisonActionLockMiddleware } from '../middleware/prison.js';
import { type AuthService } from '../../services/auth.js';
import type { KeyValueAtomic } from '../../services/key-value-store.js';
import { type BankServiceContract } from '../../services/bank.js';
import { type BichoServiceContract } from '../../services/bicho.js';
import { type BocaServiceContract } from '../../services/boca.js';
import { type ContactService } from '../../services/contact.js';
import { type CrimeServiceContract } from '../../services/crime.js';
import { type DrugSaleServiceContract } from '../../services/drug-sale.js';
import { type GameEventServiceContract } from '../../services/game-event.js';
import { type FactionServiceContract } from '../../services/faction.js';
import { type FactoryServiceContract } from '../../services/factory.js';
import { type FrontStoreServiceContract } from '../../services/front-store.js';
import { type HospitalServiceContract } from '../../services/hospital.js';
import { type MarketServiceContract } from '../../services/market.js';
import { type PlayerService } from '../../services/player.js';
import { type PrisonServiceContract } from '../../services/prison.js';
import { type PvpServiceContract } from '../../services/pvp.js';
import { type PuteiroServiceContract } from '../../services/puteiro.js';
import { type PrivateMessageService } from '../../services/private-message.js';
import { type PropertyServiceContract } from '../../services/property.js';
import { type RobberyServiceContract } from '../../services/robbery.js';
import { type RoundServiceContract } from '../../services/round.js';
import { createAuthRoutes } from './auth.js';
import { createBankRoutes } from './bank.js';
import { createBichoRoutes } from './bicho.js';
import { createBocaRoutes } from './bocas.js';
import { createCrimeRoutes } from './crimes.js';
import { createContactRoutes } from './contacts.js';
import { createDrugSaleRoutes } from './drug-sales.js';
import { createEventRoutes } from './events.js';
import { createFactionRoutes } from './factions.js';
import { createFactoryRoutes } from './factories.js';
import { createFrontStoreRoutes } from './front-stores.js';
import { createInventoryRoutes } from './inventory.js';
import { createHospitalRoutes } from './hospital.js';
import { createMarketRoutes } from './market.js';
import { createPlayerRoutes } from './players.js';
import { createPrisonRoutes } from './prison.js';
import { createPrivateMessageRoutes } from './private-messages.js';
import { createPvpRoutes } from './pvp.js';
import { createPuteiroRoutes } from './puteiros.js';
import { createPropertyRoutes } from './properties.js';
import { createRobberyRoutes } from './robberies.js';
import { createRoundRoutes } from './round.js';
import { createRaveRoutes } from './raves.js';
import { createSlotMachineRoutes } from './slot-machines.js';
import { type RaveServiceContract } from '../../services/rave.js';
import { type SlotMachineServiceContract } from '../../services/slot-machine.js';
import { type TrainingServiceContract } from '../../services/training.js';
import { type TribunalServiceContract } from '../../services/tribunal.js';
import { type TerritoryServiceContract } from '../../services/territory.js';
import { type UniversityServiceContract } from '../../services/university.js';
import { createTribunalRoutes } from './tribunal.js';
import { createTrainingRoutes } from './training.js';
import { createTerritoryRoutes } from './territory.js';
import { createUniversityRoutes } from './university.js';
import { type PrisonSystemContract } from '../../systems/PrisonSystem.js';

interface ApiRouteDependencies {
  actionIdempotency: ActionIdempotency;
  authService: AuthService;
  bankService: BankServiceContract;
  bichoService: BichoServiceContract;
  bocaService: BocaServiceContract;
  contactService: ContactService;
  crimeService: CrimeServiceContract;
  drugSaleService: DrugSaleServiceContract;
  gameEventService: GameEventServiceContract;
  factionService: FactionServiceContract;
  factoryService: FactoryServiceContract;
  frontStoreService: FrontStoreServiceContract;
  hospitalService: HospitalServiceContract;
  marketService: MarketServiceContract;
  playerService: PlayerService;
  prisonService: PrisonServiceContract;
  privateMessageService: PrivateMessageService;
  pvpService: PvpServiceContract;
  puteiroService: PuteiroServiceContract;
  propertyService: PropertyServiceContract;
  robberyService: RobberyServiceContract;
  roundService: RoundServiceContract;
  raveService: RaveServiceContract;
  slotMachineService: SlotMachineServiceContract;
  tribunalService: TribunalServiceContract;
  territoryService: TerritoryServiceContract;
  trainingService: TrainingServiceContract;
  universityService: UniversityServiceContract;
  prisonSystem: PrisonSystemContract;
  keyValueStore: KeyValueAtomic;
}

export function createApiRoutes({
  actionIdempotency,
  authService,
  bankService,
  bichoService,
  bocaService,
  contactService,
  crimeService,
  drugSaleService,
  gameEventService,
  factionService,
  factoryService,
  frontStoreService,
  hospitalService,
  marketService,
  playerService,
  prisonService,
  privateMessageService,
  pvpService,
  puteiroService,
  propertyService,
  robberyService,
  roundService,
  raveService,
  slotMachineService,
  tribunalService,
  territoryService,
  trainingService,
  universityService,
  prisonSystem,
  keyValueStore,
}: ApiRouteDependencies): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/health', async () => ({
      service: 'cs-rio-server',
      status: 'ok',
      phase: 'fase-0-bootstrap',
    }));

    await fastify.register(createAuthRoutes({ authService, keyValueStore }));
    await fastify.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
      protectedRoutes.addHook('preHandler', createHttpRateLimitHook({ keyValueStore }));
      protectedRoutes.addHook('preHandler', createPrisonActionLockMiddleware(prisonSystem));
      await protectedRoutes.register(createBankRoutes({ bankService }));
      await protectedRoutes.register(createBichoRoutes({ bichoService }));
      await protectedRoutes.register(createBocaRoutes({ bocaService }));
      await protectedRoutes.register(createContactRoutes({ contactService }));
      await protectedRoutes.register(createCrimeRoutes({ actionIdempotency, crimeService }));
      await protectedRoutes.register(createDrugSaleRoutes({ drugSaleService }));
      await protectedRoutes.register(createEventRoutes({ gameEventService }));
      await protectedRoutes.register(createFactionRoutes({ factionService }));
      await protectedRoutes.register(createFactoryRoutes({ factoryService }));
      await protectedRoutes.register(createFrontStoreRoutes({ frontStoreService }));
      await protectedRoutes.register(createHospitalRoutes({ actionIdempotency, hospitalService }));
      await protectedRoutes.register(createInventoryRoutes({ playerService }));
      await protectedRoutes.register(createMarketRoutes({ actionIdempotency, marketService }));
      await protectedRoutes.register(createPlayerRoutes({ playerService }));
      await protectedRoutes.register(createPrisonRoutes({ actionIdempotency, prisonService }));
      await protectedRoutes.register(createPrivateMessageRoutes({ privateMessageService }));
      await protectedRoutes.register(createPvpRoutes({ pvpService }));
      await protectedRoutes.register(createPuteiroRoutes({ puteiroService }));
      await protectedRoutes.register(createPropertyRoutes({ actionIdempotency, propertyService }));
      await protectedRoutes.register(createRobberyRoutes({ robberyService }));
      await protectedRoutes.register(createRoundRoutes({ roundService }));
      await protectedRoutes.register(createRaveRoutes({ raveService }));
      await protectedRoutes.register(createSlotMachineRoutes({ slotMachineService }));
      await protectedRoutes.register(createTerritoryRoutes({ actionIdempotency, territoryService }));
      await protectedRoutes.register(createTribunalRoutes({ tribunalService }));
      await protectedRoutes.register(createTrainingRoutes({ trainingService }));
      await protectedRoutes.register(createUniversityRoutes({ universityService }));
    });
  };
}
