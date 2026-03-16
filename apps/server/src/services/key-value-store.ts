export interface KeyValueReader {
  get(key: string): Promise<string | null>;
}

export interface KeyValueWriter extends KeyValueReader {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export interface KeyValueAtomic extends KeyValueWriter {
  increment(key: string, ttlSeconds: number): Promise<number>;
  setIfAbsent?(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
}

export interface KeyValueDelete {
  delete?(key: string): Promise<void>;
}

export interface KeyValueLifecycle {
  close?(): Promise<void>;
}

export interface KeyValueStore extends KeyValueAtomic, KeyValueDelete, KeyValueLifecycle {}

export type ManagedKeyValueAtomic = KeyValueAtomic & KeyValueDelete & KeyValueLifecycle;
export type ManagedKeyValueWriter = KeyValueWriter & KeyValueDelete & KeyValueLifecycle;
