import Store from 'electron-store';

export const DESKTOP_RUNTIME_STORAGE_KEY = 'cs_rio_desktop_runtime_v1';

export const desktopStore = new Store<Record<string, string>>({
  name: 'cs-rio-desktop',
});

export function readRuntimeSnapshot(): Record<string, unknown> | null {
  const raw = desktopStore.get(DESKTOP_RUNTIME_STORAGE_KEY);

  if (typeof raw !== 'string') {
    return null;
  }

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function patchRuntimeSnapshot(
  patcher: (current: Record<string, unknown>) => Record<string, unknown>,
): void {
  const current = readRuntimeSnapshot() ?? {};
  const next = patcher(current);

  desktopStore.set(DESKTOP_RUNTIME_STORAGE_KEY, JSON.stringify(next));
}
