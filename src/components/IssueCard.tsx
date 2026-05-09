import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, radius, spacing } from '@/constants/theme';
import { Issue, IssueCategory } from '@/types';
import StatusBadge from './StatusBadge';

interface IssueCardProps {
  issue: Issue;
  onPress: () => void;
}

const CATEGORY_CONFIG: Record<IssueCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  maintenance:     { icon: 'construct-outline',                  color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',   label: 'Maintenance' },
  infrastructure:  { icon: 'business-outline',                   color: '#6366F1', bg: 'rgba(99,102,241,0.15)',   label: 'Infrastructure' },
  sustainability:  { icon: 'leaf-outline',                       color: '#10B981', bg: 'rgba(16,185,129,0.15)',   label: 'Sustainability' },
  cleanliness:     { icon: 'water-outline',                      color: '#38BDF8', bg: 'rgba(56,189,248,0.15)',   label: 'Cleanliness' },
  other:           { icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)', label: 'Other' },
};

export default function IssueCard({ issue, onPress }: IssueCardProps) {
  const cat = CATEGORY_CONFIG[issue.category];
  const timeAgo = formatDistanceToNow(new Date(issue.created_at), { addSuffix: true });

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.78}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: cat.bg }]}>
          <Ionicons name={cat.icon} size={22} color={cat.color} />
        </View>

        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{issue.title}</Text>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.location} numberOfLines={1}>{issue.location}</Text>
          </View>
        </View>

        <StatusBadge status={issue.status} small />
      </View>

      {issue.image_url ? (
        <Image source={{ uri: issue.image_url }} style={styles.image} resizeMode="cover" />
      ) : null}

      <Text style={styles.description} numberOfLines={2}>{issue.description}</Text>

      <View style={styles.footer}>
        <Text style={styles.timeAgo}>{timeAgo}</Text>
        <View style={[styles.categoryChip, { backgroundColor: cat.bg }]}>
          <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  location: {
    color: colors.textMuted,
    fontSize: 12,
    flex: 1,
  },
  image: {
    width: '100%',
    height: 150,
    borderRadius: radius.md,
  },
  description: {
    color: colors.textSec,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeAgo: {
    color: colors.textMuted,
    fontSize: 12,
  },
  categoryChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
