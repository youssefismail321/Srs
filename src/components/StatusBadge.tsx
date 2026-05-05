import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';
import { IssueStatus } from '@/types';

interface StatusBadgeProps {
  status: IssueStatus;
  small?: boolean;
}

const STATUS_CONFIG: Record<IssueStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending: {
    bg: colors.pendingBg,
    text: colors.pending,
    dot: colors.pending,
    label: 'Pending',
  },
  in_progress: {
    bg: colors.inProgressBg,
    text: colors.inProgress,
    dot: colors.inProgress,
    label: 'In Progress',
  },
  resolved: {
    bg: colors.resolvedBg,
    text: colors.resolved,
    dot: colors.resolved,
    label: 'Resolved',
  },
};

export default function StatusBadge({ status, small = false }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const dotSize = small ? 6 : 8;
  const fontSize = small ? 11 : 12;
  const paddingH = small ? spacing.xs : spacing.sm;
  const paddingV = small ? 2 : 4;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          paddingHorizontal: paddingH,
          paddingVertical: paddingV,
        },
      ]}
    >
      <View
        style={[styles.dot, { width: dotSize, height: dotSize, backgroundColor: config.dot }]}
      />
      <Text style={[styles.label, { color: config.text, fontSize }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  dot: {
    borderRadius: radius.full,
  },
  label: {
    fontWeight: '600',
  },
});
