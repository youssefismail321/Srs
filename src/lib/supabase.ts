import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);

export async function uploadImage(uri: string, folder = 'issues'): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();

  const ext = uri.split('.').pop() ?? 'jpg';
  const fileName = `${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('issue-images')
    .upload(fileName, blob, { contentType: blob.type });

  if (error) throw error;

  const { data } = supabase.storage.from('issue-images').getPublicUrl(fileName);
  return data.publicUrl;
}
