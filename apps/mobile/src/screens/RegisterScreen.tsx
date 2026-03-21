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

type RegisterScreenProps = NativeStackScreenProps<RootStackParamList, 'Register'>;

export function RegisterScreen({ navigation }: RegisterScreenProps): JSX.Element {
  const isLoading = useAuthStore((state) => state.isLoading);
  const register = useAuthStore((state) => state.register);
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setErrorMessage(null);
      await register({
        confirmPassword,
        email,
        nickname,
        password,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha inesperada no registro.');
    }
  };

  return (
    <AuthScreenLayout
      actionLabel="Registrar e entrar"
      footerCopy="Já tem conta?"
      footerLabel="Voltar para login"
      helperText="Criando a conta, o app já abre sua sessão e cai no fluxo do personagem."
      isLoading={isLoading}
      onActionPress={handleSubmit}
      onFooterPress={() => navigation.navigate('Login')}
      subtitle="Nickname único, email válido e senha forte."
      title="Registro"
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
        label="Nickname"
        onChangeText={setNickname}
        placeholder="3-16 caracteres"
        value={nickname}
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
      <AuthField
        autoCapitalize="none"
        isPasswordField
        isPasswordVisible={isConfirmPasswordVisible}
        label="Confirmar senha"
        onChangeText={setConfirmPassword}
        onTogglePasswordVisibility={() => setIsConfirmPasswordVisible((current) => !current)}
        placeholder="Repita a senha"
        value={confirmPassword}
      />
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      <View style={styles.hintRow}>
        <Text style={styles.hintLabel}>Auto-login</Text>
        <Text style={styles.hintCopy}>Se o registro passar, o app carrega o perfil e navega sem etapa extra.</Text>
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
