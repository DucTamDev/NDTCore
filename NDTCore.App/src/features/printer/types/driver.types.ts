import type { ConnectionType, DeviceScanEvent, PrinterConfig, PrinterStatus } from './printer.types';

export type Unsubscribe = () => void;

export interface IPrinterDriver {
  scan(connectionType: ConnectionType, onEvent: (event: DeviceScanEvent) => void): Unsubscribe;
  connect(config: PrinterConfig): Promise<void>;
  disconnect(printerId: string): Promise<void>;
  getStatus(printerId: string): PrinterStatus;
  onStatusChange(printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe;
  testPrint(config: PrinterConfig): Promise<void>;
}
