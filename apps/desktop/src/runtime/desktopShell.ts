export type DesktopDisplayMode = 'borderless' | 'fullscreen' | 'windowed';
export type DesktopGraphicsDetailLevel = 'balanced' | 'high' | 'low';

export interface DesktopResolutionPreset {
  height: number;
  id: string;
  label: string;
  width: number;
}

export type DesktopShortcutActionId =
  | 'close_or_back'
  | 'confirm_action'
  | 'toggle_panel'
  | 'toggle_fullscreen'
  | 'quit_app'
  | 'open_inventory'
  | 'open_crimes'
  | 'open_map'
  | 'quick_nav_1'
  | 'quick_nav_2'
  | 'quick_nav_3'
  | 'quick_nav_4'
  | 'quick_nav_5'
  | 'quick_nav_6'
  | 'quick_nav_7'
  | 'quick_nav_8'
  | 'quick_nav_9';

export type DesktopShortcutMap = Record<DesktopShortcutActionId, string>;

export const DESKTOP_RESOLUTION_PRESETS: DesktopResolutionPreset[] = [
  { height: 720, id: '1280x720', label: 'HD 1280 x 720', width: 1280 },
  { height: 900, id: '1600x900', label: 'HD+ 1600 x 900', width: 1600 },
  { height: 1080, id: '1920x1080', label: 'Full HD 1920 x 1080', width: 1920 },
  { height: 1440, id: '2560x1440', label: 'QHD 2560 x 1440', width: 2560 },
];
export const DEFAULT_DESKTOP_RESOLUTION_PRESET = DESKTOP_RESOLUTION_PRESETS[0]!;

export const DESKTOP_FPS_CAP_OPTIONS = [30, 60, 90, 120] as const;

export const DESKTOP_SHORTCUT_LABELS: Record<DesktopShortcutActionId, string> = {
  close_or_back: 'Fechar modal / voltar',
  confirm_action: 'Confirmar acao',
  open_crimes: 'Abrir crimes',
  open_inventory: 'Abrir inventario',
  open_map: 'Abrir mapa',
  quick_nav_1: 'Navegacao rapida 1',
  quick_nav_2: 'Navegacao rapida 2',
  quick_nav_3: 'Navegacao rapida 3',
  quick_nav_4: 'Navegacao rapida 4',
  quick_nav_5: 'Navegacao rapida 5',
  quick_nav_6: 'Navegacao rapida 6',
  quick_nav_7: 'Navegacao rapida 7',
  quick_nav_8: 'Navegacao rapida 8',
  quick_nav_9: 'Navegacao rapida 9',
  quit_app: 'Sair do app',
  toggle_fullscreen: 'Alternar fullscreen',
  toggle_panel: 'Alternar painel',
};

export const DEFAULT_DESKTOP_SHORTCUTS: DesktopShortcutMap = {
  close_or_back: 'Escape',
  confirm_action: 'Enter',
  open_crimes: 'KeyC',
  open_inventory: 'KeyE',
  open_map: 'KeyM',
  quick_nav_1: 'Digit1',
  quick_nav_2: 'Digit2',
  quick_nav_3: 'Digit3',
  quick_nav_4: 'Digit4',
  quick_nav_5: 'Digit5',
  quick_nav_6: 'Digit6',
  quick_nav_7: 'Digit7',
  quick_nav_8: 'Digit8',
  quick_nav_9: 'Digit9',
  quit_app: 'Ctrl+KeyQ',
  toggle_fullscreen: 'F11',
  toggle_panel: 'Tab',
};

export function formatDesktopShortcut(binding: string): string {
  return binding
    .replace(/^Ctrl\+/, 'Ctrl + ')
    .replace(/^Shift\+/, 'Shift + ')
    .replace(/^Alt\+/, 'Alt + ')
    .replace(/^Meta\+/, 'Meta + ')
    .replace(/\+Key/g, ' + ')
    .replace(/^Key/, '')
    .replace(/\+Digit/g, ' + ')
    .replace(/^Digit/, '')
    .replace('Space', 'Espaco');
}

export function captureDesktopShortcut(event: KeyboardEvent): string | null {
  if (isModifierCode(event.code)) {
    return null;
  }

  const parts: string[] = [];

  if (event.ctrlKey) {
    parts.push('Ctrl');
  }

  if (event.shiftKey) {
    parts.push('Shift');
  }

  if (event.altKey) {
    parts.push('Alt');
  }

  if (event.metaKey) {
    parts.push('Meta');
  }

  parts.push(event.code);

  return parts.join('+');
}

export function matchDesktopShortcut(event: KeyboardEvent, binding: string): boolean {
  const parts = binding.split('+').filter(Boolean);
  const code = parts.at(-1);

  if (!code) {
    return false;
  }

  const expectsCtrl = parts.includes('Ctrl');
  const expectsShift = parts.includes('Shift');
  const expectsAlt = parts.includes('Alt');
  const expectsMeta = parts.includes('Meta');

  return (
    event.code === code &&
    event.ctrlKey === expectsCtrl &&
    event.shiftKey === expectsShift &&
    event.altKey === expectsAlt &&
    event.metaKey === expectsMeta
  );
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tagName = target.tagName.toLowerCase();

  return tagName === 'input' || tagName === 'select' || tagName === 'textarea';
}

export function resolveResolutionPreset(
  presetId: string,
): DesktopResolutionPreset {
  return (
    DESKTOP_RESOLUTION_PRESETS.find((preset) => preset.id === presetId) ??
    DEFAULT_DESKTOP_RESOLUTION_PRESET
  );
}

function isModifierCode(code: string): boolean {
  return (
    code === 'AltLeft' ||
    code === 'AltRight' ||
    code === 'ControlLeft' ||
    code === 'ControlRight' ||
    code === 'MetaLeft' ||
    code === 'MetaRight' ||
    code === 'ShiftLeft' ||
    code === 'ShiftRight'
  );
}
