import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import IssueCard from '@/components/IssueCard';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import { colors, radius, spacing } from '@/constants/theme';
import { Issue, IssueStatus } from '@/types';

type FilterKey = 'all' | IssueStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',         label: 'All' },
  { key: 'pending',     label: 'Pending' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved' },
];

export default function ManagerIssuesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');

  async function fetchIssues() {
    try {
      const data = await api.get<Issue[]>('/api/issues', session!);
      setIssues(data);
    } catch {
      setIssues([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchIssues(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await fetchIssues();
  }

  const stats = useMemo(() => ({
    pending:     issues.filter(i => i.status === 'pending').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    resolved:    issues.filter(i => i.status === 'resolved').length,
  }), [issues]);

  const filterCounts = useMemo<Record<FilterKey, number>>(() => ({
    all:         issues.length,
    pending:     stats.pending,
    in_progress: stats.in_progress,
    resolved:    stats.resolved,
  }), [issues, stats]);

  const filteredIssues = useMemo(() => {
    return issues
      .filter(i => filter === 'all' || i.status === filter)
      .filter(i => !search.trim() || i.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [issues, filter, search]);

  if (loading) return <LoadingScreen message="Loading issues..." />;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roleLabel}>Facility Manager</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>All Issues</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{issues.length}</Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label="Pending" count={stats.pending} color={colors.warning} bg={colors.warningBg} icon="time-outline" />
        <StatCard label="In Progress" count={stats.in_progress} color={colors.inProgress} bg={colors.inProgressBg} icon="sync-outline" />
        <StatCard label="Resolved" count={stats.resolved} color={colors.resolved} bg={colors.resolvedBg} icon="checkmark-circle-outline" />
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search issues..."
          placeholderTextColor={colors.textMuted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filtersRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f.label}
              </Text>
              <View style={[styles.chipCount, active && styles.chipCountActive]}>
                <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                  {filterCounts[f.key]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredIssues}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="layers-outline"
            title={search || filter !== 'all' ? 'No matching issues' : 'No issues yet'}
            subtitle={search || filter !== 'all' ? 'Try adjusting your search or filter.' : 'No issues have been submitted yet.'}
          />
        }
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onPress={() => router.push(`/(manager)/issue/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </SafeAreaView>
  );
}

function StatCard({
  label,
  count,
  color,
  bg,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: bg, borderColor: color + '30' }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  roleLabel: { color: colors.primary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  countText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  statCount: { fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSec, fontSize: 12, fontWeight: '500' },
  chipTextActive: { color: colors.text, fontWeight: '600' },
  chipCount: {
    backgroundColor: colors.borderLight,
    borderRadius: radius.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  chipCountText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  chipCountTextActive: { color: colors.text },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
});
