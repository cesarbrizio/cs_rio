import {
  createFixedStatusCodeMapper,
  registerErrorMapper,
} from './http-error-registry.js';

export function registerDefaultHttpErrorMappers(): void {
  registerErrorMapper(
    createFixedStatusCodeMapper('front-store', {
      insufficient_funds: 422,
    }),
  );
  registerErrorMapper(
    createFixedStatusCodeMapper('hospital', {
      insufficient_resources: 402,
    }),
  );
  registerErrorMapper(
    createFixedStatusCodeMapper('puteiro', {
      insufficient_funds: 422,
    }),
  );
  registerErrorMapper(
    createFixedStatusCodeMapper('slot-machine', {
      insufficient_funds: 422,
    }),
  );
}
