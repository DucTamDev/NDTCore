// src/features/printer/components/PrinterStatusBadge.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import type { PrinterStatus } from '../types/printer.types';

const labelByStatus: Record<PrinterStatus, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang kết nối',
  connected: 'Đã kết nối',
  disconnecting: 'Đang ngắt kết nối',
  disconnected: 'Mất kết nối',
  reconnecting: 'Đang kết nối lại',
  error: 'Lỗi',
};

const colorByStatus: Record<PrinterStatus, { bg: string; fg: string }> = {
  idle: { bg: '#F3F4F6', fg: '#6B7280' },
  connecting: { bg: '#FEF3C7', fg: '#B45309' },
  connected: { bg: '#DCFCE7', fg: '#15803D' },
  disconnecting: { bg: '#FEF3C7', fg: '#B45309' },
  disconnected: { bg: '#FEE2E2', fg: '#B91C1C' },
  reconnecting: { bg: '#FEF3C7', fg: '#B45309' },
  error: { bg: '#FEE2E2', fg: '#B91C1C' },
};

export interface PrinterStatusBadgeProps {
  status: PrinterStatus;
}

export const PrinterStatusBadge: React.FC<PrinterStatusBadgeProps> = ({ status }) => {
  const colors = colorByStatus[status];
  return (
    <Text style={[styles.badge, { backgroundColor: colors.bg, color: colors.fg }]}>
      {labelByStatus[status]}
    </Text>
  );
};

const styles = StyleSheet.create({
  badge: { fontSize: 12, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, overflow: 'hidden' },
});
