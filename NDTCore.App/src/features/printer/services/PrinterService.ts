// src/features/printer/services/PrinterService.ts
import { StorageService } from '../../../services/StorageService';
import type { IPrinterDriver, Unsubscribe } from '../types/driver.types';
import type {
  ConnectionType,
  DeviceScanEvent,
  PrinterConfig,
  PrinterStatus,
  Protocol,
} from '../types/printer.types';
import { DriverRegistry } from './DriverRegistry';

const PRINTER_LIST_KEY = 'printer.list';
const PRINTER_DEFAULT_KEY = 'printer.defaultId';

export const createPrinterService = (registry: Record<Protocol, IPrinterDriver>) => {
  const getDriver = (protocol: Protocol): IPrinterDriver => registry[protocol];

  const getPrinters = (): PrinterConfig[] => StorageService.getItem<PrinterConfig[]>(PRINTER_LIST_KEY) ?? [];

  const savePrinters = (printers: PrinterConfig[]): void => {
    StorageService.setItem(PRINTER_LIST_KEY, printers);
  };

  const findOrThrow = (printerId: string): PrinterConfig => {
    const found = getPrinters().find((p) => p.id === printerId);
    if (!found) throw new Error(`Không tìm thấy máy in với id ${printerId}`);
    return found;
  };

  const getDefaultPrinterId = (): string | null => StorageService.getItem<string>(PRINTER_DEFAULT_KEY);

  const addPrinter = (config: PrinterConfig): void => {
    savePrinters([...getPrinters(), config]);
    if (config.isDefault) StorageService.setItem(PRINTER_DEFAULT_KEY, config.id);
  };

  const updatePrinter = (config: PrinterConfig): void => {
    savePrinters(getPrinters().map((p) => (p.id === config.id ? config : p)));
  };

  const removePrinter = (printerId: string): void => {
    savePrinters(getPrinters().filter((p) => p.id !== printerId));
    if (getDefaultPrinterId() === printerId) StorageService.removeItem(PRINTER_DEFAULT_KEY);
  };

  const setDefault = (printerId: string): void => {
    savePrinters(getPrinters().map((p) => ({ ...p, isDefault: p.id === printerId })));
    StorageService.setItem(PRINTER_DEFAULT_KEY, printerId);
  };

  const connect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).connect(config);
  };

  const disconnect = async (printerId: string): Promise<void> => {
    const config = findOrThrow(printerId);
    await getDriver(config.protocol).disconnect(printerId);
  };

  const reconnect = async (printerId: string): Promise<void> => {
    await disconnect(printerId).catch(() => undefined);
    await connect(printerId);
  };

  const testPrint = async (config: PrinterConfig): Promise<void> => {
    await getDriver(config.protocol).testPrint(config);
  };

  const scanDevices = (
    protocol: Protocol,
    connectionType: ConnectionType,
    onEvent: (event: DeviceScanEvent) => void,
  ): Unsubscribe => getDriver(protocol).scan(connectionType, onEvent);

  const getStatus = (printerId: string): PrinterStatus => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).getStatus(printerId);
  };

  const onStatusChange = (printerId: string, callback: (status: PrinterStatus) => void): Unsubscribe => {
    const config = findOrThrow(printerId);
    return getDriver(config.protocol).onStatusChange(printerId, callback);
  };

  return {
    getPrinters,
    getDefaultPrinterId,
    addPrinter,
    updatePrinter,
    removePrinter,
    setDefault,
    connect,
    disconnect,
    reconnect,
    testPrint,
    scanDevices,
    getStatus,
    onStatusChange,
  };
};

export const PrinterService = createPrinterService(DriverRegistry);
