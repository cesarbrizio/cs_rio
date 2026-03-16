import cors from '@fastify/cors';
import Fastify from 'fastify';

import { createApiRoutes } from './api/routes/index.js';
import { HTTP_BODY_LIMIT_BYTES, installHttpInputHardening } from './api/http-hardening.js';
import { installGlobalHttpErrorHandler } from './api/http-errors.js';
import { resolveCorsOptions } from './config/cors.js';
import { env, resolveTrustedProxyList } from './config/env.js';
import {
  createServiceContainer,
  type CreateServiceContainerOptions,
} from './container.js';
import { bindRequestContext, refreshRequestContext } from './observability/request-context.js';

export type CreateAppOptions = CreateServiceContainerOptions;

export function resolveFastifyTrustProxy(
  input: string | string[] | false | null | undefined = env.trustProxy,
): boolean | string | string[] {
  return resolveTrustedProxyList(input);
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = Fastify({
    bodyLimit: HTTP_BODY_LIMIT_BYTES,
    logger: true,
    requestIdHeader: 'x-request-id',
    trustProxy: resolveFastifyTrustProxy(),
  });
  const container = createServiceContainer(options);

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
    await container.close();
  });

  await app.register(createApiRoutes(container), {
    prefix: '/api',
  });

  return app;
}
