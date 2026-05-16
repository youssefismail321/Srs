import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { api, uploadFile } from '@/lib/api';
import StatusBadge from '@/components/StatusBadge';
import ImagePickerModal from '@/components/ImagePickerModal';
import { colors, radius, spacing } from '@/constants/theme';
import { Comment, Issue, IssueCategory } from '@/types';

const CATEGORY_CONFIG: Record<IssueCategory, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  maintenance:    { icon: 'construct-outline',                  color: '#F59E0B', label: 'Maintenance' },
  infrastructure: { icon: 'business-outline',                   color: '#6366F1', label: 'Infrastructure' },
  sustainability: { icon: 'leaf-outline',                       color: '#10B981', label: 'Sustainability' },
  cleanliness:    { icon: 'water-outline',                      color: '#38BDF8', label: 'Cleanliness' },
  other:          { icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8', label: 'Other' },
};

const AVATAR_COLORS = ['#6366F1', '#A78BFA', '#10B981', '#F59E0B', '#EF4444', '#38BDF8'];
function avatarColor(name: string): string {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

export default function WorkerTaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile, session } = useAuth();
  const scrollRef = useRef<ScrollView>(null);

  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [commentText, setCommentText] = useState('');
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [sendLoading, setSendLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  async function loadIssue() {
    if (!session) return;
    try {
      const data = await api.get<Issue>(`/api/issues/${id}`, session);
      setIssue(data);
    } catch {}
  }

  async function loadComments() {
    if (!session) return;
    try {
      const data = await api.get<Comment[]>(`/api/issues/${id}/comments`, session);
      setComments(data);
    } catch {}
  }

  useEffect(() => {
    Promise.all([loadIssue(), loadComments()]).finally(() => setLoading(false));
  }, [id]);

  async function markInProgress() {
    if (!profile || !issue || !session) return;
    setActionLoading(true);
    try {
      await api.patch(`/api/issues/${issue.id}`, { status: 'in_progress' }, session);
      await loadIssue();
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  }

  async function sendComment() {
    if (!profile || !issue || !session) return;
    const text = commentText.trim();
    if (!text && !commentImage) return;

    setSendLoading(true);
    try {
      let image_url: string | null = null;
      if (commentImage) {
        const { url } = await uploadFile('/api/upload', commentImage, session);
        image_url = url;
      }

      await api.post(`/api/issues/${issue.id}/comments`, { content: text, image_url }, session);

      setCommentText('');
      setCommentImage(null);
      await loadComments();
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to send comment');
    } finally {
      setSendLoading(false);
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
        <Text style={{ color: colors.textSec, textAlign: 'center', marginTop: 80 }}>Task not found.</Text>
      </SafeAreaView>
    );
  }

  const cat = CATEGORY_CONFIG[issue.category];
  const hasContent = commentText.trim().length > 0 || !!commentImage;

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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Hero */}
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

          {/* Mark In Progress */}
          {issue.status === 'pending' && (
            <TouchableOpacity
              style={styles.inProgressBtn}
              onPress={markInProgress}
              disabled={actionLoading}
              activeOpacity={0.78}
            >
              {actionLoading ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={18} color={colors.text} />
                  <Text style={styles.inProgressBtnText}>Mark as In Progress</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Comments section */}
          <View style={styles.commentsHeader}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.textMuted} />
            <Text style={styles.commentsTitle}>Comments & Updates</Text>
            <View style={styles.commentCountBadge}>
              <Text style={styles.commentCountText}>{comments.length}</Text>
            </View>
          </View>

          {comments.length === 0 ? (
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubble-outline" size={32} color={colors.borderLight} />
              <Text style={styles.emptyCommentsText}>No comments yet. Be the first to update.</Text>
            </View>
          ) : (
            comments.map(comment => {
              const authorName = (comment.author as any)?.name ?? 'Unknown';
              const bg = avatarColor(authorName);
              const initial = authorName.charAt(0).toUpperCase();
              const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });

              return (
                <View key={comment.id} style={styles.commentCard}>
                  <View style={styles.commentHeader}>
                    <View style={[styles.commentAvatar, { backgroundColor: bg }]}>
                      <Text style={styles.commentInitial}>{initial}</Text>
                    </View>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentAuthor}>{authorName}</Text>
                      <Text style={styles.commentTime}>{timeAgo}</Text>
                    </View>
                  </View>
                  {comment.content ? (
                    <Text style={styles.commentText}>{comment.content}</Text>
                  ) : null}
                  {comment.image_url ? (
                    <Image
                      source={{ uri: comment.image_url }}
                      style={styles.commentImage}
                      resizeMode="cover"
                    />
                  ) : null}
                </View>
              );
            })
          )}

          {/* Bottom padding for input bar */}
          <View style={{ height: spacing.xxl }} />
        </ScrollView>

        {/* Comment input bar */}
        <View style={styles.inputBar}>
          {commentImage ? (
            <View style={styles.imagePreviewRow}>
              <Image source={{ uri: commentImage }} style={styles.previewThumb} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removeImageBtn}
                onPress={() => setCommentImage(null)}
              >
                <Ionicons name="close-circle" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.cameraBtn}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment or update..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />

            <TouchableOpacity
              style={[styles.sendBtn, hasContent && styles.sendBtnActive]}
              onPress={sendComment}
              disabled={!hasContent || sendLoading}
              activeOpacity={0.78}
            >
              {sendLoading ? (
                <ActivityIndicator color={hasContent ? colors.text : colors.textMuted} size="small" />
              ) : (
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={hasContent ? colors.text : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ImagePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onImageSelected={setCommentImage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
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
  content: { padding: spacing.lg, gap: spacing.md },
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
  inProgressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  inProgressBtnText: { color: colors.text, fontSize: 16, fontWeight: '600' },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  commentsTitle: { color: colors.textSec, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  commentCountBadge: {
    backgroundColor: colors.borderLight,
    borderRadius: radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  commentCountText: { color: colors.textSec, fontSize: 11, fontWeight: '700' },
  emptyComments: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  emptyCommentsText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  commentCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: { color: colors.text, fontSize: 14, fontWeight: '700' },
  commentMeta: { flex: 1 },
  commentAuthor: { color: colors.text, fontSize: 13, fontWeight: '600' },
  commentTime: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  commentText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  commentImage: {
    width: '100%',
    height: 150,
    borderRadius: radius.md,
  },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  imagePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  previewThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
  },
  removeImageBtn: { padding: 2 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  textInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: 100,
    minHeight: 40,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
