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
import { supabase } from '@/lib/supabase';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { colors, radius, spacing } from '@/constants/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    let valid = true;
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
    } else {
      setPasswordError('');
    }
    return valid;
  }

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      console.log('[Login] Attempting sign-in with email:', email.trim().toLowerCase());
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        console.log('[Login] signInWithPassword error:', JSON.stringify(error));
        Alert.alert('Login Failed', error.message);
        return;
      }
      console.log('[Login] Auth success. user.id:', data.user.id);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('is_active, role')
        .eq('id', data.user.id)
        .single();

      console.log('[Login] Profile fetch result:', JSON.stringify(profile), 'error:', profileError);

      if (!profile?.is_active) {
        console.log('[Login] is_active check failed');
        await supabase.auth.signOut();
        Alert.alert('Account Deactivated', 'Your account has been deactivated. Please contact an administrator.');
        return;
      }

      console.log('[Login] Navigating based on role:', profile.role);

      if (profile.role === 'admin') {
        router.replace('/(admin)');
      } else if (profile.role === 'facility_manager') {
        router.replace('/(manager)');
      } else if (profile.role === 'worker') {
        router.replace('/(worker)');
      } else {
        router.replace('/(community)');
      }
    } catch (err: any) {
      console.log('[Login] Unexpected error:', err.message);
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
        {/* Logo */}
        <View style={styles.logoSection}>
          <View style={styles.logoBox}>
            <Ionicons name="shield-checkmark" size={44} color={colors.text} />
          </View>
          <Text style={styles.appName}>CampusCare</Text>
          <Text style={styles.tagline}>Smarter campus, better community</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

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
            placeholder="••••••••"
            error={passwordError}
          />

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.signInBtn}
          />

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
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
    justifyContent: 'center',
    gap: spacing.lg,
  },
  logoSection: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  appName: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: colors.textSec,
    fontSize: 14,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  signInBtn: {
    marginTop: spacing.xs,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  registerText: {
    color: colors.textSec,
    fontSize: 14,
  },
  registerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
