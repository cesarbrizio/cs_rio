export interface BrowserWritableFileHandle {
  createWritable: () => Promise<{
    close: () => Promise<void>;
    write: (contents: string) => Promise<void>;
  }>;
  getFile: () => Promise<File>;
  name?: string;
}

interface SaveFilePickerOptions {
  suggestedName?: string;
  types?: Array<{
    accept: Record<string, string[]>;
    description?: string;
  }>;
}

function getWindowWithFileSystemAccess() {
  return window as Window & {
    showSaveFilePicker?: (
      options?: SaveFilePickerOptions,
    ) => Promise<BrowserWritableFileHandle>;
  };
}

export function ensureJsonFileName(
  fileName: string,
  fallback = 'mapa.json',
) {
  const trimmedName = fileName.trim();

  if (trimmedName.length === 0) {
    return fallback;
  }

  return trimmedName.toLowerCase().endsWith('.json')
    ? trimmedName
    : `${trimmedName}.json`;
}

export function supportsFileSystemSave() {
  return typeof getWindowWithFileSystemAccess().showSaveFilePicker === 'function';
}

export async function showJsonSaveFilePicker(
  suggestedName: string,
) {
  const fileSystemWindow = getWindowWithFileSystemAccess();

  if (!fileSystemWindow.showSaveFilePicker) {
    return null;
  }

  return fileSystemWindow.showSaveFilePicker({
    suggestedName: ensureJsonFileName(suggestedName),
    types: [
      {
        accept: {
          'application/json': ['.json'],
        },
        description: 'Tiled JSON',
      },
    ],
  });
}

export async function writeTextToFileHandle(
  fileHandle: BrowserWritableFileHandle,
  contents: string,
) {
  const writable = await fileHandle.createWritable();
  await writable.write(contents);
  await writable.close();
}

export function downloadTextFile(input: {
  contents: string;
  fileName: string;
  mimeType?: string;
}) {
  const blob = new Blob([input.contents], {
    type: input.mimeType ?? 'application/json',
  });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = objectUrl;
  link.download = ensureJsonFileName(input.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}
