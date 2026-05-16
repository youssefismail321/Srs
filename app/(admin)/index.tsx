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
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import EmptyState from '@/components/EmptyState';
import LoadingScreen from '@/components/LoadingScreen';
import ConfirmDialog from '@/components/ConfirmDialog';
import { colors, radius, spacing } from '@/constants/theme';
import { Profile, UserRole } from '@/types';

type RoleFilter = 'all' | 'community_member' | 'facility_manager' | 'worker';
type ActionType = 'deactivate' | 'reactivate' | 'delete';

interface PendingAction {
  type: ActionType;
  user: Profile;
}

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string; avatarBg: string }> = {
  community_member: {
    label: 'Member',
    bg: 'rgba(148,163,184,0.15)',
    text: colors.textSec,
    avatarBg: colors.textMuted,
  },
  facility_manager: {
    label: 'Manager',
    bg: colors.warningBg,
    text: colors.warning,
    avatarBg: colors.warning,
  },
  worker: {
    label: 'Worker',
    bg: colors.inProgressBg,
    text: colors.inProgress,
    avatarBg: colors.inProgress,
  },
  admin: {
    label: 'Admin',
    bg: 'rgba(99,102,241,0.15)',
    text: colors.primary,
    avatarBg: colors.accent,
  },
};

const FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all',              label: 'All' },
  { key: 'community_member', label: 'Members' },
  { key: 'facility_manager', label: 'Managers' },
  { key: 'worker',           label: 'Workers' },
];

const ACTION_CONFIG: Record<ActionType, { title: string; confirmLabel: string; danger: boolean; getMessage: (name: string) => string }> = {
  deactivate: {
    title: 'Deactivate Account',
    confirmLabel: 'Deactivate',
    danger: false,
    getMessage: name => `This will prevent ${name} from accessing CampusCare until reactivated.`,
  },
  reactivate: {
    title: 'Reactivate Account',
    confirmLabel: 'Reactivate',
    danger: false,
    getMessage: name => `This will restore ${name}'s access to CampusCare.`,
  },
  delete: {
    title: 'Delete Account',
    confirmLabel: 'Delete',
    danger: true,
    getMessage: name => `Permanently delete ${name}'s account? All their data will be removed. This cannot be undone.`,
  },
};

export default function AdminUsersScreen() {
  const { profile: adminProfile, session } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchProfiles() {
    try {
      const data = await api.get<Profile[]>('/api/users', session!);
      setProfiles(data);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(useCallback(() => { fetchProfiles(); }, []));

  async function onRefresh() {
    setRefreshing(true);
    await fetchProfiles();
  }

  const filteredProfiles = useMemo(() => {
    return profiles
      .filter(p => roleFilter === 'all' || p.role === roleFilter)
      .filter(p => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
      });
  }, [profiles, roleFilter, search]);

  async function handleConfirm() {
    if (!pendingAction || !session) return;
    setActionLoading(true);
    const { type, user } = pendingAction;
    try {
      if (type === 'deactivate') {
        await api.patch(`/api/users/${user.id}`, { is_active: false }, session);
        setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, is_active: false } : p));
        setPendingAction(null);
        Alert.alert('Deactivated', `${user.name} can no longer log in.`);

      } else if (type === 'reactivate') {
        await api.patch(`/api/users/${user.id}`, { is_active: true }, session);
        setProfiles(prev => prev.map(p => p.id === user.id ? { ...p, is_active: true } : p));
        setPendingAction(null);
        Alert.alert('Activated', `${user.name} can log in again.`);

      } else if (type === 'delete') {
        await api.delete(`/api/users/${user.id}`, session);
        setProfiles(prev => prev.filter(p => p.id !== user.id));
        setPendingAction(null);
        Alert.alert('Deleted', `${user.name} has been permanently removed.`);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Action failed');
      setPendingAction(null);
    } finally {
      setActionLoading(false);
    }
  }

  const dialogCfg = pendingAction ? ACTION_CONFIG[pendingAction.type] : null;

  if (loading) return <LoadingScreen message="Loading users..." />;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.roleLabel}>System Admin</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Users</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{profiles.length}</Text>
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
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
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
          const active = roleFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setRoleFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filteredProfiles}
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
            icon="people-outline"
            title={search || roleFilter !== 'all' ? 'No matching users' : 'No users found'}
            subtitle={search || roleFilter !== 'all' ? 'Try adjusting your search or filter.' : 'No profiles in the system yet.'}
          />
        }
        renderItem={({ item }) => {
          const isOwn = item.id === adminProfile?.id;
          const cfg = ROLE_CONFIG[item.role];
          const initial = item.name.charAt(0).toUpperCase();
          const avatarBg = isOwn ? colors.primary : cfg.avatarBg;

          return (
            <View style={[styles.userCard, !item.is_active && styles.userCardInactive]}>
              {/* Avatar */}
              <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

              {/* Info */}
              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                  {isOwn && (
                    <View style={styles.youBadge}>
                      <Text style={styles.youBadgeText}>🔒 You</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.roleText, { color: cfg.text }]}>{cfg.label}</Text>
                  </View>
                  {!item.is_active && (
                    <View style={styles.inactiveBadge}>
                      <Text style={styles.inactiveText}>Inactive</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Actions — hidden for own account */}
              {!isOwn && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: item.is_active ? colors.warning + '50' : colors.success + '50' }]}
                    onPress={() => setPendingAction({ type: item.is_active ? 'deactivate' : 'reactivate', user: item })}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={item.is_active ? 'pause-outline' : 'play-outline'}
                      size={16}
                      color={item.is_active ? colors.warning : colors.success}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.error + '50' }]}
                    onPress={() => setPendingAction({ type: 'delete', user: item })}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="trash-outline" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      />

      {pendingAction && dialogCfg && (
        <ConfirmDialog
          visible
          title={dialogCfg.title}
          message={dialogCfg.getMessage(pendingAction.user.name)}
          confirmLabel={actionLoading ? 'Please wait…' : dialogCfg.confirmLabel}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirm}
          danger={dialogCfg.danger}
        />
      )}
    </SafeAreaView>
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
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userCardInactive: { opacity: 0.65 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1, gap: 3, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  userName: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  youBadge: {
    backgroundColor: colors.inProgressBg,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  youBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  userEmail: { color: colors.textMuted, fontSize: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', marginTop: 2 },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  roleText: { fontSize: 11, fontWeight: '600' },
  inactiveBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.errorBg,
  },
  inactiveText: { color: colors.error, fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'column', gap: spacing.xs, flexShrink: 0 },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
