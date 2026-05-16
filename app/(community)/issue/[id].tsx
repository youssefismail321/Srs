import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { format, formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import { colors, radius, spacing } from '@/constants/theme';
import { Assignment, Issue, IssueCategory, IssueStatus, StatusHistory } from '@/types';

const CATEGORY_CONFIG: Record<IssueCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  maintenance:    { icon: 'construct-outline',                  color: '#F59E0B', label: 'Maintenance' },
  infrastructure: { icon: 'business-outline',                   color: '#6366F1', label: 'Infrastructure' },
  sustainability: { icon: 'leaf-outline',                       color: '#10B981', label: 'Sustainability' },
  cleanliness:    { icon: 'water-outline',                      color: '#38BDF8', label: 'Cleanliness' },
  other:          { icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8', label: 'Other' },
};

const STEPS: { key: 'submitted' | IssueStatus; label: string }[] = [
  { key: 'submitted',   label: 'Submitted' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'resolved',    label: 'Resolved' },
];

function isStepDone(stepKey: string, issueStatus: IssueStatus): boolean {
  if (stepKey === 'submitted') return true;
  if (stepKey === 'in_progress') return issueStatus === 'in_progress' || issueStatus === 'resolved';
  if (stepKey === 'resolved') return issueStatus === 'resolved';
  return false;
}

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const issueData = await api.get<Issue>(`/api/issues/${id}`, session ?? undefined).catch(() => null);
      if (issueData) {
        setIssue(issueData);
        setAssignment(issueData.assignment ?? null);
        setHistory(issueData.status_history ?? []);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  function getStepTimestamp(stepKey: string): string | null {
    if (!issue) return null;
    if (stepKey === 'submitted') return issue.created_at;
    const entry = history.find(h => h.new_status === stepKey);
    return entry?.changed_at ?? null;
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
        <Text style={{ color: colors.textSec, textAlign: 'center', marginTop: 80 }}>
          Issue not found.
        </Text>
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_CONFIG[issue.category];
  const workerInitial = assignment?.worker?.name?.charAt(0).toUpperCase() ?? '?';

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>Issue Detail</Text>
        <StatusBadge status={issue.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Hero image */}
        {issue.image_url ? (
          <Image source={{ uri: issue.image_url }} style={styles.hero} resizeMode="cover" />
        ) : null}

        {/* Title + metadata */}
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
        </View>

        {/* Description */}
        {issue.description ? (
          <View style={styles.card}>
            <Text style={styles.cardHeading}>Description</Text>
            <Text style={styles.description}>{issue.description}</Text>
          </View>
        ) : null}

        {/* Category */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Category</Text>
          <View style={[styles.categoryBadge, { backgroundColor: `${cat.color}18` }]}>
            <Ionicons name={cat.icon} size={16} color={cat.color} />
            <Text style={[styles.categoryLabel, { color: cat.color }]}>{cat.label}</Text>
          </View>
        </View>

        {/* Assigned worker */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Assigned Worker</Text>
          {assignment?.worker ? (
            <View style={styles.workerRow}>
              <View style={styles.workerAvatar}>
                <Text style={styles.workerInitial}>{workerInitial}</Text>
              </View>
              <View>
                <Text style={styles.workerName}>{assignment.worker.name}</Text>
                <Text style={styles.workerSub}>
                  Assigned {formatDistanceToNow(new Date(assignment.assigned_at), { addSuffix: true })}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.unassigned}>No worker assigned yet</Text>
          )}
        </View>

        {/* Status timeline */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Status Timeline</Text>
          <View style={styles.timeline}>
            {STEPS.map((step, idx) => {
              const done = isStepDone(step.key, issue.status);
              const ts = getStepTimestamp(step.key);
              const isLast = idx === STEPS.length - 1;
              const nextDone = idx < STEPS.length - 1 && isStepDone(STEPS[idx + 1].key, issue.status);

              return (
                <View key={step.key} style={styles.timelineRow}>
                  {/* Left: circle + connector */}
                  <View style={styles.timelineLeft}>
                    <View style={[styles.stepCircle, done && styles.stepCircleDone]}>
                      {done && <Ionicons name="checkmark" size={12} color={colors.text} />}
                    </View>
                    {!isLast && (
                      <View style={[styles.connector, nextDone && styles.connectorDone]} />
                    )}
                  </View>

                  {/* Right: label + timestamp */}
                  <View style={styles.timelineContent}>
                    <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
                    {ts ? (
                      <Text style={styles.stepTime}>
                        {format(new Date(ts), 'MMM d, yyyy · h:mm a')}
                      </Text>
                    ) : (
                      <Text style={styles.stepPending}>Pending</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
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
  topBarTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  hero: {
    width: '100%',
    height: 220,
    borderRadius: radius.lg,
  },
  section: { gap: spacing.xs },
  issueTitle: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  metaText: { color: colors.textMuted, fontSize: 13 },
  metaDot: { color: colors.textMuted },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardHeading: { color: colors.textSec, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  description: { color: colors.text, fontSize: 14, lineHeight: 22 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
  },
  categoryLabel: { fontSize: 14, fontWeight: '600' },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workerInitial: { color: colors.text, fontSize: 18, fontWeight: '700' },
  workerName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  workerSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  unassigned: { color: colors.textMuted, fontSize: 14 },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: spacing.md },
  timelineLeft: { alignItems: 'center', width: 24 },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: colors.primary, borderColor: colors.primary },
  connector: { width: 2, flex: 1, minHeight: 32, backgroundColor: colors.borderLight, marginVertical: 3 },
  connectorDone: { backgroundColor: colors.primary },
  timelineContent: { flex: 1, paddingBottom: spacing.lg, paddingTop: 2 },
  stepLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  stepLabelDone: { color: colors.text },
  stepTime: { color: colors.textSec, fontSize: 12, marginTop: 3 },
  stepPending: { color: colors.textMuted, fontSize: 12, marginTop: 3, fontStyle: 'italic' },
});
