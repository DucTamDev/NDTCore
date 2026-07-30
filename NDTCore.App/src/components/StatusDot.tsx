// src/components/StatusDot.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { PrinterStatus } from '../features/printer/types/printer.types';

const colorByStatus: Record<PrinterStatus, string> = {
  idle: '#9CA3AF',
  connecting: '#F59E0B',
  connected: '#16A34A',
  disconnecting: '#F59E0B',
  disconnected: '#DC2626',
  reconnecting: '#F59E0B',
  error: '#DC2626',
};

export interface StatusDotProps {
  status: PrinterStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => (
  <View style={[styles.dot, { backgroundColor: colorByStatus[status] }]} />
);

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
});
