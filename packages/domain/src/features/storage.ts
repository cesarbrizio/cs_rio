export function warnStorageFallback(
  scope: string,
  message: string,
  error?: unknown,
): void {
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? ` Motivo: ${error.message.trim()}`
      : '';
  console.warn(`[storage] ${scope}: ${message}.${detail}`);
}

export function parseStoredStringArray(raw: string | null): string[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch (error) {
    warnStorageFallback(
      'parseStoredStringArray',
      'falha ao interpretar JSON persistido; usando array vazio',
      error,
    );
    return [];
  }
}
