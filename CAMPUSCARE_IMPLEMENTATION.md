# CampusCare — Complete Implementation Guide for Claude Code

> Read this entire file before creating any code. Create every file exactly as specified.
> Project location: `C:/campuscareFP`
> Mobile app tested via Expo Go on phone (LAN: 192.168.1.6)

---

## STEP 1 — Initialize Project

```bash
cd C:/
npx create-expo-app campuscareFP --template blank-typescript
cd campuscareFP
npx expo install expo-router@~3.5.23 expo-secure-store@~13.0.2 expo-image-picker@~15.0.7 expo-camera@~15.0.16 expo-file-system@~17.0.1 @supabase/supabase-js@^2.43.4 @react-native-async-storage/async-storage@1.23.1 react-native-safe-area-context@4.10.5 react-native-screens@3.31.1 react-native-reanimated@~3.10.1 react-native-gesture-handler@~2.16.1 @expo/vector-icons@^14.0.2 date-fns@^3.6.0
```

---

## STEP 2 — Supabase SQL Setup

**Run this entire block in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor):**

```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'community_member'
    CHECK (role IN ('community_member','facility_manager','worker','admin')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issues
CREATE TABLE public.issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('maintenance','infrastructure','sustainability','cleanliness','other')),
  location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_progress','resolved')),
  image_url TEXT,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assignments
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status History
CREATE TABLE public.status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id UUID NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'community_member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_update_admin" ON public.profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Issues policies
CREATE POLICY "issues_select" ON public.issues FOR SELECT USING (true);
CREATE POLICY "issues_insert" ON public.issues FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "issues_update" ON public.issues FOR UPDATE USING (true);
CREATE POLICY "issues_delete" ON public.issues FOR DELETE USING (true);

-- Assignments policies
CREATE POLICY "assignments_select" ON public.assignments FOR SELECT USING (true);
CREATE POLICY "assignments_insert" ON public.assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "assignments_delete" ON public.assignments FOR DELETE USING (true);

-- Comments policies
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Status history policies
CREATE POLICY "history_select" ON public.status_history FOR SELECT USING (true);
CREATE POLICY "history_insert" ON public.status_history FOR INSERT WITH CHECK (auth.uid() = changed_by);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('issue-images', 'issue-images', true)
  ON CONFLICT DO NOTHING;
CREATE POLICY "storage_select" ON storage.objects FOR SELECT USING (bucket_id = 'issue-images');
CREATE POLICY "storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'issue-images' AND auth.role() = 'authenticated');
CREATE POLICY "storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'issue-images');
```

---

## STEP 3 — Create Admin User

Create `scripts/createAdmin.js` and run it with `node scripts/createAdmin.js`:

```js
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://tlvkhopxlhehwzfjllbg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdmtob3B4bGhlaHd6ZmpsbGJnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODg1MTc3MywiZXhwIjoyMDk0NDI3NzczfQ.UdCWjiEzrIw2Diz02BqhyCwqlSqq06NiIrRgqYH_fto'
);

async function main() {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: 'admin@campuscare.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: { name: 'Admin', role: 'admin' },
    });
    if (error) throw error;
    await supabase.from('profiles').update({ role: 'admin', name: 'Admin' }).eq('id', data.user.id);
    console.log('✅ Admin created: admin@campuscare.com / admin123');
  } catch (e) {
    console.error('Error:', e.message);
  }
}
main();
```

---

## STEP 4 — Config Files

### `package.json`
```json
{
  "name": "campuscare",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "expo": "~51.0.0",
    "expo-router": "~3.5.23",
    "expo-status-bar": "~1.12.1",
    "expo-secure-store": "~13.0.2",
    "expo-image-picker": "~15.0.7",
    "expo-camera": "~15.0.16",
    "expo-file-system": "~17.0.1",
    "@supabase/supabase-js": "^2.43.4",
    "@react-native-async-storage/async-storage": "1.23.1",
    "react-native-safe-area-context": "4.10.5",
    "react-native-screens": "3.31.1",
    "react-native-reanimated": "~3.10.1",
    "react-native-gesture-handler": "~2.16.1",
    "@expo/vector-icons": "^14.0.2",
    "date-fns": "^3.6.0",
    "react": "18.2.0",
    "react-native": "0.74.5"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.2.79",
    "typescript": "~5.3.3"
  }
}
```

### `app.json`
```json
{
  "expo": {
    "name": "CampusCare",
    "slug": "campuscare",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "campuscare",
    "userInterfaceStyle": "dark",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0A0A0F"
    },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      [
        "expo-image-picker",
        {
          "photosPermission": "CampusCare needs photos to document issues.",
          "cameraPermission": "CampusCare needs your camera to photograph issues."
        }
      ]
    ],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0A0A0F"
      },
      "package": "com.campuscare.app"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.campuscare.app"
    },
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

### `.env`
```
EXPO_PUBLIC_SUPABASE_URL=https://tlvkhopxlhehwzfjllbg.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsdmtob3B4bGhlaHd6ZmpsbGJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTE3NzMsImVleHAiOjIwOTQ0Mjc3NzN9.KY-kqAZZtLtbkb_Og9iwVdE_FaW80OSO0ogSsZNnyTI
```

### `babel.config.js`
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

### `tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

---

## STEP 5 — Source Files

### `src/constants/theme.ts`
```typescript
export const colors = {
  bg: '#0A0A0F',
  surface: '#12121E',
  card: '#1A1A2E',
  cardAlt: '#20203A',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  accent: '#A78BFA',
  text: '#F1F5F9',
  textSec: '#94A3B8',
  textMuted: '#64748B',
  success: '#10B981',
  successBg: 'rgba(16,185,129,0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245,158,11,0.12)',
  error: '#EF4444',
  errorBg: 'rgba(239,68,68,0.12)',
  border: '#1E1E32',
  borderLight: '#2A2A42',
  pending: '#F59E0B',
  pendingBg: 'rgba(245,158,11,0.12)',
  inProgress: '#6366F1',
  inProgressBg: 'rgba(99,102,241,0.12)',
  resolved: '#10B981',
  resolvedBg: 'rgba(16,185,129,0.12)',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 };
```

---

### `src/types/index.ts`
```typescript
export type UserRole = 'community_member' | 'facility_manager' | 'worker' | 'admin';
export type IssueStatus = 'pending' | 'in_progress' | 'resolved';
export type IssueCategory = 'maintenance' | 'infrastructure' | 'sustainability' | 'cleanliness' | 'other';

export interface Profile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string | null;
  category: IssueCategory;
  location: string;
  status: IssueStatus;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator?: Profile;
  assignment?: Assignment;
}

export interface Assignment {
  id: string;
  issue_id: string;
  worker_id: string;
  assigned_by: string;
  assigned_at: string;
  worker?: Profile;
}

export interface Comment {
  id: string;
  issue_id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  author?: Profile;
}

export interface StatusHistory {
  id: string;
  issue_id: string;
  old_status: IssueStatus | null;
  new_status: IssueStatus;
  changed_by: string;
  note: string | null;
  changed_at: string;
  changer?: Profile;
}
```

---

### `src/lib/supabase.ts`
```typescript
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const uploadImage = async (uri: string, folder = 'issues'): Promise<string> => {
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const response = await fetch(uri);
  const blob = await response.blob();
  const { data, error } = await supabase.storage
    .from('issue-images')
    .upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('issue-images').getPublicUrl(data.path);
  return publicUrl;
};
```

