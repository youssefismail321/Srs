import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';
import { UserRole } from '@/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface RoleOption {
  role: Exclude<UserRole, 'admin'>;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'community_member',
    label: 'Community Member',
    description: 'Report and track campus issues',
    icon: 'people-outline',
  },
  {
    role: 'facility_manager',
    label: 'Facility Manager',
    description: 'Oversee and manage facility issues',
    icon: 'clipboard-outline',
  },
  {
    role: 'worker',
    label: 'Worker',
    description: 'Handle and resolve assigned tasks',
    icon: 'construct-outline',
  },
];

export default function Register() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Exclude<UserRole, 'admin'> | null>(null);

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [roleError, setRoleError] = useState('');

  const [loading, setLoading] = useState(false);

  function validate() {
    let valid = true;

    if (!name.trim()) {
      setNameError('Name is required');
      valid = false;
    } else {
      setNameError('');
    }

    if (!email.trim()) {
      setEmailError('Email is required');
      valid = false;
    } else if (!EMAIL_RE.test(email.trim())) {
      setEmailError('Enter a valid email address');
      valid = false;
    } else {
      setEmailError('');
    }

    if (!password) {
      setPasswordError('Password is required');
      valid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      valid = false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('Passwords do not match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }

    if (!role) {
      setRoleError('Please select a role');
      valid = false;
    } else {
      setRoleError('');
    }

    return valid;
  }

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        email: email.trim().toLowerCase(),
        password,
        name: name.trim(),
        role,
      });
      Alert.alert('Success!', 'Account created. You can now sign in.', [
        { text: 'Go to Login', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (err: any) {
      Alert.alert('Registration Failed', err.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
        </View>

        {/* Fields */}
        <Input
          label="Full Name"
          value={name}
          onChangeText={(t) => { setName(t); if (nameError) setNameError(''); }}
          autoCapitalize="words"
          placeholder="Jane Doe"
          error={nameError}
        />

        <Input
          label="Email"
          value={email}
          onChangeText={(t) => { setEmail(t); if (emailError) setEmailError(''); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="your@email.com"
          error={emailError}
        />

        <Input
          label="Password"
          value={password}
          onChangeText={(t) => { setPassword(t); if (passwordError) setPasswordError(''); }}
          isPassword
          placeholder="Min. 6 characters"
          error={passwordError}
        />

        <Input
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={(t) => { setConfirmPassword(t); if (confirmPasswordError) setConfirmPasswordError(''); }}
          isPassword
          placeholder="Re-enter password"
          error={confirmPasswordError}
        />

        {/* Role selector */}
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>Select Your Role</Text>
          {roleError ? <Text style={styles.roleError}>{roleError}</Text> : null}

          <View style={styles.roleList}>
            {ROLE_OPTIONS.map((option) => {
              const selected = role === option.role;
              return (
                <TouchableOpacity
                  key={option.role}
                  style={[styles.roleCard, selected && styles.roleCardSelected]}
                  onPress={() => { setRole(option.role); if (roleError) setRoleError(''); }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                  </View>

                  <View style={styles.roleTextBlock}>
                    <Text style={[styles.roleName, selected && styles.roleNameSelected]}>
                      {option.label}
                    </Text>
                    <Text style={styles.roleDesc}>{option.description}</Text>
                  </View>

                  <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
                    {selected && (
                      <Ionicons name="checkmark" size={14} color={colors.text} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Button
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          style={styles.createBtn}
        />

        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.loginLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  roleSection: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  roleLabel: {
    color: colors.textSec,
    fontSize: 13,
    fontWeight: '500',
  },
  roleError: {
    color: colors.error,
    fontSize: 12,
  },
  roleList: {
    gap: spacing.sm,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.inProgressBg,
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconSelected: {
    backgroundColor: 'rgba(99,102,241,0.2)',
  },
  roleTextBlock: {
    flex: 1,
    gap: 3,
  },
  roleName: {
    color: colors.textSec,
    fontSize: 14,
    fontWeight: '600',
  },
  roleNameSelected: {
    color: colors.text,
  },
  roleDesc: {
    color: colors.textMuted,
    fontSize: 12,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  createBtn: {
    marginTop: spacing.sm,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  loginText: {
    color: colors.textSec,
    fontSize: 14,
  },
  loginLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
