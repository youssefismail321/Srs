import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import StatusBadge from '@/components/StatusBadge';
import Button from '@/components/Button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { colors, radius, spacing } from '@/constants/theme';
import { Assignment, Issue, IssueCategory, Profile } from '@/types';

const CATEGORY_CONFIG: Record<IssueCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  maintenance:    { icon: 'construct-outline',                  color: '#F59E0B', label: 'Maintenance' },
  infrastructure: { icon: 'business-outline',                   color: '#6366F1', label: 'Infrastructure' },
  sustainability: { icon: 'leaf-outline',                       color: '#10B981', label: 'Sustainability' },
  cleanliness:    { icon: 'water-outline',                      color: '#38BDF8', label: 'Cleanliness' },
  other:          { icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8', label: 'Other' },
};

export default function ManagerIssueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile: manager } = useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [assignExpanded, setAssignExpanded] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  async function loadData() {
    const [issueRes, assignmentRes] = await Promise.all([
      supabase.from('issues').select('*').eq('id', id).single(),
      supabase
        .from('assignments')
        .select('*, worker:profiles!worker_id(id,name,email,role,is_active,created_at,updated_at)')
        .eq('issue_id', id)
        .maybeSingle(),
    ]);

    if (issueRes.data) setIssue(issueRes.data as Issue);
    if (assignmentRes.data) {
      setAssignment(assignmentRes.data as unknown as Assignment);
      setSelectedWorkerId((assignmentRes.data as any).worker_id ?? null);
    } else {
      setAssignment(null);
    }
  }

  async function loadWorkers() {
    const { data } = await supabase
      .from('profiles')
      .select('id,name,email,role,is_active,created_at,updated_at')
      .eq('role', 'worker')
      .eq('is_active', true)
      .order('name');
    setWorkers((data as Profile[]) ?? []);
  }

  useEffect(() => {
    Promise.all([loadData(), loadWorkers()]).finally(() => setLoading(false));
  }, [id]);

  async function confirmAssignment() {
    if (!selectedWorkerId || !manager || !issue) return;
    setAssignLoading(true);
    try {
      await supabase.from('assignments').delete().eq('issue_id', issue.id);

      const { error: insertErr } = await supabase.from('assignments').insert({
        issue_id: issue.id,
        worker_id: selectedWorkerId,
        assigned_by: manager.id,
        assigned_at: new Date().toISOString(),
      });
      if (insertErr) { Alert.alert('Error', insertErr.message); return; }

      if (issue.status === 'pending') {
        await supabase.from('issues').update({ status: 'in_progress' }).eq('id', issue.id);
        await supabase.from('status_history').insert({
          issue_id: issue.id,
          old_status: 'pending',
          new_status: 'in_progress',
          changed_by: manager.id,
          changed_at: new Date().toISOString(),
        });
      }

      await loadData();
      setAssignExpanded(false);
    } finally {
      setAssignLoading(false);
    }
  }

  async function markInProgress() {
    if (!manager || !issue) return;
    setActionLoading(true);
    try {
      const oldStatus = issue.status;
      const { error } = await supabase.from('issues').update({ status: 'in_progress' }).eq('id', issue.id);
      if (error) { Alert.alert('Error', error.message); return; }
      await supabase.from('status_history').insert({
        issue_id: issue.id,
        old_status: oldStatus,
        new_status: 'in_progress',
        changed_by: manager.id,
        changed_at: new Date().toISOString(),
      });
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function closeIssue() {
    if (!manager || !issue) return;
    setActionLoading(true);
    try {
      const oldStatus = issue.status;
      const { error } = await supabase.from('issues').update({ status: 'resolved' }).eq('id', issue.id);
      if (error) { Alert.alert('Error', error.message); return; }
      await supabase.from('status_history').insert({
        issue_id: issue.id,
        old_status: oldStatus,
        new_status: 'resolved',
        changed_by: manager.id,
        changed_at: new Date().toISOString(),
      });
      setCloseConfirm(false);
      await loadData();
    } finally {
      setActionLoading(false);
    }
  }

  async function deleteIssue() {
    if (!issue) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.from('issues').delete().eq('id', issue.id);
      if (error) { Alert.alert('Error', error.message); return; }
      setDeleteConfirm(false);
      router.back();
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!issue) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ color: colors.textSec, textAlign: 'center', marginTop: 80 }}>Issue not found.</Text>
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_CONFIG[issue.category];
  const currentWorker = assignment?.worker;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{issue.title}</Text>
        <StatusBadge status={issue.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero image */}
        {issue.image_url ? (
          <Image source={{ uri: issue.image_url }} style={styles.hero} resizeMode="cover" />
        ) : null}

        {/* Title + meta */}
        <View style={styles.section}>
          <Text style={styles.issueTitle}>{issue.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>{issue.location}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={styles.metaText}>
              {formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}
            </Text>
          </View>
          <View style={[styles.categoryBadge, { backgroundColor: `${cat.color}18` }]}>
            <Ionicons name={cat.icon} size={14} color={cat.color} />
            <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
          </View>
        </View>

        {/* Description */}
        {issue.description ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Description</Text>
            <Text style={styles.description}>{issue.description}</Text>
          </View>
        ) : null}

        {/* Assign Worker */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Assign Worker</Text>

          {/* Collapsed row */}
          <TouchableOpacity
            style={styles.assignRow}
            onPress={() => setAssignExpanded(v => !v)}
            activeOpacity={0.75}
          >
            {currentWorker ? (
              <View style={styles.workerMini}>
                <View style={styles.workerAvatarSm}>
                  <Text style={styles.workerInitialSm}>{currentWorker.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.workerNameSm}>{currentWorker.name}</Text>
              </View>
            ) : (
              <Text style={styles.assignPrompt}>Tap to assign a worker</Text>
            )}
            <Ionicons
              name={assignExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </TouchableOpacity>

          {/* Expanded panel */}
          {assignExpanded && (
            <View style={styles.workerList}>
              {workers.length === 0 ? (
                <Text style={styles.noWorkers}>No active workers available.</Text>
              ) : (
                workers.map(w => {
                  const selected = selectedWorkerId === w.id;
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={[styles.workerRow, selected && styles.workerRowSelected]}
                      onPress={() => setSelectedWorkerId(w.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.workerAvatar, selected && { backgroundColor: colors.primary }]}>
                        <Text style={styles.workerInitial}>{w.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.workerName, selected && { color: colors.text }]}>{w.name}</Text>
                      {selected && (
                        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
              <Button
                label="Confirm Assignment"
                onPress={confirmAssignment}
                loading={assignLoading}
                disabled={!selectedWorkerId}
                style={{ marginTop: spacing.sm }}
              />
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Actions</Text>
          <View style={styles.actionsGap}>
            {issue.status === 'pending' && (
              <Button
                label="Mark In Progress"
                variant="secondary"
                onPress={markInProgress}
                loading={actionLoading}
              />
            )}
            {issue.status !== 'resolved' && (
              <Button
                label="Close Issue"
                variant="secondary"
                onPress={() => setCloseConfirm(true)}
                loading={actionLoading}
              />
            )}
            <Button
              label="Delete Issue"
              variant="danger"
              onPress={() => setDeleteConfirm(true)}
              loading={actionLoading}
            />
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={closeConfirm}
        title="Close Issue"
        message="Mark this issue as resolved? This will update its status to Resolved."
        confirmLabel="Close Issue"
        onCancel={() => setCloseConfirm(false)}
        onConfirm={closeIssue}
      />

      <ConfirmDialog
        visible={deleteConfirm}
        title="Delete Issue"
        message={`Permanently delete "${issue.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        onCancel={() => setDeleteConfirm(false)}
        onConfirm={deleteIssue}
        danger
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: { width: '100%', height: 220, borderRadius: radius.lg },
  section: { gap: spacing.sm },
  issueTitle: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { color: colors.textMuted, fontSize: 13 },
  metaDot: { color: colors.textMuted },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  categoryLabel: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeading: {
    color: colors.textSec,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  description: { color: colors.text, fontSize: 14, lineHeight: 22 },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assignPrompt: { color: colors.textMuted, fontSize: 14 },
  workerMini: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  workerAvatarSm: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitialSm: { color: colors.text, fontSize: 12, fontWeight: '700' },
  workerNameSm: { color: colors.text, fontSize: 14, fontWeight: '600' },
  workerList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  noWorkers: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: spacing.sm },
  workerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
  },
  workerRowSelected: { backgroundColor: colors.inProgressBg, borderWidth: 1, borderColor: colors.primary },
  workerAvatar: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    backgroundColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitial: { color: colors.text, fontSize: 15, fontWeight: '700' },
  workerName: { flex: 1, color: colors.textSec, fontSize: 14, fontWeight: '500' },
  actionsGap: { gap: spacing.sm },
});
