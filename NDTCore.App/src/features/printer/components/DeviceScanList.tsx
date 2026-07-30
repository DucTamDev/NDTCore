// src/features/printer/components/DeviceScanList.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { List, IconButton, Text } from 'react-native-paper';
import { PrinterService } from '../services/PrinterService';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingOverlay } from '../../../components/LoadingOverlay';
import type { ConnectionType, PrinterDevice, Protocol } from '../types/printer.types';

export interface DeviceScanListProps {
  protocol: Protocol;
  connectionType: ConnectionType;
  selectedDeviceId?: string;
  onSelect: (device: PrinterDevice) => void;
}

export const DeviceScanList: React.FC<DeviceScanListProps> = ({
  protocol,
  connectionType,
  selectedDeviceId,
  onSelect,
}) => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanTrigger, setScanTrigger] = useState(0);

  useEffect(() => {
    setLoading(true);
    setErrorMessage(null);
    const unsubscribe = PrinterService.scanDevices(protocol, connectionType, (event) => {
      if (event.type === 'loading') setLoading(true);
      if (event.type === 'found' || event.type === 'empty') {
        setLoading(false);
        setDevices(event.devices ?? []);
      }
      if (event.type === 'error') {
        setLoading(false);
        setErrorMessage(event.error?.message ?? 'Không thể quét thiết bị');
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocol, connectionType, scanTrigger]);

  return (
    <View>
      <View style={styles.header}>
        <Text variant="labelMedium">Thiết bị tìm thấy</Text>
        <IconButton icon="refresh" size={16} onPress={() => setScanTrigger((n) => n + 1)} />
      </View>
      {loading && <LoadingOverlay />}
      {!loading && errorMessage && <EmptyState message={errorMessage} />}
      {!loading && !errorMessage && devices.length === 0 && <EmptyState message="Không tìm thấy thiết bị nào" />}
      {!loading &&
        !errorMessage &&
        devices.map((device) => (
          <List.Item
            key={device.deviceId}
            title={device.displayName}
            onPress={() => onSelect(device)}
            right={() => (selectedDeviceId === device.deviceId ? <List.Icon icon="check" /> : null)}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
