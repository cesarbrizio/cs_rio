export function resolveHospitalCycleKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  // Pre-alpha simplification until rodada turnover is implemented.
  return `pre_alpha_${year}_${month}`;
}