---

### `src/contexts/AuthContext.tsx`
```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null, profile: null, loading: true,
  refreshProfile: async () => {}, signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (session?.user?.id) await fetchProfile(session.user.id);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) await fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

---

### `src/components/Button.tsx`
```typescript
import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '../constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
}

export const Button = ({ label, onPress, variant = 'primary', loading, disabled, style, small }: Props) => {
  const vs = styles[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.base, vs.btn, small && styles.small, (disabled || loading) && styles.disabled, style]}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator color={vs.text.color} size="small" />
        : <Text style={[styles.label, vs.text, small && styles.smallText]}>{label}</Text>
      }
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52, borderRadius: radius.md, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 20,
  },
  small: { height: 38, paddingHorizontal: 14 },
  label: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  smallText: { fontSize: 13 },
  disabled: { opacity: 0.45 },
  primary: {
    btn: { backgroundColor: colors.primary },
    text: { color: '#fff' },
  },
  secondary: {
    btn: { backgroundColor: colors.cardAlt },
    text: { color: colors.text },
  },
  danger: {
    btn: { backgroundColor: colors.error },
    text: { color: '#fff' },
  },
  ghost: {
    btn: { backgroundColor: 'transparent' },
    text: { color: colors.textSec },
  },
  outline: {
    btn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderLight },
    text: { color: colors.text },
  },
});
```

---

### `src/components/Input.tsx`
```typescript
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constants/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  isPassword?: boolean;
}

export const Input = ({ label, error, hint, isPassword, style, ...props }: Props) => {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, error ? styles.inputError : null]}>
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !show}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn}>
            <Ionicons name={show ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSec, marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  inputError: { borderColor: colors.error },
  input: {
    flex: 1, height: 52, paddingHorizontal: 16,
    color: colors.text, fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: 14 },
  errorText: { marginTop: 5, fontSize: 12, color: colors.error },
  hint: { marginTop: 5, fontSize: 12, color: colors.textMuted },
});
```

---

### `src/components/StatusBadge.tsx`
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius } from '../constants/theme';
import { IssueStatus } from '../types';

const statusConfig = {
  pending:     { label: 'Pending',     bg: colors.pendingBg,    text: colors.pending,    dot: colors.pending },
  in_progress: { label: 'In Progress', bg: colors.inProgressBg, text: colors.inProgress, dot: colors.inProgress },
  resolved:    { label: 'Resolved',    bg: colors.resolvedBg,   text: colors.resolved,   dot: colors.resolved },
};

export const StatusBadge = ({ status, small }: { status: IssueStatus; small?: boolean }) => {
  const cfg = statusConfig[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, small && styles.small]}>
      <View style={[styles.dot, { backgroundColor: cfg.dot }, small && styles.smallDot]} />
      <Text style={[styles.text, { color: cfg.text }, small && styles.smallText]}>{cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  smallDot: { width: 5, height: 5, marginRight: 4 },
  text: { fontSize: 13, fontWeight: '600' },
  smallText: { fontSize: 11 },
});
```

---

### `src/components/IssueCard.tsx`
```typescript
import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { colors, radius, spacing } from '../constants/theme';
import { StatusBadge } from './StatusBadge';
import { Issue } from '../types';

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  maintenance: 'construct-outline',
  infrastructure: 'business-outline',
  sustainability: 'leaf-outline',
  cleanliness: 'sparkles-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

interface Props { issue: Issue; onPress: () => void; }

export const IssueCard = ({ issue, onPress }: Props) => {
  const timeAgo = formatDistanceToNow(new Date(issue.created_at), { addSuffix: true });
  const icon = categoryIcons[issue.category] ?? 'alert-circle-outline';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.top}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>{issue.title}</Text>
          <View style={styles.row}>
            <Ionicons name="location-outline" size={12} color={colors.textMuted} />
            <Text style={styles.sub} numberOfLines={1}> {issue.location}</Text>
          </View>
        </View>
        <StatusBadge status={issue.status} small />
      </View>
      {issue.image_url && (
        <Image source={{ uri: issue.image_url }} style={styles.img} />
      )}
      {issue.description ? (
        <Text style={styles.desc} numberOfLines={2}>{issue.description}</Text>
      ) : null}
      <View style={styles.footer}>
        <Text style={styles.time}>{timeAgo}</Text>
        <View style={styles.catRow}>
          <Text style={styles.cat}>{issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  iconWrap: {
    width: 36, height: 36, borderRadius: radius.sm,
    backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  meta: { flex: 1, marginRight: 8 },
  title: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 3 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sub: { fontSize: 12, color: colors.textMuted, flex: 1 },
  img: { width: '100%', height: 150, borderRadius: radius.md, marginBottom: 10 },
  desc: { fontSize: 13, color: colors.textSec, lineHeight: 18, marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  time: { fontSize: 12, color: colors.textMuted },
  catRow: {
    backgroundColor: colors.cardAlt, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  cat: { fontSize: 11, color: colors.textSec },
});
```

---

### `src/components/LoadingScreen.tsx`
```typescript
import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/theme';

export const LoadingScreen = ({ message = 'Loading...' }: { message?: string }) => (
  <View style={styles.c}>
    <ActivityIndicator size="large" color={colors.primary} />
    <Text style={styles.t}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  t: { marginTop: 12, color: colors.textSec, fontSize: 14 },
});
```

---

### `src/components/EmptyState.tsx`
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/theme';

interface Props { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; }

export const EmptyState = ({ icon = 'folder-open-outline', title, subtitle }: Props) => (
  <View style={styles.c}>
    <View style={styles.iconWrap}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
    </View>
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.sub}>{subtitle}</Text>}
  </View>
);

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8, textAlign: 'center' },
  sub: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
