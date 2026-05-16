import React from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing } from '@/constants/theme';

interface ImagePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string) => void;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  allowsEditing: true,
  aspect: [4, 3],
  quality: 0.8,
  mediaTypes: ['images'],
};

export default function ImagePickerModal({ visible, onClose, onImageSelected }: ImagePickerModalProps) {
  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) {
      onImageSelected(result.assets[0].uri);
      onClose();
    }
  }

  async function handleLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Photo library access is needed to choose an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) {
      onImageSelected(result.assets[0].uri);
      onClose();
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />

          <Text style={styles.title}>Add Photo</Text>

          <TouchableOpacity style={styles.option} onPress={handleCamera} activeOpacity={0.75}>
            <View style={styles.optionIcon}>
              <Ionicons name="camera-outline" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.optionLabel}>Take Photo</Text>
              <Text style={styles.optionSub}>Open camera to take a new photo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleLibrary} activeOpacity={0.75}>
            <View style={styles.optionIcon}>
              <Ionicons name="images-outline" size={22} color={colors.accent} />
            </View>
            <View>
              <Text style={styles.optionLabel}>Choose from Library</Text>
              <Text style={styles.optionSub}>Select an existing photo</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.75}>
            <Text style={styles.cancelLabel}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.borderLight,
    borderRadius: radius.full,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  optionSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: spacing.xs,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textSec,
    fontSize: 15,
    fontWeight: '600',
  },
});
