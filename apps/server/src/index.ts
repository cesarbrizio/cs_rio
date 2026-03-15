import { createRealtimeServer } from './realtime.js';
import { createApp } from './app.js';
import { getValidatedServerBootEnv, InvalidEnvironmentError } from './config/env.js';
import { registerProcessErrorHandlers } from './observability/process-errors.js';
import { AuthService } from './services/auth.js';
import { EventSchedulerService } from './services/event-scheduler.js';
import { GameConfigService } from './services/game-config.js';
import { GameEventService } from './services/game-event.js';
import { PlayerService } from './services/player.js';
import { RoundService } from './services/round.js';
import { ServerConfigService } from './services/server-config.js';

async function main(): Promise<void> {
  const runtimeEnv = getValidatedServerBootEnv();
  const authService = new AuthService({
    jwtRefreshSecret: runtimeEnv.jwtRefreshSecret,
    jwtSecret: runtimeEnv.jwtSecret,
  });
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
    logger: app.log.child({
      scope: 'realtime',
    }),
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
  const unregisterProcessErrorHandlers = registerProcessErrorHandlers(
    app.log.child({
      scope: 'process',
    }),
  );

  const shutdown = async (signal: NodeJS.Signals | 'bootstrap_error') => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    app.log.info({ signal }, 'Encerrando CS Rio server.');
    unregisterProcessErrorHandlers();
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
        port: runtimeEnv.port,
      }),
      realtimeServer.listen(runtimeEnv.colyseusPort),
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
        apiPort: runtimeEnv.port,
        colyseusPort: runtimeEnv.colyseusPort,
      },
      'CS Rio server bootstrap concluido',
    );
  } catch (error) {
    await shutdown('bootstrap_error');
    if (error instanceof InvalidEnvironmentError) {
      app.log.error(
        {
          issues: error.issues,
        },
        error.message,
      );
    } else {
      app.log.error(error);
    }
    process.exit(1);
  }
}

void main();
