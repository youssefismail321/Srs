import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}

const variantStyles: Record<Variant, { bg: string; border?: string }> = {
  primary:   { bg: colors.primary },
  secondary: { bg: colors.cardAlt },
  danger:    { bg: colors.error },
  ghost:     { bg: 'transparent' },
  outline:   { bg: 'transparent', border: colors.border },
};

const variantTextColor: Record<Variant, string> = {
  primary:   colors.text,
  secondary: colors.text,
  danger:    colors.text,
  ghost:     colors.textSec,
  outline:   colors.text,
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  small = false,
}: ButtonProps) {
  const { bg, border } = variantStyles[variant];
  const textColor = variantTextColor[variant];
  const height = small ? 38 : 52;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.base,
        { backgroundColor: bg, height, borderRadius: radius.md },
        border ? { borderWidth: 1, borderColor: border } : null,
        (disabled || loading) ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize: small ? 14 : 16 }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  label: {
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
});
