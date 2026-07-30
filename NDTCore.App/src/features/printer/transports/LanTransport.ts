// src/features/printer/transports/LanTransport.ts
import TcpSocket from 'react-native-tcp-socket';
import { AppErrorException } from '../../../types/AppError';

/**
 * `react-native-tcp-socket` không export type `Socket` ở top-level (chỉ export
 * qua namespace mặc định), nên type instance được suy ra từ giá trị trả về của
 * `createConnection`.
 * (`react-native-tcp-socket` does not export the `Socket` type at the module's
 * top level — only inside the default-export namespace — so the instance type
 * is inferred from `createConnection`'s return value instead.)
 */
type LanSocket = ReturnType<typeof TcpSocket.createConnection>;

export class LanTransport {
  private socket: LanSocket | null = null;

  connect(ip: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = TcpSocket.createConnection({ host: ip, port }, () => resolve());
      socket.on('error', (error: Error) => reject(error));
      this.socket = socket;
    });
  }

  write(bytes: Uint8Array): void {
    if (!this.socket) {
      throw new AppErrorException({ code: 'CONNECTION_ERROR', message: 'LAN socket chưa được kết nối' });
    }
    this.socket.write(bytes);
  }

  close(): void {
    this.socket?.destroy();
    this.socket = null;
  }
}
