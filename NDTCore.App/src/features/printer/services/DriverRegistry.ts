// src/features/printer/services/DriverRegistry.ts
import type { IPrinterDriver } from '../types/driver.types';
import type { Protocol } from '../types/printer.types';
import { EscPosDriver } from '../drivers/EscPosDriver';
import { TsplDriver } from '../drivers/TsplDriver';

export const DriverRegistry: Record<Protocol, IPrinterDriver> = {
  escpos: new EscPosDriver(),
  tspl: new TsplDriver(),
};