```

---

### `src/components/ConfirmDialog.tsx`
```typescript
import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({
  visible, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger, onConfirm, onCancel,
}: Props) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
    <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
      <TouchableOpacity style={styles.box} activeOpacity={1}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.msg}>{message}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelText}>{cancelLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, danger && styles.dangerBtn]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  box: {
    width: '85%', backgroundColor: colors.card,
    borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 10 },
  msg: { fontSize: 14, color: colors.textSec, lineHeight: 21, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, height: 46, borderRadius: radius.md,
    backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { color: colors.textSec, fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 1, height: 46, borderRadius: radius.md,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  dangerBtn: { backgroundColor: colors.error },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
```

---

### `src/components/ImagePickerModal.tsx`
```typescript
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onImage: (uri: string) => void;
}

export const ImagePickerModal = ({ visible, onClose, onImage }: Props) => {
  const pick = async (source: 'camera' | 'gallery') => {
    onClose();
    const perm = source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission Required', `Please allow ${source} access in your settings.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) onImage(result.assets[0].uri);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.handle} />
          <Text style={styles.title}>Add Photo</Text>
          <TouchableOpacity style={styles.option} onPress={() => pick('camera')}>
            <View style={styles.iconWrap}><Ionicons name="camera" size={22} color={colors.primary} /></View>
            <View>
              <Text style={styles.optTitle}>Take Photo</Text>
              <Text style={styles.optSub}>Use your camera</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.option} onPress={() => pick('gallery')}>
            <View style={styles.iconWrap}><Ionicons name="images" size={22} color={colors.primary} /></View>
            <View>
              <Text style={styles.optTitle}>Choose from Library</Text>
              <Text style={styles.optSub}>Pick an existing photo</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 36 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderLight, alignSelf: 'center', marginBottom: 20 },
  title: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 20 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: 'rgba(99,102,241,0.12)', alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  optSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  cancel: { marginTop: 8, height: 52, borderRadius: radius.md, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: colors.textSec },
});
```

---

## STEP 6 — App Root Files

### `app/_layout.tsx`
```typescript
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../src/contexts/AuthContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
```

---

### `app/index.tsx`
```typescript
import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function Index() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!session) { router.replace('/(auth)/login'); return; }
    if (!profile) return;
    if (!profile.is_active) { router.replace('/(auth)/login'); return; }
    switch (profile.role) {
      case 'community_member': router.replace('/(community)/'); break;
      case 'facility_manager': router.replace('/(manager)/'); break;
      case 'worker': router.replace('/(worker)/'); break;
      case 'admin': router.replace('/(admin)/'); break;
    }
  }, [session, profile, loading]);

  return <LoadingScreen message="Starting CampusCare..." />;
}
```

---

## STEP 7 — Auth Screens

### `app/(auth)/_layout.tsx`
```typescript
import { Stack } from 'expo-router';
import { colors } from '../../src/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );
}
```

---

### `app/(auth)/login.tsx`
```typescript
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius } from '../../src/constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) { Alert.alert('Login Failed', error.message); return; }
      // Check if user is active
      const { data: profile } = await supabase.from('profiles').select('is_active, role').eq('id', data.user.id).single();
      if (!profile?.is_active) {
        await supabase.auth.signOut();
        Alert.alert('Account Deactivated', 'Your account has been deactivated. Please contact an administrator.');
        return;
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
          </View>
          <Text style={styles.appName}>CampusCare</Text>
          <Text style={styles.tagline}>Campus Issue Management</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.formTitle}>Welcome back</Text>
          <Text style={styles.formSub}>Sign in to your account</Text>

          <Input
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })); }}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />
          <Input
            label="Password"
            placeholder="Your password"
            value={password}
            onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })); }}
            isPassword
            error={errors.password}
          />

          <Button label="Sign In" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity style={styles.link} onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.linkText}>Don't have an account? <Text style={{ color: colors.primary, fontWeight: '600' }}>Register</Text></Text>
          </TouchableOpacity>

          <View style={styles.adminHint}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
            <Text style={styles.hintText}> Admin: admin@campuscare.com / admin123</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: 80, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoWrap: {
    width: 72, height: 72, borderRadius: 22,
    backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)',
  },
  appName: { fontSize: 30, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  form: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  formTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: 6 },
  formSub: { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { marginHorizontal: 12, color: colors.textMuted, fontSize: 13 },
  link: { alignItems: 'center' },
  linkText: { fontSize: 14, color: colors.textSec },
  adminHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  hintText: { fontSize: 11, color: colors.textMuted },
});
```

---

### `app/(auth)/register.tsx`
```typescript
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { colors, spacing, radius } from '../../src/constants/theme';
import { UserRole } from '../../src/types';

const ROLES = [
  { value: 'community_member' as UserRole, label: 'Community Member', icon: 'person-outline' as const, desc: 'Report issues on campus' },
  { value: 'facility_manager' as UserRole, label: 'Facility Manager', icon: 'briefcase-outline' as const, desc: 'Manage and assign issues' },
  { value: 'worker' as UserRole, label: 'Worker', icon: 'hammer-outline' as const, desc: 'Handle assigned tasks' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<UserRole>('community_member');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Name is required';
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'At least 6 characters';
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (confirm !== password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: { data: { name: name.trim(), role } },
      });
      if (error) { Alert.alert('Registration Failed', error.message); return; }
      Alert.alert('Success!', 'Account created. You can now sign in.', [
        { text: 'Go to Login', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.sub}>Join the CampusCare community</Text>

        <View style={styles.form}>
          <Input label="Full Name" placeholder="Your full name" value={name}
            onChangeText={t => { setName(t); setErrors(e => ({ ...e, name: '' })); }}
            error={errors.name} autoCapitalize="words"
          />
          <Input label="Email" placeholder="you@example.com" value={email}
            onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: '' })); }}
            keyboardType="email-address" autoCapitalize="none" error={errors.email}
          />
          <Input label="Password" placeholder="Min. 6 characters" value={password}
            onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: '' })); }}
            isPassword error={errors.password}
          />
          <Input label="Confirm Password" placeholder="Repeat password" value={confirm}
            onChangeText={t => { setConfirm(t); setErrors(e => ({ ...e, confirm: '' })); }}
            isPassword error={errors.confirm}
          />

          <Text style={styles.roleLabel}>I AM A</Text>
          <View style={styles.roles}>
            {ROLES.map(r => (
              <TouchableOpacity
                key={r.value}
                style={[styles.roleCard, role === r.value && styles.roleActive]}
                onPress={() => setRole(r.value)}
                activeOpacity={0.8}
              >
                <Ionicons name={r.icon} size={20} color={role === r.value ? colors.primary : colors.textMuted} />
                <Text style={[styles.roleName, role === r.value && { color: colors.text }]}>{r.label}</Text>
                <Text style={styles.roleDesc}>{r.desc}</Text>
                {role === r.value && (
                  <View style={styles.check}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          <Button label="Create Account" onPress={handleRegister} loading={loading} style={{ marginTop: 20 }} />
        </View>

        <TouchableOpacity style={styles.link} onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.linkText}>Already have an account? <Text style={{ color: colors.primary, fontWeight: '600' }}>Sign In</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  backText: { color: colors.text, fontSize: 15 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 6, letterSpacing: -0.5 },
  sub: { fontSize: 15, color: colors.textMuted, marginBottom: 28 },
  form: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  roleLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 10 },
  roles: { gap: 8 },
  roleCard: {
    padding: 14, borderRadius: radius.md,
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    position: 'relative',
  },
  roleActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.08)' },
  roleName: { fontSize: 14, fontWeight: '600', color: colors.textSec, marginTop: 6, marginBottom: 2 },
  roleDesc: { fontSize: 12, color: colors.textMuted },
  check: { position: 'absolute', top: 12, right: 12 },
  link: { alignItems: 'center', marginTop: 24 },
  linkText: { fontSize: 14, color: colors.textSec },
});
```

---

## STEP 8 — Community Member Screens

### `app/(community)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

export default function CommunityLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, height: 62, paddingBottom: 10 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'My Issues', tabBarIcon: ({ color, size }) => <Ionicons name="list-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="submit" options={{ title: 'Submit', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="issue/[id]" options={{ href: null }} />
    </Tabs>
  );
}
```

---

### `app/(community)/index.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { IssueCard } from '../../src/components/IssueCard';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Issue, IssueStatus } from '../../src/types';

