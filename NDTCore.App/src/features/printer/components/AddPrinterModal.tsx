// src/features/printer/components/AddPrinterModal.tsx
import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Modal, Portal, Text, SegmentedButtons } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AppInput } from '../../../components/AppInput';
import { AppSelect } from '../../../components/AppSelect';
import { AppSwitch } from '../../../components/AppSwitch';
import { AppButton } from '../../../components/AppButton';
import { PrinterService } from '../services/PrinterService';
import { generateId } from '../../../utils/id';
import { printerFormSchema, type PrinterFormValues } from '../schemas/printerFormSchema';
import { DeviceScanList } from './DeviceScanList';
import type { PrinterConfig, PrinterDevice } from '../types/printer.types';

export interface AddPrinterModalProps {
  visible: boolean;
  initialValues?: PrinterConfig;
  onDismiss: () => void;
  onSaved: () => void;
}

const protocolByPrinterType = (printerType: 'receipt' | 'label'): 'escpos' | 'tspl' =>
  printerType === 'receipt' ? 'escpos' : 'tspl';

export const AddPrinterModal: React.FC<AddPrinterModalProps> = ({ visible, initialValues, onDismiss, onSaved }) => {
  const printerId = useMemo(() => initialValues?.id ?? generateId(), [initialValues?.id]);
  const [selectedDevice, setSelectedDevice] = useState<PrinterDevice | undefined>(initialValues?.device);
  const [canTestPrint, setCanTestPrint] = useState(false);

  const { control, handleSubmit, watch, formState, setValue } = useForm<PrinterFormValues>({
    resolver: zodResolver(printerFormSchema),
    defaultValues: {
      printerName: initialValues?.printerName ?? '',
      printerType: initialValues?.printerType ?? 'receipt',
      protocol: initialValues?.protocol ?? 'escpos',
      connectionType: initialValues?.connectionType ?? 'usb',
      paperSize: initialValues?.paperSize ?? '80mm',
      autoReconnect: initialValues?.autoReconnect ?? true,
      lanIp: initialValues?.lan?.ip,
      lanPort: initialValues?.lan?.port ? String(initialValues.lan.port) : undefined,
      selectedDeviceId: initialValues?.device?.deviceId,
    },
  });

  const printerType = watch('printerType');
  const connectionType = watch('connectionType');
  const protocol = protocolByPrinterType(printerType);

  const buildConfig = (values: PrinterFormValues): PrinterConfig => ({
    id: printerId,
    printerName: values.printerName,
    printerType: values.printerType,
    protocol,
    connectionType: values.connectionType,
    paperSize: values.paperSize,
    autoReconnect: values.autoReconnect,
    isDefault: initialValues?.isDefault ?? false,
    device: values.connectionType === 'lan' ? undefined : selectedDevice,
    lan:
      values.connectionType === 'lan' && values.lanIp && values.lanPort
        ? { ip: values.lanIp, port: Number(values.lanPort) }
        : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    const config = buildConfig(values);
    if (initialValues) PrinterService.updatePrinter(config);
    else PrinterService.addPrinter(config);
    if (config.autoReconnect) await PrinterService.connect(config.id).catch(() => undefined);
    onSaved();
  });

  const onTestPrint = handleSubmit(async (values) => {
    await PrinterService.testPrint(buildConfig(values));
    setCanTestPrint(true);
  });

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <Text variant="titleMedium">{initialValues ? 'Chỉnh sửa máy in' : 'Thêm máy in'}</Text>

        <Controller
          control={control}
          name="printerName"
          render={({ field }) => (
            <AppInput
              label="Tên máy in"
              value={field.value}
              onChangeText={field.onChange}
              errorMessage={formState.errors.printerName?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="printerType"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'receipt', label: 'Máy in hóa đơn' },
                { value: 'label', label: 'Máy in tem' },
              ]}
            />
          )}
        />

        <Controller
          control={control}
          name="connectionType"
          render={({ field }) => (
            <SegmentedButtons
              value={field.value}
              onValueChange={field.onChange}
              buttons={[
                { value: 'usb', label: 'USB' },
                { value: 'bluetooth', label: 'Bluetooth' },
                { value: 'lan', label: 'LAN' },
              ]}
            />
          )}
        />

        {connectionType === 'lan' ? (
          <>
            <Controller
              control={control}
              name="lanIp"
              render={({ field }) => (
                <AppInput
                  label="Địa chỉ IP"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  errorMessage={formState.errors.lanIp?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="lanPort"
              render={({ field }) => (
                <AppInput
                  label="Cổng"
                  value={field.value ?? ''}
                  onChangeText={field.onChange}
                  keyboardType="numeric"
                  errorMessage={formState.errors.lanPort?.message}
                />
              )}
            />
          </>
        ) : (
          <DeviceScanList
            protocol={protocol}
            connectionType={connectionType}
            selectedDeviceId={selectedDevice?.deviceId}
            onSelect={(device) => {
              setSelectedDevice(device);
              setValue('selectedDeviceId', device.deviceId, { shouldValidate: true });
            }}
          />
        )}

        <Controller
          control={control}
          name="paperSize"
          render={({ field }) => (
            <AppSelect
              label="Khổ giấy"
              value={field.value}
              onSelect={field.onChange}
              options={[
                { label: '58mm', value: '58mm' },
                { label: '80mm', value: '80mm' },
              ]}
            />
          )}
        />

        <Controller
          control={control}
          name="autoReconnect"
          render={({ field }) => (
            <AppSwitch label="Tự động kết nối lại" value={field.value} onValueChange={field.onChange} />
          )}
        />

        <View style={styles.footer}>
          <AppButton label="In thử" mode="outlined" disabled={!canTestPrint} onPress={onTestPrint} />
          <AppButton label="Lưu máy in" onPress={onSubmit} />
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: { backgroundColor: 'white', margin: 24, padding: 16, borderRadius: 16, gap: 12 },
  footer: { flexDirection: 'row', gap: 8, marginTop: 8 },
});
