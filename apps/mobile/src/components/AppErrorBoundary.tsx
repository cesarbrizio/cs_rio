import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  deriveAppErrorBoundaryState,
  type AppErrorBoundaryState,
} from './app-error-boundary.shared';
import { recordRenderFailure } from '../features/mobile-observability';
import { colors } from '../theme/colors';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

const INITIAL_STATE: AppErrorBoundaryState = {
  errorMessage: '',
  hasError: false,
};

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  public constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = INITIAL_STATE;
  }

  public static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return deriveAppErrorBoundaryState(error);
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    recordRenderFailure({
      componentStack: info.componentStack,
      errorMessage: this.state.errorMessage || error.message || 'Falha de render.',
    });
    console.error('[AppErrorBoundary] render failure', error, info.componentStack);
  }

  private readonly handleReset = (): void => {
    this.setState(INITIAL_STATE);
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.shell}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>CS RIO</Text>
          <Text style={styles.title}>Falha de render</Text>
          <Text style={styles.copy}>
            O app entrou em modo de recuperação para não fechar de vez.
          </Text>
          <View style={styles.messageCard}>
            <Text style={styles.messageLabel}>Erro</Text>
            <Text style={styles.messageText}>{this.state.errorMessage}</Text>
          </View>
          <Pressable onPress={this.handleReset} style={styles.button}>
            <Text style={styles.buttonLabel}>Tentar recuperar</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  shell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.line,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    maxWidth: 420,
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  copy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  messageCard: {
    backgroundColor: colors.background,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  messageLabel: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  buttonLabel: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
