// src/components/EmptyState.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export interface EmptyStateProps {
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message }) => (
  <View style={styles.container}>
    <Text variant="bodyMedium">{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { padding: 24, alignItems: 'center', justifyContent: 'center' },
});
