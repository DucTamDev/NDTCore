// src/components/LoadingOverlay.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';

export const LoadingOverlay: React.FC = () => (
  <View style={styles.container}>
    <ActivityIndicator animating size="small" />
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 16, alignItems: 'center', justifyContent: 'center' },
});
