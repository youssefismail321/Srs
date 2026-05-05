import React, { useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

export default function Input({
  label,
  error,
  hint,
  isPassword = false,
  containerStyle,
  style,
  multiline,
  ...rest
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const borderColor = error ? colors.error : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={[
        styles.inputRow,
        { borderColor },
        multiline ? styles.inputRowMultiline : styles.inputRowSingleLine,
      ]}>
        <TextInput
          {...rest}
          multiline={multiline}
          secureTextEntry={isPassword && !visible}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setVisible(v => !v)} style={styles.eyeBtn}>
            <Ionicons
              name={visible ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textSec,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  inputRowSingleLine: {
    alignItems: 'center',
    height: 52,
  },
  inputRowMultiline: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  eyeBtn: {
    paddingLeft: spacing.sm,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});
