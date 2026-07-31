// src/features/printer/transports/UsbTransport.test.ts
import { UsbTransport } from './UsbTransport';
import { AppErrorException } from '../../../types/AppError';

describe('UsbTransport', () => {
  it('connect() rejects with UNSUPPORTED_CONNECTION', async () => {
    const transport = new UsbTransport();
    await expect(transport.connect()).rejects.toMatchObject({ code: 'UNSUPPORTED_CONNECTION' });
  });

  it('write() throws UNSUPPORTED_CONNECTION synchronously', () => {
    const transport = new UsbTransport();
    expect(() => transport.write()).toThrow(AppErrorException);
  });

  it('close() is a safe no-op', () => {
    const transport = new UsbTransport();
    expect(() => transport.close()).not.toThrow();
  });
});
