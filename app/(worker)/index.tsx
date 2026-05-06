import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import IssueCard from '@/components/IssueCard';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import { colors, radius, spacing } from '@/constants/theme';
import { Issue } from '@/types';

export default function WorkerTasksScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchTasks() {
    if (!profile) return;

    const { data: assignments, error: assignErr } = await supabase
      .from('assignments')
      .select('issue_id')
      .eq('worker_id', profile.id);

    if (assignErr || !assignments || assignments.length === 0) {
      setIssues([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const issueIds = assignments.map(a => a.issue_id);

    const { data: issuesData } = await supabase
      .from('issues')
      .select('*')
      .in('id', issueIds)
      .order('created_at', { ascending: false });

    setIssues((issuesData as Issue[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { fetchTasks(); }, [profile?.id]));

  async function onRefresh() {
    setRefreshing(true);
    await fetchTasks();
  }

  const stats = useMemo(() => ({
    active:    issues.filter(i => i.status === 'pending' || i.status === 'in_progress').length,
    completed: issues.filter(i => i.status === 'resolved').length,
    total:     issues.length,
  }), [issues]);

  if (loading) return <LoadingScreen message="Loading your tasks..." />;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roleLabel}>Worker Dashboard</Text>
        <Text style={styles.title}>My Tasks</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="Active" count={stats.active} color={colors.inProgress} bg={colors.inProgressBg} icon="flash-outline" />
        <StatCard label="Completed" count={stats.completed} color={colors.resolved} bg={colors.resolvedBg} icon="checkmark-done-outline" />
        <StatCard label="Total" count={stats.total} color={colors.text} bg={colors.card} icon="layers-outline" />
      </View>

      <FlatList
        data={issues}
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
            icon="checkbox-outline"
            title="No tasks assigned"
            subtitle="You have no assigned tasks yet. Check back later."
          />
        }
        renderItem={({ item }) => (
          <IssueCard
            issue={item}
            onPress={() => router.push(`/(worker)/task/${item.id}`)}
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
  roleLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginTop: 2 },
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
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
});
