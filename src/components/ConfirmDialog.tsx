import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/constants/theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
              <Text style={styles.cancelLabel}>{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: danger ? colors.error : colors.primary }]}
              onPress={onConfirm}
              activeOpacity={0.75}
            >
              <Text style={styles.confirmLabel}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  message: {
    color: colors.textSec,
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    color: colors.textSec,
    fontWeight: '600',
    fontSize: 15,
  },
  confirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
});
