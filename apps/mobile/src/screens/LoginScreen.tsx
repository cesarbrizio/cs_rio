import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthScreenLayout } from '../components/AuthScreenLayout';
import { AuthField } from '../components/AuthField';
import { useAuthStore } from '../stores/authStore';
import { colors } from '../theme/colors';
import { type RootStackParamList } from '../../App';

type LoginScreenProps = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: LoginScreenProps): JSX.Element {
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setErrorMessage(null);
      await login({ email, password });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha inesperada no login.');
    }
  };

  return (
    <AuthScreenLayout
      actionLabel="Entrar"
      footerCopy="Ainda não tem conta?"
      footerLabel="Criar agora"
      helperText="Use o backend real da Fase 2 para autenticar e cair direto na criação do personagem."
      isLoading={isLoading}
      onActionPress={handleSubmit}
      onFooterPress={() => navigation.navigate('Register')}
      subtitle="Email, senha e refresh token persistido no dispositivo."
      title="Login"
    >
      <AuthField
        autoCapitalize="none"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        placeholder="email@csrio.com"
        value={email}
      />
      <AuthField
        autoCapitalize="none"
        isPasswordField
        isPasswordVisible={isPasswordVisible}
        label="Senha"
        onChangeText={setPassword}
        onTogglePasswordVisibility={() => setIsPasswordVisible((current) => !current)}
        placeholder="Mínimo 8 caracteres"
        value={password}
      />
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <View style={styles.hintRow}>
        <Text style={styles.hintLabel}>Fluxo atual</Text>
        <Text style={styles.hintCopy}>
          Login autenticado, perfil carregado e entrada direta no jogo ou na criação do personagem.
        </Text>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#ff8f7a',
    fontSize: 13,
    lineHeight: 18,
  },
  hintRow: {
    backgroundColor: '#18130d',
    borderRadius: 14,
    gap: 4,
    padding: 12,
  },
  hintLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hintCopy: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
