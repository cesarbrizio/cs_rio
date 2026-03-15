import type {
  HospitalizationReason,
  OverdoseTrigger,
  PlayerHospitalizationStatus,
  PlayerPrisonStatus,
} from '@cs-rio/shared';

export interface HospitalizationStatusReaderContract {
  close?(): Promise<void>;
  getHospitalizationStatus(playerId: string): Promise<PlayerHospitalizationStatus>;
}

export interface HospitalizationSystemContract extends HospitalizationStatusReaderContract {
  hospitalize(
    playerId: string,
    input: {
      durationMs: number;
      reason: HospitalizationReason;
      trigger?: OverdoseTrigger | null;
    },
  ): Promise<PlayerHospitalizationStatus>;
}

export interface PrisonStatusReaderContract {
  close?(): Promise<void>;
  getStatus(playerId: string): Promise<PlayerPrisonStatus>;
}

export async function assertPlayerActionUnlocked<E extends Error>(input: {
  getHospitalizationStatus?: (() => Promise<PlayerHospitalizationStatus>) | null;
  getPrisonStatus?: (() => Promise<PlayerPrisonStatus>) | null;
  hospitalizedError?: (() => E) | null;
  imprisonedError?: (() => E) | null;
}): Promise<void> {
  const [hospitalization, prison] = await Promise.all([
    input.getHospitalizationStatus?.() ?? null,
    input.getPrisonStatus?.() ?? null,
  ]);

  if (hospitalization?.isHospitalized) {
    throw (
      input.hospitalizedError?.() ??
      new Error('Jogador hospitalizado nao pode executar a acao.')
    );
  }

  if (prison?.isImprisoned) {
    throw (
      input.imprisonedError?.() ??
      new Error('Jogador preso nao pode executar a acao.')
    );
  }
}
