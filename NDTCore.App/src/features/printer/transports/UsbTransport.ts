// src/features/printer/transports/UsbTransport.ts
import { AppErrorException } from '../../../types/AppError';

const UNSUPPORTED_MESSAGE = 'Kết nối USB cho máy in tem (TSPL) chưa được hỗ trợ trong Phase 1';

export class UsbTransport {
  connect(): Promise<never> {
    return Promise.reject(new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: UNSUPPORTED_MESSAGE }));
  }

  write(): never {
    throw new AppErrorException({ code: 'UNSUPPORTED_CONNECTION', message: UNSUPPORTED_MESSAGE });
  }

  close(): void {
    // không có kết nối để đóng
  }
}
