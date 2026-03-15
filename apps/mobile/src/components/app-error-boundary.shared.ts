export interface AppErrorBoundaryState {
  errorMessage: string;
  hasError: boolean;
}

export function normalizeAppRenderError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : '';

  if (!message) {
    return 'O app encontrou um erro inesperado e abriu um modo de recuperação.';
  }

  return message.length > 160
    ? 'O app encontrou um erro inesperado e abriu um modo de recuperação.'
    : message;
}

export function deriveAppErrorBoundaryState(error: unknown): AppErrorBoundaryState {
  return {
    errorMessage: normalizeAppRenderError(error),
    hasError: true,
  };
}
