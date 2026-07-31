// src/features/settings/components/SettingsSidebar.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, TouchableRipple, Icon } from 'react-native-paper';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store';
import { StatusDot } from '../../../components/StatusDot';
import { selectPrinters } from '../../printer/store/printerSlice';
import { PrinterService } from '../../printer/services/PrinterService';

const placeholderItems: Array<{ icon: string; label: string; group: 'device' | 'app' }> = [
  { icon: 'barcode-scan', label: 'Máy quét mã vạch', group: 'device' },
  { icon: 'account', label: 'Tài khoản', group: 'app' },
  { icon: 'translate', label: 'Ngôn ngữ', group: 'app' },
  { icon: 'cloud-outline', label: 'Đồng bộ dữ liệu', group: 'app' },
  { icon: 'information-outline', label: 'Về ứng dụng', group: 'app' },
];

export const SettingsSidebar: React.FC = () => {
  const printers = useSelector((state: RootState) => selectPrinters(state));
  const hasConnectedPrinter = printers.some((p) => PrinterService.getStatus(p.id) === 'connected');

  return (
    <View style={styles.container}>
      <Text style={styles.groupLabel}>Thiết bị</Text>
      <TouchableRipple style={[styles.item, styles.itemActive]}>
        <View style={styles.itemRow}>
          <Icon source="printer" size={16} />
          <Text style={styles.itemLabelActive}>Quản lý máy in</Text>
          {hasConnectedPrinter ? <StatusDot status="connected" /> : null}
        </View>
      </TouchableRipple>
      {placeholderItems
        .filter((item) => item.group === 'device')
        .map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.itemRow}>
              <Icon source={item.icon} size={16} />
              <Text style={styles.itemLabelDisabled}>{item.label}</Text>
            </View>
          </View>
        ))}

      <Text style={styles.groupLabel}>Ứng dụng</Text>
      {placeholderItems
        .filter((item) => item.group === 'app')
        .map((item) => (
          <View key={item.label} style={styles.item}>
            <View style={styles.itemRow}>
              <Icon source={item.icon} size={16} />
              <Text style={styles.itemLabelDisabled}>{item.label}</Text>
            </View>
          </View>
        ))}

      <View style={styles.spacer} />
      <View style={styles.item}>
        <View style={styles.itemRow}>
          <Icon source="logout" size={16} />
          <Text style={styles.itemLabelDisabled}>Đăng xuất</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: 220, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E5E7EB', padding: 8 },
  groupLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 8, marginBottom: 4, marginLeft: 6 },
  item: { paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8 },
  itemActive: { backgroundColor: '#EFF6FF' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemLabelActive: { fontSize: 13, color: '#2563EB', flex: 1 },
  itemLabelDisabled: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  spacer: { flex: 1 },
});
