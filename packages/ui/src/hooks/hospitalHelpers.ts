import {
  type CharacterAppearance,
  type HospitalCenterResponse,
  type HospitalServiceAvailability,
  type HospitalStatItemOffer,
  type PlayerHospitalizationStatus,
} from '@cs-rio/shared';

export const HOSPITAL_SKIN_OPTIONS = [
  { id: 'pele_clara', label: 'Clara', swatch: '#f3c9a3' },
  { id: 'pele_media', label: 'Media', swatch: '#d7a070' },
  { id: 'pele_escura', label: 'Escura', swatch: '#8b5d3c' },
] as const;

export const HOSPITAL_HAIR_OPTIONS = [
  { id: 'corte_curto', label: 'Curto' },
  { id: 'tranca_media', label: 'Tranca' },
  { id: 'raspado', label: 'Raspado' },
] as const;

export const HOSPITAL_OUTFIT_OPTIONS = [
  { id: 'camisa_branca', label: 'Basica' },
  { id: 'camisa_flamengo', label: 'Fla' },
  { id: 'colete_preto', label: 'Colete' },
] as const;

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  maximumFractionDigits: 0,
  style: 'currency',
});

export function buildHospitalServiceCopy(
  serviceId: 'detox' | 'healthPlan' | 'surgery' | 'treatment',
  availability: HospitalServiceAvailability,
): string {
  if (availability.reason) {
    return availability.reason;
  }

  if (!availability.available) {
    return 'Indisponivel agora.';
  }

  if (serviceId === 'healthPlan') {
    return `Ativa o plano deste ciclo por ${availability.creditsCost ?? 0} creditos.`;
  }

  if (serviceId === 'surgery') {
    return `Atualiza nickname e aparencia por ${availability.creditsCost ?? 0} creditos.`;
  }

  return `Disponivel agora por ${formatHospitalCurrency(availability.moneyCost ?? 0)}.`;
}

export function buildHospitalStatItemCopy(offer: HospitalStatItemOffer): string {
  if (offer.reason) {
    return offer.reason;
  }

  if (!offer.available) {
    return 'Indisponivel neste momento.';
  }

  return `${formatHospitalCurrency(offer.costMoney)} · restam ${offer.remainingInCurrentCycle}/${offer.limitPerCycle} neste ciclo.`;
}

export function formatHospitalCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatHospitalizationReason(
  hospitalization: PlayerHospitalizationStatus,
): string {
  if (!hospitalization.isHospitalized || !hospitalization.reason) {
    return 'Nenhuma internacao ativa.';
  }

  if (hospitalization.reason === 'combat') {
    return 'Internacao por combate.';
  }

  if (hospitalization.trigger === 'cansaco_overflow') {
    return 'Overdose por excesso de cansaco.';
  }

  if (hospitalization.trigger === 'max_addiction') {
    return 'Overdose por vicio extremo.';
  }

  if (hospitalization.trigger === 'poly_drug_mix') {
    return 'Overdose por mistura de drogas.';
  }

  return 'Internacao por overdose.';
}

export function formatHospitalRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return 'Alta imediata';
  }

  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function getLiveHospitalizationStatus(
  hospitalization: PlayerHospitalizationStatus,
  nowMs: number,
): PlayerHospitalizationStatus {
  if (!hospitalization.isHospitalized || !hospitalization.endsAt) {
    return hospitalization;
  }

  const endsAtMs = new Date(hospitalization.endsAt).getTime();
  const remainingSeconds = Math.max(0, Math.ceil((endsAtMs - nowMs) / 1000));

  return {
    ...hospitalization,
    isHospitalized: remainingSeconds > 0,
    remainingSeconds,
  };
}

export function hasSurgeryChanges(
  currentAppearance: CharacterAppearance,
  currentNickname: string,
  draftAppearance: CharacterAppearance,
  draftNickname: string,
): boolean {
  const normalizedCurrentNickname = currentNickname.trim();
  const normalizedDraftNickname = draftNickname.trim();

  return (
    normalizedCurrentNickname !== normalizedDraftNickname ||
    currentAppearance.skin !== draftAppearance.skin ||
    currentAppearance.hair !== draftAppearance.hair ||
    currentAppearance.outfit !== draftAppearance.outfit
  );
}

export function hasImmediateHospitalActions(center: HospitalCenterResponse | null): boolean {
  if (!center) {
    return false;
  }

  return Object.values(center.services).some((service) => service.available);
}
