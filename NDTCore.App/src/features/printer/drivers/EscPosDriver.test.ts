// src/features/printer/drivers/EscPosDriver.test.ts
import { EscPosDriver } from './EscPosDriver';
import type { PrinterConfig } from '../types/printer.types';

jest.mock('react-native-esc-pos-printer', () => {
  const printerInstance = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    addText: jest.fn().mockResolvedValue(undefined),
    addFeedLine: jest.fn().mockResolvedValue(undefined),
    addCut: jest.fn().mockResolvedValue(undefined),
    sendData: jest.fn().mockResolvedValue({}),
  };

  const discoveryListeners: Array<(printers: unknown[]) => void> = [];

  const PrintersDiscovery = {
    start: jest.fn().mockImplementation(async () => {
      discoveryListeners.forEach((listener) =>
        listener([
          {
            deviceType: 'TYPE_PRINTER',
            target: 'TCP:192.168.1.10',
            deviceName: 'TM-T82',
            ipAddress: '192.168.1.10',
            macAddress: '',
            bdAddress: '',
          },
        ])
      );
    }),
    stop: jest.fn().mockResolvedValue(undefined),
    onDiscovery: jest.fn().mockImplementation((listener: (printers: unknown[]) => void) => {
      discoveryListeners.push(listener);
      return () => {
        const index = discoveryListeners.indexOf(listener);
        if (index >= 0) discoveryListeners.splice(index, 1);
      };
    }),
    onError: jest.fn().mockImplementation(() => () => undefined),
  };

  return {
    Printer: jest.fn().mockImplementation(() => printerInstance),
    PrintersDiscovery,
    DiscoveryPortType: {
      PORTTYPE_ALL: 0,
      PORTTYPE_TCP: 1,
      PORTTYPE_BLUETOOTH: 2,
      PORTTYPE_USB: 3,
      PORTTYPE_BLUETOOTH_LE: 4,
    },
  };
});

const receiptConfig: PrinterConfig = {
  id: 'receipt-1',
  printerName: 'Máy in hóa đơn quầy 1',
  printerType: 'receipt',
  protocol: 'escpos',
  connectionType: 'lan',
  paperSize: '80mm',
  autoReconnect: true,
  isDefault: true,
  lan: { ip: '192.168.1.10', port: 9100 },
};

describe('EscPosDriver', () => {
  it('connect() transitions idle -> connecting -> connected', async () => {
    const driver = new EscPosDriver();
    const statuses: string[] = [];
    driver.onStatusChange(receiptConfig.id, (status) => statuses.push(status));
    await driver.connect(receiptConfig);
    expect(statuses).toEqual(['connecting', 'connected']);
  });

  it('disconnect() transitions to disconnected', async () => {
    const driver = new EscPosDriver();
    await driver.connect(receiptConfig);
    await driver.disconnect(receiptConfig.id);
    expect(driver.getStatus(receiptConfig.id)).toBe('disconnected');
  });

  it('testPrint() connects then prints without throwing', async () => {
    const driver = new EscPosDriver();
    await expect(driver.testPrint(receiptConfig)).resolves.toBeUndefined();
  });

  it('scan() reports found devices from PrintersDiscovery.onDiscovery', (done) => {
    const driver = new EscPosDriver();
    driver.scan('lan', (event) => {
      if (event.type === 'found') {
        expect(event.devices?.[0].displayName).toBe('TM-T82');
        done();
      }
    });
  });
});
