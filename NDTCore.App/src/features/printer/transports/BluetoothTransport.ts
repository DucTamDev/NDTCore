// src/features/printer/transports/BluetoothTransport.ts
import RNBluetoothClassic, { type BluetoothDevice } from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';
import { AppErrorException } from '../../../types/AppError';

export class BluetoothTransport {
  private device: BluetoothDevice | null = null;

  async connect(deviceId: string): Promise<void> {
    this.device = await RNBluetoothClassic.connectToDevice(deviceId);
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.device) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'Thiết bị Bluetooth chưa được kết nối' });
    }
    await this.device.write(Buffer.from(bytes).toString('base64'), 'base64');
  }

  async close(): Promise<void> {
    await this.device?.disconnect();
    this.device = null;
  }
}
