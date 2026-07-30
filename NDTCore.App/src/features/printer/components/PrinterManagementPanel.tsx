// src/features/printer/components/PrinterManagementPanel.tsx
import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppButton } from '../../../components/AppButton';
import { PrinterService } from '../services/PrinterService';
import { PrinterList } from './PrinterList';
import { AddPrinterModal } from './AddPrinterModal';
import type { PrinterConfig } from '../types/printer.types';

export const PrinterManagementPanel: React.FC = () => {
  const [printers, setPrinters] = useState<PrinterConfig[]>(() => PrinterService.getPrinters());
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<PrinterConfig | undefined>(undefined);

  const refresh = useCallback(() => {
    setPrinters(PrinterService.getPrinters());
  }, []);

  const openAddModal = (): void => {
    setEditingPrinter(undefined);
    setModalVisible(true);
  };

  const openEditModal = (printer: PrinterConfig): void => {
    setEditingPrinter(printer);
    setModalVisible(true);
  };

  const closeModal = (): void => setModalVisible(false);

  const onSaved = (): void => {
    closeModal();
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="titleSmall">Quản lý máy in</Text>
        <AppButton label="Thêm máy in" onPress={openAddModal} />
      </View>

      <PrinterList printers={printers} onEdit={openEditModal} onChanged={refresh} />

      <AddPrinterModal
        key={editingPrinter?.id ?? 'add'}
        visible={modalVisible}
        initialValues={editingPrinter}
        onDismiss={closeModal}
        onSaved={onSaved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
