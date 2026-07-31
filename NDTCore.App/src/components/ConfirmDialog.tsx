// src/components/ConfirmDialog.tsx
import React from 'react';
import { Portal, Dialog, Text, Button } from 'react-native-paper';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  onConfirm,
  onCancel,
}) => (
  <Portal>
    <Dialog visible={visible} onDismiss={onCancel}>
      <Dialog.Title>{title}</Dialog.Title>
      <Dialog.Content>
        <Text>{message}</Text>
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onCancel}>{cancelLabel}</Button>
        <Button onPress={onConfirm}>{confirmLabel}</Button>
      </Dialog.Actions>
    </Dialog>
  </Portal>
);
