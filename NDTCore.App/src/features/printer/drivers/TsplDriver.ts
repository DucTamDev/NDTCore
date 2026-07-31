// src/features/printer/drivers/TsplDriver.ts
import RNBluetoothClassic from 'react-native-bluetooth-classic';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterStatus } from '../types/printer.types';
import { TsplEncoder } from '../protocols/TsplEncoder';
import { LanTransport } from '../transports/LanTransport';
import { BluetoothTransport } from '../transports/BluetoothTransport';
import { UsbTransport } from '../transports/UsbTransport';
import { AppErrorException } from '../../../types/AppError';

type TsplTransport = LanTransport | BluetoothTransport | UsbTransport;

/**
 * Driver TSPL cho máy in tem (label), điều phối kết nối tới đúng transport
 * (LAN/Bluetooth/USB) và mã hoá lệnh in bằng `TsplEncoder`.
 * (TSPL driver for label printers — dispatches connections to the correct
 * transport (LAN/Bluetooth/USB) and encodes print commands via `TsplEncoder`.)
 */
export class TsplDriver implements IPrinterDriver {
  private connections = new Map<string, TsplTransport>();
  private statuses = new Map<string, PrinterStatus>();
  private listeners = new Map<string, Set<(status: PrinterStatus) => void>>();

  private setStatus(printerId: string, status: PrinterStatus): void {
    this.statuses.set(printerId, status);
    this.listeners.get(printerId)?.forEach((callback) => callback(status));
  }

  private createTransport(connectionType: ConnectionType): TsplTransport {
    if (connectionType === 'lan') return new LanTransport();
    if (connectionType === 'bluetooth') return new BluetoothTransport();
    return new UsbTransport();
  }

  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe {
    if (connectionType === 'lan') {
      onEvent({ type: 'empty' });
      return () => undefined;
    }
    if (connectionType === 'usb') {
      onEvent({
        type: 'error',
        error: { code: 'UNSUPPORTED_CONNECTION', message: 'USB chưa được hỗ trợ cho máy in tem' },
      });
      return () => undefined;
    }
    onEvent({ type: 'loading' });
    RNBluetoothClassic.startDiscovery()
      .then((devices) => {
        onEvent({
          type: devices.length > 0 ? 'found' : 'empty',
          devices: devices.map((d) => ({
            deviceId: d.address,
            displayName: d.name ?? d.address,
            rawDevice: d as unknown as Record<string, unknown>,
          })),
        });
      })
      .catch((error: unknown) => {
        onEvent({ type: 'error', error: { code: 'CONNECTION_ERROR', message: String(error) } });
      });
    return () => {
      RNBluetoothClassic.cancelDiscovery().catch(() => undefined);
    };
  }

  async connect(config: PrinterConfig): Promise<void> {
    this.setStatus(config.id, 'connecting');
    try {
      const transport = this.createTransport(config.connectionType);
      if (config.connectionType === 'lan') {
        if (!config.lan) throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Thiếu cấu hình IP/Port' });
        await (transport as LanTransport).connect(config.lan.ip, config.lan.port);
      } else if (config.connectionType === 'bluetooth') {
        if (!config.device) {
          throw new AppErrorException({ code: 'VALIDATION_ERROR', message: 'Chưa chọn thiết bị Bluetooth' });
        }
        await (transport as BluetoothTransport).connect(config.device.deviceId);
      } else {
        await (transport as UsbTransport).connect();
      }
      this.connections.set(config.id, transport);
      this.setStatus(config.id, 'connected');
    } catch (error) {
      this.setStatus(config.id, 'error');
      throw error;
    }
  }

  async disconnect(printerId: string): Promise<void> {
    this.setStatus(printerId, 'disconnecting');
    const transport = this.connections.get(printerId);
    await transport?.close();
    this.connections.delete(printerId);
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
    const transport = this.connections.get(config.id);
    const bytes = new TsplEncoder()
      .initialize(config.paperSize)
      .text(10, 10, 'NDTCore POS - In thu')
      .cut()
      .encode();
    if (config.connectionType === 'lan') {
      (transport as LanTransport).write(bytes);
    } else if (config.connectionType === 'bluetooth') {
      await (transport as BluetoothTransport).write(bytes);
    }
  }
}
