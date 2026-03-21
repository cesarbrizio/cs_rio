import { type FactionRealtimeSnapshot } from '../services/factionRealtime';
import { colors } from '../theme/colors';

export function parsePositiveAmount(value: string): number | null {
  const normalized = Number.parseInt(value.replace(/\D+/gu, ''), 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

export function resolveRealtimeStatusLabel(status: FactionRealtimeSnapshot['status']): string {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'connecting':
      return 'Conectando';
    case 'reconnecting':
      return 'Reconectando';
    case 'disconnected':
    default:
      return 'Offline';
  }
}

export function resolveRealtimeStatusColor(status: FactionRealtimeSnapshot['status']): string {
  switch (status) {
    case 'connected':
      return colors.success;
    case 'connecting':
    case 'reconnecting':
      return colors.warning;
    case 'disconnected':
    default:
      return colors.danger;
  }
}

export function buildRealtimeStatusCopy(status: FactionRealtimeSnapshot['status']): string {
  switch (status) {
    case 'connected':
      return 'Sala aberta. Chat, chamados e presença online aparecem aqui.';
    case 'connecting':
      return 'Conectando a sala da facção. Assim que abrir, o chat e os chamados começam a aparecer aqui.';
    case 'reconnecting':
      return 'Reconectando a sala da facção. O feed pode atrasar por alguns segundos enquanto a sala volta.';
    case 'disconnected':
    default:
      return 'Sala offline no momento. Atualize o painel ou reabra o QG para reconectar.';
  }
}

export function formatDateTimeLabel(value: string): string {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
  });
}