const FILTERS: { label: string; value: IssueStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function MyIssues() {
  const { profile } = useAuth();
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<IssueStatus | 'all'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchIssues = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('issues')
      .select('*')
      .eq('created_by', profile.id)
      .order('created_at', { ascending: false });
    setIssues(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchIssues(); }, [profile]));

  const onRefresh = () => { setRefreshing(true); fetchIssues(); };

  const filtered = issues.filter(i => {
    const matchStatus = filter === 'all' || i.status === filter;
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleDeleteRequest = (issue: Issue) => {
    if (issue.status !== 'pending') {
      Alert.alert('Cannot Delete', 'Only pending issues can be deleted.');
      return;
    }
    setDeleteId(issue.id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('issues').delete().eq('id', deleteId);
    if (!error) setIssues(prev => prev.filter(i => i.id !== deleteId));
    setDeleteId(null);
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {profile?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.title}>My Issues</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{issues.length}</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.search}
          placeholder="Search issues..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} style={{ paddingRight: 12 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View>
            <IssueCard issue={item} onPress={() => router.push(`/(community)/issue/${item.id}`)} />
            {item.status === 'pending' && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteRequest(item)}>
                <Ionicons name="trash-outline" size={14} color={colors.error} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="document-text-outline"
            title="No issues yet"
            subtitle={search ? 'No results match your search' : 'Submit your first issue using the + tab below'}
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />

      <ConfirmDialog
        visible={!!deleteId}
        title="Delete Issue"
        message="Are you sure you want to delete this issue? This action cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16 },
  greeting: { fontSize: 13, color: colors.textMuted },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  countBadge: { backgroundColor: colors.primary, borderRadius: radius.full, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    marginHorizontal: spacing.lg, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  search: { flex: 1, height: 44, paddingHorizontal: 10, color: colors.text, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 20 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginTop: -6, marginBottom: 6, paddingHorizontal: 4 },
  deleteText: { fontSize: 12, color: colors.error },
});
```

---

### `app/(community)/submit.tsx`
```typescript
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase, uploadImage } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { ImagePickerModal } from '../../src/components/ImagePickerModal';
import { colors, spacing, radius } from '../../src/constants/theme';
import { IssueCategory } from '../../src/types';

const CATEGORIES: { value: IssueCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'maintenance', label: 'Maintenance', icon: 'construct-outline' },
  { value: 'infrastructure', label: 'Infrastructure', icon: 'business-outline' },
  { value: 'sustainability', label: 'Sustainability', icon: 'leaf-outline' },
  { value: 'cleanliness', label: 'Cleanliness', icon: 'sparkles-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export default function SubmitIssue() {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<IssueCategory>('maintenance');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!location.trim()) e.location = 'Location is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !profile) return;
    setLoading(true);
    try {
      let image_url: string | null = null;
      if (imageUri) image_url = await uploadImage(imageUri);

      const { error } = await supabase.from('issues').insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim(),
        category,
        image_url,
        created_by: profile.id,
        status: 'pending',
      });

      if (error) throw error;
      Alert.alert('Submitted!', 'Your issue has been reported successfully.', [
        { text: 'OK', onPress: resetForm },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit issue.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setLocation('');
    setCategory('maintenance'); setImageUri(null); setErrors({});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Report Issue</Text>
          <Text style={styles.sub}>Help us keep campus safe and clean</Text>

          <Input label="Issue Title" placeholder="Brief description of the problem"
            value={title} onChangeText={t => { setTitle(t); setErrors(e => ({ ...e, title: '' })); }}
            error={errors.title}
          />
          <Input label="Description (optional)" placeholder="Provide more details..."
            value={description} onChangeText={setDescription}
            multiline numberOfLines={3} style={{ height: 80, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <Input label="Location" placeholder="e.g. Building A, Room 204"
            value={location} onChangeText={t => { setLocation(t); setErrors(e => ({ ...e, location: '' })); }}
            error={errors.location}
          />

          <Text style={styles.sectionLabel}>CATEGORY</Text>
          <View style={styles.categories}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catChip, category === cat.value && styles.catActive]}
                onPress={() => setCategory(cat.value)}
                activeOpacity={0.8}
              >
                <Ionicons name={cat.icon} size={16} color={category === cat.value ? colors.primary : colors.textMuted} />
                <Text style={[styles.catText, category === cat.value && { color: colors.primary }]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionLabel}>PHOTO (OPTIONAL)</Text>
          {imageUri ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: imageUri }} style={styles.previewImg} />
              <TouchableOpacity style={styles.removeImg} onPress={() => setImageUri(null)}>
                <Ionicons name="close-circle" size={26} color={colors.error} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.changeImg} onPress={() => setShowPicker(true)}>
                <Ionicons name="camera" size={16} color="#fff" />
                <Text style={styles.changeImgText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.photoBtn} onPress={() => setShowPicker(true)}>
              <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
              <Text style={styles.photoBtnText}>Tap to add photo</Text>
              <Text style={styles.photoBtnSub}>Camera or gallery</Text>
            </TouchableOpacity>
          )}

          <Button label="Submit Issue" onPress={handleSubmit} loading={loading} style={{ marginTop: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <ImagePickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onImage={uri => setImageUri(uri)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 6, letterSpacing: -0.5 },
  sub: { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: colors.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border,
  },
  catActive: { borderColor: colors.primary, backgroundColor: 'rgba(99,102,241,0.1)' },
  catText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  photoBtn: {
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.border, borderStyle: 'dashed',
    paddingVertical: 32, alignItems: 'center', gap: 6, marginBottom: 4,
  },
  photoBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSec },
  photoBtnSub: { fontSize: 12, color: colors.textMuted },
  imagePreview: { position: 'relative', marginBottom: 4 },
  previewImg: { width: '100%', height: 200, borderRadius: radius.lg },
  removeImg: { position: 'absolute', top: 8, right: 8 },
  changeImg: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  changeImgText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
```

---

### `app/(community)/issue/[id].tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Image, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, format } from 'date-fns';
import { supabase } from '../../../src/lib/supabase';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { colors, spacing, radius } from '../../../src/constants/theme';
import { Issue, StatusHistory, Assignment } from '../../../src/types';

