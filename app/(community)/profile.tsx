import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LoadingScreen from '@/components/LoadingScreen';
import { colors, radius, spacing } from '@/constants/theme';
import { UserRole } from '@/types';

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string }> = {
  community_member: { label: 'Community Member', bg: colors.inProgressBg, text: colors.primary },
  facility_manager: { label: 'Facility Manager', bg: 'rgba(167,139,250,0.12)', text: colors.accent },
  worker:           { label: 'Worker',           bg: colors.successBg,     text: colors.success },
  admin:            { label: 'Admin',             bg: colors.warningBg,     text: colors.warning },
};

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  if (!profile) return <LoadingScreen />;

  const roleConfig = ROLE_CONFIG[profile.role];
  const initial = profile.name.charAt(0).toUpperCase();
  const memberSince = format(new Date(profile.created_at), 'MMMM yyyy');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Profile</Text>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: roleConfig.bg }]}>
            <Text style={[styles.roleLabel, { color: roleConfig.text }]}>{roleConfig.label}</Text>
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.card}>
          <InfoRow
            icon="checkmark-circle-outline"
            label="Account Status"
            value={profile.is_active ? 'Active' : 'Inactive'}
            valueColor={profile.is_active ? colors.success : colors.error}
          />
          <View style={styles.divider} />
          <InfoRow icon="shield-outline" label="Role" value={roleConfig.label} />
          <View style={styles.divider} />
          <InfoRow icon="calendar-outline" label="Member Since" value={memberSince} />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={() => setShowConfirm(true)} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={showConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of CampusCare?"
        confirmLabel="Sign Out"
        onCancel={() => setShowConfirm(false)}
        onConfirm={async () => { setShowConfirm(false); await signOut(); router.replace('/(auth)/login'); }}
        danger
      />
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  avatarSection: { alignItems: 'center', gap: spacing.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.text, fontSize: 36, fontWeight: '700' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700' },
  email: { color: colors.textSec, fontSize: 14 },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  roleLabel: { fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoLabel: { color: colors.textSec, fontSize: 14 },
  infoValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.errorBg,
  },
  signOutText: { color: colors.error, fontSize: 16, fontWeight: '600' },
});
