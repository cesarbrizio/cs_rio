import { Pressable, StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '../theme/colors';

interface AuthFieldProps extends TextInputProps {
  isPasswordField?: boolean;
  isPasswordVisible?: boolean;
  label: string;
  onTogglePasswordVisibility?: () => void;
}

export function AuthField({
  isPasswordField = false,
  isPasswordVisible = false,
  label,
  onTogglePasswordVisibility,
  secureTextEntry,
  ...props
}: AuthFieldProps): JSX.Element {
  const shouldHidePassword = isPasswordField ? !isPasswordVisible : secureTextEntry;

  return (
    <View style={styles.field}>
      <View style={styles.headerRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {isPasswordField && onTogglePasswordVisibility ? (
          <Pressable
            accessibilityRole="button"
            onPress={onTogglePasswordVisibility}
            hitSlop={8}
          >
            <Text style={styles.toggleLabel}>
              {isPasswordVisible ? 'Ocultar' : 'Mostrar'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        placeholderTextColor={colors.muted}
        secureTextEntry={shouldHidePassword}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  input: {
    backgroundColor: '#151515',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
