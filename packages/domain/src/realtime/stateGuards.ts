interface ForEachKeyValueCollection {
  forEach: (callback: (value: unknown, key: string) => void) => void;
}

interface ForEachValueCollection {
  forEach: (callback: (value: unknown) => void) => void;
}

interface ToArrayCollection {
  toArray: () => unknown[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readString(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

export function readNumber(
  source: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(
  source: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = source[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function collectRealtimeValues(source: unknown): unknown[] {
  if (!source) {
    return [];
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (hasToArray(source)) {
    return source.toArray();
  }

  if (hasValueForEach(source)) {
    const values: unknown[] = [];
    source.forEach((value) => {
      values.push(value);
    });
    return values;
  }

  if (isIterable(source)) {
    return Array.from(source);
  }

  return isRecord(source) ? Object.values(source) : [];
}

export function iterateRealtimeCollection(
  source: unknown,
  callback: (key: string, value: unknown) => void,
): void {
  if (!source) {
    return;
  }

  if (hasKeyValueForEach(source)) {
    source.forEach((value, key) => {
      callback(key, value);
    });
    return;
  }

  if (!isRecord(source)) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    callback(key, value);
  }
}

function hasToArray(value: unknown): value is ToArrayCollection {
  return isRecord(value) && typeof value.toArray === 'function';
}

function hasValueForEach(value: unknown): value is ForEachValueCollection {
  return isRecord(value) && typeof value.forEach === 'function';
}

function hasKeyValueForEach(value: unknown): value is ForEachKeyValueCollection {
  return isRecord(value) && typeof value.forEach === 'function';
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Symbol.iterator in value &&
    typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function'
  );
}
