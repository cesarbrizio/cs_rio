import { createRealtimeServer } from './realtime.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { AuthService } from './services/auth.js';
import { EventSchedulerService } from './services/event-scheduler.js';
import { GameConfigService } from './services/game-config.js';
import { GameEventService } from './services/game-event.js';
import { PlayerService } from './services/player.js';
import { RoundService } from './services/round.js';
import { ServerConfigService } from './services/server-config.js';

async function main(): Promise<void> {
  const authService = new AuthService();
  const playerService = new PlayerService();
  const serverConfigService = new ServerConfigService();
  const gameEventService = new GameEventService({
    gameConfigService: new GameConfigService(),
  });
  const roundService = new RoundService();
  const app = await createApp({
    authService,
    gameEventService,
    playerService,
    roundService,
  });
  const realtimeServer = await createRealtimeServer({
    authService,
    playerService,
    serverConfigService,
  });
  const eventScheduler = new EventSchedulerService({
    logger: app.log.child({
      scope: 'event_scheduler',
    }),
    syncHandlers: [async (now) => roundService.syncLifecycle(now), async (now) => gameEventService.syncScheduledEvents(now)],
  });
  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals | 'bootstrap_error') => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.log.info({ signal }, 'Encerrando CS Rio server.');
    await eventScheduler.stop();
    await Promise.allSettled([
      app.close(),
      realtimeServer.gracefullyShutdown(false),
      authService.close(),
      playerService.close(),
      roundService.close?.(),
    ]);
  };

  try {
    await Promise.all([
      app.listen({
        host: '0.0.0.0',
        port: env.port,
      }),
      realtimeServer.listen(env.colyseusPort),
    ]);
    await eventScheduler.runTick();
    eventScheduler.start();

    process.once('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.once('SIGTERM', () => {
      void shutdown('SIGTERM');
    });

    app.log.info(
      {
        apiPort: env.port,
        colyseusPort: env.colyseusPort,
      },
      'CS Rio server bootstrap concluido',
    );
  } catch (error) {
    await shutdown('bootstrap_error');
    app.log.error(error);
    process.exit(1);
  }
}

void main();
