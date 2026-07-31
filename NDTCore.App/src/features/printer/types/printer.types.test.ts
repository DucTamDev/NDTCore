import type { IPrinterDriver } from './driver.types';
import type { PrinterConfig } from './printer.types';

describe('printer domain types', () => {
  it('accepts a fully-formed PrinterConfig for a LAN TSPL label printer', () => {
    const config: PrinterConfig = {
      id: 'p1',
      printerName: 'Máy in tem quầy 1',
      printerType: 'label',
      protocol: 'tspl',
      connectionType: 'lan',
      paperSize: '58mm',
      autoReconnect: true,
      isDefault: false,
      lan: { ip: '192.168.1.50', port: 9100 },
    };
    expect(config.protocol).toBe('tspl');
  });

  it('a mock driver satisfies IPrinterDriver', () => {
    const driver: IPrinterDriver = {
      scan: () => () => undefined,
      connect: async () => undefined,
      disconnect: async () => undefined,
      getStatus: () => 'idle',
      onStatusChange: () => () => undefined,
      testPrint: async () => undefined,
    };
    expect(driver.getStatus('p1')).toBe('idle');
  });
});
