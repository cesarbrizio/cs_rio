import { type AuthContext } from 'colyseus';

export function resolveRealtimeAccessToken(
  options: Record<string, unknown>,
  context: AuthContext,
): string | null {
  const optionToken =
    typeof options.accessToken === 'string'
      ? options.accessToken
      : typeof options.token === 'string'
        ? options.token
        : null;
  const contextToken = typeof context.token === 'string' ? context.token : null;
  const headerToken = extractBearerToken(context.headers);
  const resolvedToken = contextToken ?? optionToken ?? headerToken;

  return resolvedToken?.trim() || null;
}

function extractBearerToken(headers: Headers): string | null {
  const authorization = headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
}
