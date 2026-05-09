import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, uploadImage } from '@/lib/supabase';
import Input from '@/components/Input';
import Button from '@/components/Button';
import ImagePickerModal from '@/components/ImagePickerModal';
import { colors, radius, spacing } from '@/constants/theme';
import { IssueCategory } from '@/types';

interface CategoryOption {
  value: IssueCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: 'maintenance',    label: 'Maintenance',    icon: 'construct-outline',                  color: '#F59E0B' },
  { value: 'infrastructure', label: 'Infrastructure', icon: 'business-outline',                   color: '#6366F1' },
  { value: 'sustainability', label: 'Sustainability', icon: 'leaf-outline',                       color: '#10B981' },
  { value: 'cleanliness',    label: 'Cleanliness',    icon: 'water-outline',                      color: '#38BDF8' },
  { value: 'other',          label: 'Other',          icon: 'ellipsis-horizontal-circle-outline', color: '#94A3B8' },
];

export default function SubmitScreen() {
  const { profile } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<IssueCategory | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [titleError, setTitleError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [loading, setLoading] = useState(false);

  function validate() {
    let valid = true;
    if (!title.trim()) { setTitleError('Title is required'); valid = false; } else setTitleError('');
    if (!location.trim()) { setLocationError('Location is required'); valid = false; } else setLocationError('');
    if (!category) { setCategoryError('Please select a category'); valid = false; } else setCategoryError('');
    return valid;
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setLocation('');
    setCategory(null);
    setImageUri(null);
  }

  async function handleSubmit() {
    if (!validate()) return;
    setLoading(true);
    try {
      let image_url: string | null = null;
      if (imageUri) {
        image_url = await uploadImage(imageUri, 'issues');
      }

      const { error } = await supabase.from('issues').insert({
        title: title.trim(),
        description: description.trim() || null,
        location: location.trim(),
        category,
        status: 'pending',
        image_url,
        created_by: profile!.id,
      });

      if (error) {
        Alert.alert('Submission Failed', error.message);
        return;
      }

      Alert.alert('Issue Submitted', 'Your issue has been submitted successfully.', [
        { text: 'OK', onPress: resetForm },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Submit Issue</Text>
          <Text style={styles.sub}>Report a campus problem and we'll get it resolved.</Text>

          <Input
            label="Issue Title *"
            value={title}
            onChangeText={(t) => { setTitle(t); if (titleError) setTitleError(''); }}
            placeholder="e.g. Broken street light near Block C"
            error={titleError}
          />

          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue in detail..."
            multiline
            numberOfLines={4}
            style={{ height: 100, paddingTop: 14, paddingBottom: 14, textAlignVertical: 'top' }}
          />

          <Input
            label="Location *"
            value={location}
            onChangeText={(t) => { setLocation(t); if (locationError) setLocationError(''); }}
            placeholder="e.g. Block A, 2nd Floor Corridor"
            error={locationError}
          />

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category *</Text>
            {categoryError ? <Text style={styles.fieldError}>{categoryError}</Text> : null}
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const selected = category === cat.value;
                return (
                  <TouchableOpacity
                    key={cat.value}
                    style={[styles.categoryChip, selected && { borderColor: cat.color, backgroundColor: `${cat.color}18` }]}
                    onPress={() => { setCategory(cat.value); if (categoryError) setCategoryError(''); }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={cat.icon} size={16} color={selected ? cat.color : colors.textMuted} />
                    <Text style={[styles.categoryChipText, selected && { color: cat.color }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Photo */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photo (optional)</Text>
            {imageUri ? (
              <View style={styles.previewBox}>
                <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
                <View style={styles.previewActions}>
                  <TouchableOpacity
                    style={styles.previewBtn}
                    onPress={() => setPickerVisible(true)}
                  >
                    <Ionicons name="camera-outline" size={16} color={colors.text} />
                    <Text style={styles.previewBtnText}>Change</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.previewBtn, styles.removeBtn]}
                    onPress={() => setImageUri(null)}
                  >
                    <Ionicons name="close" size={16} color={colors.error} />
                    <Text style={[styles.previewBtnText, { color: colors.error }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.uploadBox} onPress={() => setPickerVisible(true)} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={28} color={colors.textMuted} />
                <Text style={styles.uploadText}>Tap to add a photo</Text>
                <Text style={styles.uploadSub}>Camera or gallery</Text>
              </TouchableOpacity>
            )}
          </View>

          <Button
            label="Submit Issue"
            onPress={handleSubmit}
            loading={loading}
            style={styles.submitBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <ImagePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onImageSelected={setImageUri}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  heading: { color: colors.text, fontSize: 24, fontWeight: '800' },
  sub: { color: colors.textSec, fontSize: 14, marginTop: -spacing.xs },
section: { gap: spacing.sm },
  sectionLabel: { color: colors.textSec, fontSize: 13, fontWeight: '500' },
  fieldError: { color: colors.error, fontSize: 12 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  categoryChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.card,
  },
  uploadText: { color: colors.textSec, fontSize: 14, fontWeight: '500' },
  uploadSub: { color: colors.textMuted, fontSize: 12 },
  previewBox: { gap: spacing.sm },
  preview: { width: '100%', height: 180, borderRadius: radius.md },
  previewActions: { flexDirection: 'row', gap: spacing.sm },
  previewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  removeBtn: { borderColor: colors.error, backgroundColor: colors.errorBg },
  previewBtnText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  submitBtn: { marginTop: spacing.sm },
});
