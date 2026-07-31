// src/features/printer/drivers/EscPosDriver.ts
import { Printer, PrintersDiscovery, DiscoveryPortType } from 'react-native-esc-pos-printer';
import type { DeviceInfo } from 'react-native-esc-pos-printer';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterStatus } from '../types/printer.types';
import { AppErrorException } from '../../../types/AppError';

/**
 * Cổng phát hiện thiết bị của `react-native-esc-pos-printer` (Epson ePOS2 SDK)
 * tương ứng với từng loại kết nối trong `ConnectionType`.
 * (Discovery port for `react-native-esc-pos-printer` (Epson ePOS2 SDK) mapped
 * from each `ConnectionType`.)
 */
const portTypeByConnectionType: Record<ConnectionType, number> = {
  lan: DiscoveryPortType.PORTTYPE_TCP,
  bluetooth: DiscoveryPortType.PORTTYPE_BLUETOOTH,
  usb: DiscoveryPortType.PORTTYPE_USB,
};

const targetPrefixByConnectionType: Record<ConnectionType, string> = {
  lan: 'TCP',
  bluetooth: 'BT',
  usb: 'USB',
};

const buildTarget = (config: PrinterConfig): string => {
  if (config.connectionType === 'lan' && config.lan) return `TCP:${config.lan.ip}`;
  if (config.device) return `${targetPrefixByConnectionType[config.connectionType]}:${config.device.deviceId}`;
  throw new AppErrorException({
    code: 'VALIDATION_ERROR',
    message: 'Thiếu thông tin thiết bị/địa chỉ để kết nối máy in ESC/POS',
  });
};

/**
 * Driver ESC/POS cho máy in hoá đơn, dùng thư viện `react-native-esc-pos-printer`
 * (bọc SDK Epson ePOS2 gốc). Khác với TSPL, thư viện này không dùng transport
 * tự viết mà cung cấp sẵn class `Printer` (kết nối/in theo target string dạng
 * `TCP:`/`BT:`/`USB:`) và singleton `PrintersDiscovery` (phát hiện thiết bị
 * qua event `onDiscovery`/`onError`).
 * (ESC/POS driver for receipt printers, backed by `react-native-esc-pos-printer`
 * (a wrapper around the native Epson ePOS2 SDK). Unlike TSPL, this library does
 * not use hand-written transports — it exposes a `Printer` class (connect/print
 * via a `TCP:`/`BT:`/`USB:` target string) and a `PrintersDiscovery` singleton
 * (device discovery via `onDiscovery`/`onError` events).)
 */
export class EscPosDriver implements IPrinterDriver {
  private printers = new Map<string, Printer>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    onEvent({ type: 'loading' });

    const removeDiscoveryListener = PrintersDiscovery.onDiscovery((devices: DeviceInfo[]) => {
      onEvent({
        type: devices.length > 0 ? 'found' : 'empty',
        devices: devices.map((device) => ({
          deviceId: device.target,
          displayName: device.deviceName,
          rawDevice: device as unknown as Record<string, unknown>,
        })),
      });
    });
    const removeErrorListener = PrintersDiscovery.onError((error: unknown) => {
      onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
    });

    PrintersDiscovery.start({ filterOption: { portType: portTypeByConnectionType[connectionType] } }).catch(
      (error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      }
    );

    return () => {
      removeDiscoveryListener();
      removeErrorListener();
      PrintersDiscovery.stop().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const target = buildTarget(config);
      const printer = new Printer({ target, deviceName: config.printerName });
      await printer.connect();
      this.printers.set(config.id, printer);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const printer = this.printers.get(printerId);
    if (printer) await printer.disconnect();
    this.printers.delete(printerId);
    this.setStatus(printerId, 'disconnected');
  }

  getStatus(printerId: string): PrinterStatus {
    return this.statuses.get(printerId) ?? 'idle';
  }

  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe {
    if (!this.listeners.has(printerId)) this.listeners.set(printerId, new Set());
    this.listeners.get(printerId)?.add(callback);
    return () => this.listeners.get(printerId)?.delete(callback);
  }

  async testPrint(config: PrinterConfig): Promise<void> {
    await this.connect(config);
    const printer = this.printers.get(config.id);
    if (!printer) return;
    await printer.addText('NDTCore POS - In thu\n');
    await printer.addFeedLine();
    await printer.addCut();
    await printer.sendData();
  }
}
