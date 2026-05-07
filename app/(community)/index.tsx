import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import IssueCard from '@/components/IssueCard';
import ConfirmDialog from '@/components/ConfirmDialog';
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

export default function MyIssuesScreen() {
  const { profile } = useAuth();
  const router = useRouter();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const [deleteTarget, setDeleteTarget] = useState<Issue | null>(null);

  async function fetchIssues() {
    if (!profile) return;
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false });

    if (!error && data) setIssues(data as Issue[]);
    setLoading(false);
    setRefreshing(false);
  }

  useFocusEffect(useCallback(() => { fetchIssues(); }, [profile?.id]));

  async function onRefresh() {
    setRefreshing(true);
    await fetchIssues();
  }

  function handleDeletePress(issue: Issue) {
    if (issue.status !== 'pending') {
      Alert.alert('Cannot Delete', 'Only pending issues can be deleted.');
      return;
    }
    setDeleteTarget(issue);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase.from('issues').delete().eq('id', deleteTarget.id);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setIssues(prev => prev.filter(i => i.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  const filteredIssues = useMemo(() => {
    return issues
      .filter(i => filter === 'all' || i.status === filter)
      .filter(i => !search.trim() || i.title.toLowerCase().includes(search.trim().toLowerCase()));
  }, [issues, filter, search]);

  const firstName = profile?.name.split(' ')[0] ?? '';

  if (loading) return <LoadingScreen message="Loading your issues..." />;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello {firstName} 👋</Text>
          <View style={styles.titleRow}>
            <Text style={styles.title}>My Issues</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{issues.length}</Text>
            </View>
          </View>
        </View>
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
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
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
            icon="document-text-outline"
            title={search || filter !== 'all' ? 'No matching issues' : 'No issues yet'}
            subtitle={search || filter !== 'all' ? 'Try adjusting your search or filter.' : 'Submit an issue using the Submit tab.'}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <IssueCard
              issue={item}
              onPress={() => router.push(`/(community)/issue/${item.id}`)}
            />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeletePress(item)}
              activeOpacity={0.75}
            >
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete Issue"
        message={`Delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        danger
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  greeting: { color: colors.textSec, fontSize: 14 },
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
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.textSec, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: colors.text, fontWeight: '600' },
  listContent: { padding: spacing.lg, paddingTop: spacing.sm, flexGrow: 1 },
  cardWrapper: { gap: spacing.xs },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteBtnText: { color: colors.error, fontSize: 12, fontWeight: '600' },
});
