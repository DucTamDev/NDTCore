// src/features/settings/screens/SettingsScreen.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SettingsSidebar } from '../components/SettingsSidebar';
import { SettingsContent } from '../components/SettingsContent';

export const SettingsScreen: React.FC = () => (
  <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
    <View style={styles.header}>
      <Text variant="titleMedium">Cài đặt</Text>
    </View>
    <View style={styles.body}>
      <SettingsSidebar />
      <SettingsContent />
    </View>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  body: { flex: 1, flexDirection: 'row' },
});