export default function IssueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [history, setHistory] = useState<StatusHistory[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const [{ data: issueData }, { data: historyData }, { data: assignData }] = await Promise.all([
      supabase.from('issues').select('*, creator:profiles!created_by(*)').eq('id', id).single(),
      supabase.from('status_history').select('*, changer:profiles!changed_by(name)').eq('issue_id', id).order('changed_at', { ascending: true }),
      supabase.from('assignments').select('*, worker:profiles!worker_id(*)').eq('issue_id', id).maybeSingle(),
    ]);
    setIssue(issueData);
    setHistory(historyData || []);
    setAssignment(assignData);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  if (loading) return <LoadingScreen />;
  if (!issue) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const timelineSteps = [
    { status: 'pending' as const, label: 'Issue Submitted', done: true },
    { status: 'in_progress' as const, label: 'In Progress', done: ['in_progress', 'resolved'].includes(issue.status) },
    { status: 'resolved' as const, label: 'Resolved', done: issue.status === 'resolved' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Issue Details</Text>
        <StatusBadge status={issue.status} small />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {issue.image_url && (
          <Image source={{ uri: issue.image_url }} style={styles.heroImg} />
        )}

        <Text style={styles.title}>{issue.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{issue.location}</Text>
          <View style={styles.dot} />
          <Ionicons name="time-outline" size={14} color={colors.textMuted} />
          <Text style={styles.metaText}>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</Text>
        </View>

        {issue.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.desc}>{issue.description}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
          <View style={styles.catBadge}>
            <Text style={styles.catText}>{issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}</Text>
          </View>
        </View>

        {assignment?.worker && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Worker</Text>
            <View style={styles.workerRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{assignment.worker.name.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.workerName}>{assignment.worker.name}</Text>
                <Text style={styles.workerRole}>Worker</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Status Timeline</Text>
          <View style={styles.timeline}>
            {timelineSteps.map((step, idx) => (
              <View key={step.status} style={styles.timelineStep}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepDot, step.done && styles.stepDotActive]}>
                    {step.done && <Ionicons name="checkmark" size={12} color="#fff" />}
                  </View>
                  {idx < timelineSteps.length - 1 && (
                    <View style={[styles.stepLine, timelineSteps[idx + 1].done && styles.stepLineActive]} />
                  )}
                </View>
                <View style={styles.stepContent}>
                  <Text style={[styles.stepLabel, step.done && { color: colors.text }]}>{step.label}</Text>
                  {history.find(h => h.new_status === step.status) && (
                    <Text style={styles.stepTime}>
                      {format(new Date(history.find(h => h.new_status === step.status)!.changed_at), 'MMM d, h:mm a')}
                    </Text>
                  )}
                  {step.status === 'pending' && (
                    <Text style={styles.stepTime}>
                      {format(new Date(issue.created_at), 'MMM d, h:mm a')}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.text },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  heroImg: { width: '100%', height: 220, borderRadius: radius.lg, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 10, letterSpacing: -0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 20 },
  metaText: { fontSize: 13, color: colors.textMuted },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.borderLight, marginHorizontal: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  desc: { fontSize: 15, color: colors.textSec, lineHeight: 22 },
  catBadge: { backgroundColor: colors.card, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border },
  catText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  workerName: { fontSize: 15, fontWeight: '600', color: colors.text },
  workerRole: { fontSize: 12, color: colors.textMuted },
  timeline: { paddingLeft: 4 },
  timelineStep: { flexDirection: 'row', gap: 14, marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 24 },
  stepDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: colors.success, borderColor: colors.success },
  stepLine: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 4, minHeight: 20 },
  stepLineActive: { backgroundColor: colors.success },
  stepContent: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  stepTime: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
```

---

### `app/(community)/profile.tsx`
```typescript
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/contexts/AuthContext';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { colors, spacing, radius } from '../../src/constants/theme';

const roleLabel = { community_member: 'Community Member', facility_manager: 'Facility Manager', worker: 'Worker', admin: 'Administrator' };
const roleIcon = { community_member: 'person', facility_manager: 'briefcase', worker: 'hammer', admin: 'shield-checkmark' } as const;

export default function ProfileScreen() {
  const { profile, signOut } = useAuth();
  const [showSignOut, setShowSignOut] = useState(false);
  if (!profile) return null;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.roleChip}>
              <Ionicons name={roleIcon[profile.role]} size={11} color={colors.primary} />
              <Text style={styles.roleChipText}>{roleLabel[profile.role]}</Text>
            </View>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        <View style={styles.infoCard}>
          {[
            { label: 'Account Status', value: profile.is_active ? 'Active' : 'Inactive', icon: 'checkmark-circle-outline' as const },
            { label: 'Role', value: roleLabel[profile.role], icon: 'shield-outline' as const },
            { label: 'Member Since', value: new Date(profile.created_at).getFullYear().toString(), icon: 'calendar-outline' as const },
          ].map((item, idx, arr) => (
            <View key={item.label} style={[styles.infoRow, idx < arr.length - 1 && styles.infoRowBorder]}>
              <Ionicons name={item.icon} size={16} color={colors.textMuted} />
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={() => setShowSignOut(true)}>
          <Ionicons name="log-out-outline" size={20} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmDialog
        visible={showSignOut}
        title="Sign Out"
        message="Are you sure you want to sign out of CampusCare?"
        confirmLabel="Sign Out"
        onConfirm={signOut}
        onCancel={() => setShowSignOut(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 24, letterSpacing: -0.5 },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  avatarWrap: { alignItems: 'center', marginBottom: 14 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '800' },
  roleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  roleChipText: { fontSize: 11, fontWeight: '700', color: colors.primary },
  name: { fontSize: 22, fontWeight: '700', color: colors.text },
  email: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  infoCard: { backgroundColor: colors.card, borderRadius: radius.xl, marginBottom: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { flex: 1, fontSize: 14, color: colors.textSec },
  infoValue: { fontSize: 14, fontWeight: '600', color: colors.text },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, backgroundColor: colors.errorBg, borderRadius: radius.md, borderWidth: 1, borderColor: `${colors.error}33` },
  signOutText: { fontSize: 15, fontWeight: '600', color: colors.error },
});
```

---

## STEP 9 — Facility Manager Screens

### `app/(manager)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

export default function ManagerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 10 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'All Issues', tabBarIcon: ({ color, size }) => <Ionicons name="layers-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="issue/[id]" options={{ href: null }} />
    </Tabs>
  );
}
```

---

### `app/(manager)/index.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  TouchableOpacity, TextInput, RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { IssueCard } from '../../src/components/IssueCard';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Issue, IssueStatus } from '../../src/types';

const FILTERS: { label: string; value: IssueStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
];

export default function ManagerIssues() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<IssueStatus | 'all'>('all');

  const counts = {
    all: issues.length,
    pending: issues.filter(i => i.status === 'pending').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
  };

  const fetchIssues = async () => {
    const { data } = await supabase
      .from('issues')
      .select('*, creator:profiles!created_by(name, email)')
      .order('created_at', { ascending: false });
    setIssues(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchIssues(); }, []));

  const filtered = issues.filter(i => {
    const matchStatus = filter === 'all' || i.status === filter;
    const matchSearch = i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.location.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>Facility Manager</Text>
          <Text style={styles.title}>All Issues</Text>
        </View>
        <View style={styles.totalBadge}>
          <Text style={styles.totalText}>{issues.length}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: 'Pending', count: counts.pending, color: colors.pending },
          { label: 'In Progress', count: counts.in_progress, color: colors.inProgress },
          { label: 'Resolved', count: counts.resolved, color: colors.resolved },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.search}
          placeholder="Search by title or location..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, filter === f.value && styles.filterActive]}
            onPress={() => setFilter(f.value)}
          >
            <Text style={[styles.filterText, filter === f.value && styles.filterTextActive]}>
              {f.label} ({counts[f.value]})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <IssueCard issue={item} onPress={() => router.push(`/(manager)/issue/${item.id}`)} />
        )}
        ListEmptyComponent={<EmptyState icon="layers-outline" title="No issues found" subtitle="No issues match your current filters" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchIssues(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16 },
  role: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  totalBadge: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  totalText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  statsRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  statCount: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, marginHorizontal: spacing.lg, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, height: 44, paddingHorizontal: 10, color: colors.text, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: colors.primary },
  filterText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 20 },
});
```

---

### `app/(manager)/issue/[id].tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/contexts/AuthContext';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';
import { colors, spacing, radius } from '../../../src/constants/theme';
import { Issue, Profile, Assignment, IssueStatus } from '../../../src/types';

