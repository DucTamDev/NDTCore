// src/features/settings/components/SettingsContent.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PrinterManagementPanel } from '../../printer/components/PrinterManagementPanel';

export const SettingsContent: React.FC = () => (
  <View style={styles.container}>
    <PrinterManagementPanel />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
});
