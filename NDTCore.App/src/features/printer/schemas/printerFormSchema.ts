// src/features/printer/schemas/printerFormSchema.ts
import { z } from 'zod';

const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

const isValidIpv4 = (value: string): boolean => {
  if (!ipv4Regex.test(value)) return false;
  return value.split('.').every((segment) => Number(segment) >= 0 && Number(segment) <= 255);
};

export const printerFormSchema = z
  .object({
    printerName: z.string().min(1, 'Vui lòng nhập tên máy in'),
    printerType: z.enum(['receipt', 'label']),
    protocol: z.enum(['escpos', 'tspl']),
    connectionType: z.enum(['usb', 'bluetooth', 'lan']),
    paperSize: z.enum(['58mm', '80mm']),
    autoReconnect: z.boolean(),
    lanIp: z.string().optional(),
    lanPort: z.string().optional(),
    selectedDeviceId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.connectionType === 'lan') {
      if (!data.lanIp || !isValidIpv4(data.lanIp)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lanIp'], message: 'Địa chỉ IP không hợp lệ' });
      }
      const port = Number(data.lanPort);
      if (!data.lanPort || Number.isNaN(port) || port < 1 || port > 65535) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lanPort'], message: 'Cổng không hợp lệ (1-65535)' });
      }
    } else if (!data.selectedDeviceId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['selectedDeviceId'], message: 'Vui lòng chọn thiết bị' });
    }
  });

export type PrinterFormValues = z.infer<typeof printerFormSchema>;