export default function ManagerIssueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [workers, setWorkers] = useState<Profile[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showWorkers, setShowWorkers] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchData = async () => {
    const [{ data: issueData }, { data: workersData }, { data: assignData }] = await Promise.all([
      supabase.from('issues').select('*, creator:profiles!created_by(*)').eq('id', id).single(),
      supabase.from('profiles').select('*').eq('role', 'worker').eq('is_active', true),
      supabase.from('assignments').select('*, worker:profiles!worker_id(*)').eq('issue_id', id).maybeSingle(),
    ]);
    setIssue(issueData);
    setWorkers(workersData || []);
    setAssignment(assignData);
    setSelectedWorker(assignData?.worker_id || null);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  const handleAssign = async () => {
    if (!selectedWorker || !profile) return;
    setAssigning(true);
    try {
      if (assignment) await supabase.from('assignments').delete().eq('id', assignment.id);
      await supabase.from('assignments').insert({ issue_id: id, worker_id: selectedWorker, assigned_by: profile.id });
      if (issue?.status === 'pending') {
        await supabase.from('issues').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', id);
        await supabase.from('status_history').insert({ issue_id: id, old_status: 'pending', new_status: 'in_progress', changed_by: profile.id, note: 'Worker assigned' });
      }
      Alert.alert('Assigned!', 'Worker has been assigned to this issue.');
      fetchData();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setAssigning(false); setShowWorkers(false); }
  };

  const handleUpdateStatus = async (newStatus: IssueStatus) => {
    if (!profile || !issue) return;
    setUpdating(true);
    try {
      await supabase.from('issues').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('status_history').insert({ issue_id: id, old_status: issue.status, new_status: newStatus, changed_by: profile.id });
      fetchData();
      if (newStatus === 'resolved') setShowClose(false);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  const handleDelete = async () => {
    await supabase.from('issues').delete().eq('id', id);
    setShowDelete(false);
    router.back();
  };

  if (loading) return <LoadingScreen />;
  if (!issue) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{issue.title}</Text>
        <StatusBadge status={issue.status} small />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {issue.image_url && <Image source={{ uri: issue.image_url }} style={styles.heroImg} />}
        <Text style={styles.title}>{issue.title}</Text>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <Text style={styles.meta}>{issue.location}</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.meta}>{formatDistanceToNow(new Date(issue.created_at), { addSuffix: true })}</Text>
        </View>
        {issue.description ? <Text style={styles.desc}>{issue.description}</Text> : null}

        {/* Assign Worker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ASSIGN WORKER</Text>
          <TouchableOpacity style={styles.workerSelector} onPress={() => setShowWorkers(s => !s)}>
            {assignment?.worker ? (
              <View style={styles.assignedWorker}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{(assignment.worker as Profile).name.charAt(0)}</Text></View>
                <View>
                  <Text style={styles.workerName}>{(assignment.worker as Profile).name}</Text>
                  <Text style={styles.workerSub}>Currently assigned</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noWorker}>Tap to assign a worker</Text>
            )}
            <Ionicons name={showWorkers ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
          </TouchableOpacity>

          {showWorkers && (
            <View style={styles.workerList}>
              {workers.map(w => (
                <TouchableOpacity
                  key={w.id}
                  style={[styles.workerOption, selectedWorker === w.id && styles.workerOptionActive]}
                  onPress={() => setSelectedWorker(w.id)}
                >
                  <View style={styles.wAvatar}><Text style={styles.wAvatarText}>{w.name.charAt(0)}</Text></View>
                  <Text style={[styles.wName, selectedWorker === w.id && { color: colors.primary }]}>{w.name}</Text>
                  {selectedWorker === w.id && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              <Button label={assigning ? 'Assigning...' : 'Confirm Assignment'} onPress={handleAssign} loading={assigning} style={{ marginTop: 10 }} />
            </View>
          )}
        </View>

        {/* Status Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIONS</Text>
          <View style={styles.actionRow}>
            {issue.status !== 'in_progress' && issue.status !== 'resolved' && (
              <Button label="Mark In Progress" onPress={() => handleUpdateStatus('in_progress')} loading={updating} variant="secondary" style={{ flex: 1 }} />
            )}
            {issue.status !== 'resolved' && (
              <Button label="Close Issue" onPress={() => setShowClose(true)} variant="primary" style={{ flex: 1 }} />
            )}
          </View>
          <Button label="Delete Issue" onPress={() => setShowDelete(true)} variant="danger" style={{ marginTop: 10 }} />
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={showClose}
        title="Close Issue"
        message="Mark this issue as resolved? This will notify the community member."
        confirmLabel="Resolve"
        onConfirm={() => handleUpdateStatus('resolved')}
        onCancel={() => setShowClose(false)}
      />
      <ConfirmDialog
        visible={showDelete}
        title="Delete Issue"
        message="Permanently delete this issue? This cannot be undone."
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 40 },
  heroImg: { width: '100%', height: 200, borderRadius: radius.lg, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  meta: { fontSize: 13, color: colors.textMuted },
  dot: { color: colors.textMuted },
  desc: { fontSize: 14, color: colors.textSec, lineHeight: 21, marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 10 },
  workerSelector: { backgroundColor: colors.card, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border },
  assignedWorker: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  workerName: { fontSize: 14, fontWeight: '600', color: colors.text },
  workerSub: { fontSize: 11, color: colors.textMuted },
  noWorker: { fontSize: 14, color: colors.textMuted },
  workerList: { backgroundColor: colors.card, borderRadius: radius.md, padding: 12, marginTop: 8, borderWidth: 1, borderColor: colors.border },
  workerOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8, borderRadius: radius.sm },
  workerOptionActive: { backgroundColor: 'rgba(99,102,241,0.08)' },
  wAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  wAvatarText: { color: colors.text, fontWeight: '700' },
  wName: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  actionRow: { flexDirection: 'row', gap: 10 },
});
```

---

### `app/(manager)/profile.tsx`

**Copy the exact same content as `app/(community)/profile.tsx`** — it works for all roles.

---

## STEP 10 — Worker Screens

### `app/(worker)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

export default function WorkerLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 10 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'My Tasks', tabBarIcon: ({ color, size }) => <Ionicons name="checkbox-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="task/[id]" options={{ href: null }} />
    </Tabs>
  );
}
```

---

### `app/(worker)/index.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { IssueCard } from '../../src/components/IssueCard';
import { EmptyState } from '../../src/components/EmptyState';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { colors, spacing } from '../../src/constants/theme';
import { Issue } from '../../src/types';

export default function WorkerTasks() {
  const { profile } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTasks = async () => {
    if (!profile) return;
    const { data: assignments } = await supabase
      .from('assignments')
      .select('issue_id')
      .eq('worker_id', profile.id);
    if (!assignments?.length) { setTasks([]); setLoading(false); setRefreshing(false); return; }
    const ids = assignments.map(a => a.issue_id);
    const { data } = await supabase
      .from('issues')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchTasks(); }, [profile]));

  if (loading) return <LoadingScreen />;

  const active = tasks.filter(t => t.status !== 'resolved');
  const done = tasks.filter(t => t.status === 'resolved');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <Text style={styles.role}>Worker Dashboard</Text>
        <Text style={styles.title}>My Tasks</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statN, { color: colors.inProgress }]}>{active.length}</Text>
          <Text style={styles.statL}>Active</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statN, { color: colors.resolved }]}>{done.length}</Text>
          <Text style={styles.statL}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={[styles.statN, { color: colors.text }]}>{tasks.length}</Text>
          <Text style={styles.statL}>Total</Text>
        </View>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={t => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <IssueCard issue={item} onPress={() => router.push(`/(worker)/task/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="checkbox-outline"
            title="No tasks assigned"
            subtitle="You'll see your assignments here once a manager assigns you to an issue"
          />
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchTasks(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16 },
  role: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  statsRow: { flexDirection: 'row', backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: 12, marginBottom: 14, padding: 16, borderWidth: 1, borderColor: colors.border },
  stat: { flex: 1, alignItems: 'center' },
  statN: { fontSize: 24, fontWeight: '800' },
  statL: { fontSize: 11, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 20 },
});
```

---

### `app/(worker)/task/[id].tsx`
```typescript
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { supabase, uploadImage } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/contexts/AuthContext';
import { LoadingScreen } from '../../../src/components/LoadingScreen';
import { StatusBadge } from '../../../src/components/StatusBadge';
import { Button } from '../../../src/components/Button';
import { ImagePickerModal } from '../../../src/components/ImagePickerModal';
import { colors, spacing, radius } from '../../../src/constants/theme';
import { Issue, Comment } from '../../../src/types';

export default function WorkerTaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentImg, setCommentImg] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const fetchData = async () => {
    const [{ data: issueData }, { data: commentsData }] = await Promise.all([
      supabase.from('issues').select('*').eq('id', id).single(),
      supabase.from('comments').select('*, author:profiles!user_id(name, role)').eq('issue_id', id).order('created_at', { ascending: true }),
    ]);
    setIssue(issueData);
    setComments(commentsData || []);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [id]));

  const handleMarkInProgress = async () => {
    if (!profile || !issue) return;
    setUpdating(true);
    try {
      await supabase.from('issues').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', id);
      await supabase.from('status_history').insert({ issue_id: id, old_status: issue.status, new_status: 'in_progress', changed_by: profile.id });
      fetchData();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setUpdating(false); }
  };

  const handleSendComment = async () => {
    if (!commentText.trim() && !commentImg) return;
    if (!profile) return;
    setSending(true);
    try {
      let image_url: string | null = null;
      if (commentImg) image_url = await uploadImage(commentImg, 'comments');
      const { data } = await supabase.from('comments').insert({
        issue_id: id,
        user_id: profile.id,
        content: commentText.trim() || null,
        image_url,
      }).select('*, author:profiles!user_id(name, role)').single();
      if (data) setComments(prev => [...prev, data]);
      setCommentText('');
      setCommentImg(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSending(false); }
  };

  if (loading) return <LoadingScreen />;
  if (!issue) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={10}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.navTitle} numberOfLines={1}>{issue.title}</Text>
          <StatusBadge status={issue.status} small />
        </View>

        <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {issue.image_url && <Image source={{ uri: issue.image_url }} style={styles.heroImg} />}
          <Text style={styles.title}>{issue.title}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.meta}>{issue.location}</Text>
          </View>
          {issue.description ? <Text style={styles.desc}>{issue.description}</Text> : null}

          {issue.status === 'pending' && (
            <Button label="Mark as In Progress" onPress={handleMarkInProgress} loading={updating} style={{ marginBottom: 20 }} />
          )}

          {/* Comments */}
          <Text style={styles.sectionTitle}>COMMENTS & UPDATES</Text>
          {comments.length === 0 ? (
            <View style={styles.noComments}>
              <Text style={styles.noCommentsText}>No comments yet. Add the first update.</Text>
            </View>
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.comment}>
                <View style={styles.commentAvatar}>
                  <Text style={styles.commentAvatarText}>{(c.author as any)?.name?.charAt(0) ?? '?'}</Text>
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.commentAuthor}>{(c.author as any)?.name ?? 'Unknown'}</Text>
                    <Text style={styles.commentTime}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</Text>
                  </View>
                  {c.content ? <Text style={styles.commentText}>{c.content}</Text> : null}
                  {c.image_url ? (
                    <Image source={{ uri: c.image_url }} style={styles.commentImg} />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </ScrollView>

        {/* Comment Input */}
        <View style={styles.inputArea}>
          {commentImg && (
            <View style={styles.imgPreviewRow}>
              <Image source={{ uri: commentImg }} style={styles.imgThumb} />
              <TouchableOpacity onPress={() => setCommentImg(null)} style={styles.removeThumb}>
                <Ionicons name="close-circle" size={18} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.photoIcon} onPress={() => setShowPicker(true)}>
              <Ionicons name="camera-outline" size={22} color={colors.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={styles.textInput}
              placeholder="Add a comment or update..."
              placeholderTextColor={colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() && !commentImg) && styles.sendDisabled]}
              onPress={handleSendComment}
              disabled={(!commentText.trim() && !commentImg) || sending}
            >
              <Ionicons name="send" size={18} color={(!commentText.trim() && !commentImg) ? colors.textMuted : '#fff'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ImagePickerModal
        visible={showPicker}
        onClose={() => setShowPicker(false)}
        onImage={uri => setCommentImg(uri)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  navBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 20 },
  heroImg: { width: '100%', height: 180, borderRadius: radius.lg, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  meta: { fontSize: 13, color: colors.textMuted },
  desc: { fontSize: 14, color: colors.textSec, lineHeight: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 14 },
  noComments: { backgroundColor: colors.card, borderRadius: radius.md, padding: 16, alignItems: 'center', marginBottom: 16 },
  noCommentsText: { color: colors.textMuted, fontSize: 13 },
  comment: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  commentAvatarText: { color: '#fff', fontWeight: '700' },
  commentBody: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.border },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: colors.text },
  commentTime: { fontSize: 11, color: colors.textMuted },
  commentText: { fontSize: 14, color: colors.textSec, lineHeight: 20 },
  commentImg: { width: '100%', height: 150, borderRadius: radius.sm, marginTop: 8 },
  inputArea: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 10 },
  imgPreviewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  imgThumb: { width: 56, height: 56, borderRadius: radius.sm },
  removeThumb: { marginLeft: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  photoIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  textInput: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, color: colors.text, fontSize: 14, maxHeight: 90, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: colors.card },
});
```

---

### `app/(worker)/profile.tsx`

**Copy the exact same content as `app/(community)/profile.tsx`.**

---

## STEP 11 — Admin Screens

### `app/(admin)/_layout.tsx`
```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/constants/theme';

export default function AdminLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 10 },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Users', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
```

---

### `app/(admin)/index.tsx`
```typescript
import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, RefreshControl, Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/contexts/AuthContext';
import { LoadingScreen } from '../../src/components/LoadingScreen';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, spacing, radius } from '../../src/constants/theme';
import { Profile, UserRole } from '../../src/types';

