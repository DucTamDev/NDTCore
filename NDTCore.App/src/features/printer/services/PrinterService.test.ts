// src/features/printer/services/PrinterService.test.ts
import { createPrinterService } from './PrinterService';
import { StorageService } from '../../../services/StorageService';
import type { IPrinterDriver } from '../types/driver.types';
import type { PrinterConfig } from '../types/printer.types';

const makeMockDriver = (): jest.Mocked<IPrinterDriver> => ({
  scan: jest.fn().mockReturnValue(() => undefined),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getStatus: jest.fn().mockReturnValue('connected'),
  onStatusChange: jest.fn().mockReturnValue(() => undefined),
  testPrint: jest.fn().mockResolvedValue(undefined),
});

const baseConfig: PrinterConfig = {
  id: 'p1',
  printerName: 'Máy in hóa đơn quầy 1',
  printerType: 'receipt',
  protocol: 'escpos',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: false,
  isDefault: false,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('PrinterService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The Jest-mocked MMKV store (jest.setup.js) is a module-level Map that
    // persists across tests within this file — clear the keys PrinterService
    // writes to so each test starts from a clean slate.
    StorageService.removeItem('printer.list');
    StorageService.removeItem('printer.defaultId');
  });

  it('addPrinter() persists and getPrinters() returns it back', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    expect(service.getPrinters()).toEqual([baseConfig]);
  });

  it('removePrinter() removes it from the list', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    service.removePrinter(baseConfig.id);
    expect(service.getPrinters()).toEqual([]);
  });

  it('setDefault() marks exactly one printer as default', () => {
    const service = createPrinterService({ escpos: makeMockDriver(), tspl: makeMockDriver() });
    const second: PrinterConfig = { ...baseConfig, id: 'p2' };
    service.addPrinter(baseConfig);
    service.addPrinter(second);
    service.setDefault('p2');
    expect(service.getDefaultPrinterId()).toBe('p2');
    expect(service.getPrinters().find((p) => p.id === 'p1')?.isDefault).toBe(false);
    expect(service.getPrinters().find((p) => p.id === 'p2')?.isDefault).toBe(true);
  });

  it('connect() forwards to the driver matching the printer protocol', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    await service.connect(baseConfig.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
  });

  it('reconnect() disconnects then connects', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    service.addPrinter(baseConfig);
    await service.reconnect(baseConfig.id);
    expect(escposDriver.disconnect).toHaveBeenCalledWith(baseConfig.id);
    expect(escposDriver.connect).toHaveBeenCalledWith(baseConfig);
  });

  it('testPrint() forwards the given config straight to the driver, without persisting it', async () => {
    const escposDriver = makeMockDriver();
    const service = createPrinterService({ escpos: escposDriver, tspl: makeMockDriver() });
    await service.testPrint(baseConfig);
    expect(escposDriver.testPrint).toHaveBeenCalledWith(baseConfig);
    expect(service.getPrinters()).toEqual([]);
  });
});
