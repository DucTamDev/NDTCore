// src/features/printer/schemas/printerFormSchema.test.ts
import { printerFormSchema } from './printerFormSchema';

const basePayload = {
  printerName: 'Máy in hóa đơn quầy 2',
  printerType: 'receipt' as const,
  protocol: 'escpos' as const,
  connectionType: 'lan' as const,
  paperSize: '80mm' as const,
  autoReconnect: true,
  lanIp: '192.168.1.20',
  lanPort: '9100',
};

describe('printerFormSchema', () => {
  it('accepts a valid LAN payload', () => {
    const result = printerFormSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it('rejects an empty printer name', () => {
    const result = printerFormSchema.safeParse({ ...basePayload, printerName: '' });
    expect(result.success).toBe(false);
  });

  it('rejects LAN payload with an invalid IP', () => {
    const result = printerFormSchema.safeParse({ ...basePayload, lanIp: 'not-an-ip' });
    expect(result.success).toBe(false);
  });

  it('rejects LAN payload with an out-of-range port', () => {
    const result = printerFormSchema.safeParse({ ...basePayload, lanPort: '70000' });
    expect(result.success).toBe(false);
  });

  it('rejects USB/Bluetooth payload without a selected device', () => {
    const result = printerFormSchema.safeParse({
      ...basePayload,
      connectionType: 'usb',
      lanIp: undefined,
      lanPort: undefined,
      selectedDeviceId: undefined,
    });
    expect(result.success).toBe(false);
  });

  it('accepts USB/Bluetooth payload with a selected device', () => {
    const result = printerFormSchema.safeParse({
      ...basePayload,
      connectionType: 'bluetooth',
      lanIp: undefined,
      lanPort: undefined,
      selectedDeviceId: 'AA:BB:CC:DD:EE:FF',
    });
    expect(result.success).toBe(true);
  });
});