const ROLE_FILTERS: { label: string; value: UserRole | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Members', value: 'community_member' },
  { label: 'Managers', value: 'facility_manager' },
  { label: 'Workers', value: 'worker' },
];

const roleColors: Record<UserRole, string> = {
  community_member: colors.textSec,
  facility_manager: colors.warning,
  worker: colors.inProgress,
  admin: colors.primary,
};

const roleLabel: Record<UserRole, string> = {
  community_member: 'Member',
  facility_manager: 'Manager',
  worker: 'Worker',
  admin: 'Admin',
};

export default function AdminUsers() {
  const { profile: adminProfile } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'activate' | 'delete'; user: Profile } | null>(null);

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => { fetchUsers(); }, []));

  const filtered = users.filter(u => {
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    return matchRole && matchSearch;
  });

  const handleToggleActive = async () => {
    if (!confirmAction) return;
    const { user } = confirmAction;
    const newActive = !user.is_active;
    await supabase.from('profiles').update({ is_active: newActive }).eq('id', user.id);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: newActive } : u));
    setConfirmAction(null);
  };

  const handleDelete = async () => {
    if (!confirmAction) return;
    await supabase.from('profiles').delete().eq('id', confirmAction.user.id);
    setUsers(prev => prev.filter(u => u.id !== confirmAction.user.id));
    setConfirmAction(null);
  };

  if (loading) return <LoadingScreen />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.role}>System Admin</Text>
          <Text style={styles.title}>Users</Text>
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>{users.length}</Text></View>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.search}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterRow}>
        {ROLE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, roleFilter === f.value && styles.filterActive]}
            onPress={() => setRoleFilter(f.value)}
          >
            <Text style={[styles.filterText, roleFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => u.id}
        contentContainerStyle={styles.list}
        renderItem={({ item: user }) => {
          const isMe = user.id === adminProfile?.id;
          return (
            <View style={[styles.userCard, !user.is_active && styles.userInactive]}>
              <View style={styles.userLeft}>
                <View style={[styles.avatar, { backgroundColor: isMe ? colors.primary : colors.cardAlt }]}>
                  <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.userInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName} numberOfLines={1}>{user.name}</Text>
                    {isMe && <Text style={styles.meBadge}>🔒 You</Text>}
                  </View>
                  <Text style={styles.userEmail} numberOfLines={1}>{user.email}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.roleBadge, { backgroundColor: `${roleColors[user.role]}20` }]}>
                      <Text style={[styles.roleText, { color: roleColors[user.role] }]}>{roleLabel[user.role]}</Text>
                    </View>
                    {!user.is_active && (
                      <View style={styles.inactiveBadge}>
                        <Text style={styles.inactiveText}>Inactive</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {!isMe && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, user.is_active ? styles.deactivateBtn : styles.activateBtn]}
                    onPress={() => setConfirmAction({ type: user.is_active ? 'deactivate' : 'activate', user })}
                  >
                    <Ionicons
                      name={user.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={18}
                      color={user.is_active ? colors.warning : colors.success}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.deleteBtn]}
                    onPress={() => setConfirmAction({ type: 'delete', user })}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<EmptyState icon="people-outline" title="No users found" subtitle="No users match your current filters" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchUsers(); }} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      />

      <ConfirmDialog
        visible={!!confirmAction && confirmAction.type !== 'delete'}
        title={confirmAction?.type === 'deactivate' ? 'Deactivate User' : 'Activate User'}
        message={
          confirmAction?.type === 'deactivate'
            ? `Deactivate ${confirmAction?.user.name}? They won't be able to log in.`
            : `Reactivate ${confirmAction?.user.name}? They will regain access.`
        }
        confirmLabel={confirmAction?.type === 'deactivate' ? 'Deactivate' : 'Activate'}
        danger={confirmAction?.type === 'deactivate'}
        onConfirm={handleToggleActive}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        visible={!!confirmAction && confirmAction.type === 'delete'}
        title="Delete User"
        message={`Permanently delete ${confirmAction?.user.name}? All their data will be lost.`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmAction(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: 16 },
  role: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  badge: { width: 36, height: 36, borderRadius: radius.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, marginHorizontal: spacing.lg, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, height: 44, paddingHorizontal: 10, color: colors.text, fontSize: 14 },
  filterRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 8, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: 'rgba(99,102,241,0.15)', borderColor: colors.primary },
  filterText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  filterTextActive: { color: colors.primary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 20 },
  userCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  userInactive: { opacity: 0.6 },
  userLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: colors.text, fontWeight: '700', fontSize: 16 },
  userInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  userName: { fontSize: 15, fontWeight: '700', color: colors.text },
  meBadge: { fontSize: 11, color: colors.textMuted },
  userEmail: { fontSize: 12, color: colors.textMuted, marginTop: 1, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 6 },
  roleBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontWeight: '700' },
  inactiveBadge: { backgroundColor: colors.errorBg, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  inactiveText: { fontSize: 11, color: colors.error, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
  actionBtn: { width: 38, height: 38, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  deactivateBtn: { backgroundColor: `${colors.warning}18` },
  activateBtn: { backgroundColor: `${colors.success}18` },
  deleteBtn: { backgroundColor: colors.errorBg },
});
```

---

### `app/(admin)/profile.tsx`

**Copy the exact same content as `app/(community)/profile.tsx`.**

---

## STEP 12 — Final Setup

Run these commands to start the project:

```bash
cd C:/campuscareFP
npm install
node scripts/createAdmin.js
npx expo start --tunnel
```

Scan the QR code with Expo Go on your phone.

---

## CHECKLIST — Verify All Files Created

```
campuscareFP/
├── .env
├── app.json
├── babel.config.js
├── package.json
├── tsconfig.json
├── scripts/
│   └── createAdmin.js
├── src/
│   ├── constants/theme.ts
│   ├── types/index.ts
│   ├── lib/supabase.ts
│   ├── contexts/AuthContext.tsx
│   └── components/
│       ├── Button.tsx
│       ├── ConfirmDialog.tsx
│       ├── EmptyState.tsx
│       ├── ImagePickerModal.tsx
│       ├── Input.tsx
│       ├── IssueCard.tsx
│       ├── LoadingScreen.tsx
│       └── StatusBadge.tsx
└── app/
    ├── _layout.tsx
    ├── index.tsx
    ├── (auth)/
    │   ├── _layout.tsx
    │   ├── login.tsx
    │   └── register.tsx
    ├── (community)/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── submit.tsx
    │   ├── profile.tsx
    │   └── issue/[id].tsx
    ├── (manager)/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── profile.tsx          ← same as community/profile.tsx
    │   └── issue/[id].tsx
    ├── (worker)/
    │   ├── _layout.tsx
    │   ├── index.tsx
    │   ├── profile.tsx          ← same as community/profile.tsx
    │   └── task/[id].tsx
    └── (admin)/
        ├── _layout.tsx
        ├── index.tsx
        └── profile.tsx          ← same as community/profile.tsx
```

---

## NOTES FOR CLAUDE CODE

1. The three `profile.tsx` files for `(manager)`, `(worker)`, and `(admin)` are **identical copies** of `(community)/profile.tsx` — just copy the file content.
2. Make sure `app/(community)/issue/` is a **folder**, not a file — the `[id].tsx` file goes inside it. Same for `(manager)/issue/[id].tsx` and `(worker)/task/[id].tsx`.
3. If you see TypeScript errors about `@expo/vector-icons`, add `"types": ["@expo/vector-icons"]` to tsconfig or just ignore — they compile fine.
4. The `.env` file must be at the project root. Expo automatically loads `EXPO_PUBLIC_*` variables.
5. Run `node scripts/createAdmin.js` **after** running the Supabase SQL — the profiles table must exist first.
6. For the `expo start --tunnel` to work on a phone, make sure Expo Go is installed and you're on the same WiFi as your dev machine (192.168.1.6).
