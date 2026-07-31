import printerReducer, {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  defaultPrinterSet,
  printerStatusChanged,
  selectPrinters,
  selectPrinterStatus,
} from './printerSlice';
import type { PrinterConfig } from '../types/printer.types';

const printer: PrinterConfig = {
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

describe('printerSlice', () => {
  it('printersLoaded replaces the printer list', () => {
    const state = printerReducer(undefined, printersLoaded([printer]));
    expect(selectPrinters({ printer: state })).toEqual([printer]);
  });

  it('printerUpserted adds a new printer, updates an existing one', () => {
    let state = printerReducer(undefined, printerUpserted(printer));
    expect(selectPrinters({ printer: state })).toHaveLength(1);
    const renamed = { ...printer, printerName: 'Đổi tên' };
    state = printerReducer(state, printerUpserted(renamed));
    expect(selectPrinters({ printer: state })).toEqual([renamed]);
  });

  it('printerRemoved removes by id', () => {
    let state = printerReducer(undefined, printerUpserted(printer));
    state = printerReducer(state, printerRemoved(printer.id));
    expect(selectPrinters({ printer: state })).toEqual([]);
  });

  it('defaultPrinterSet updates defaultPrinterId', () => {
    const state = printerReducer(undefined, defaultPrinterSet('p1'));
    expect(state.defaultPrinterId).toBe('p1');
  });

  it('printerStatusChanged updates statusById for that printer only', () => {
    const state = printerReducer(undefined, printerStatusChanged({ printerId: 'p1', status: 'connected' }));
    expect(selectPrinterStatus({ printer: state }, 'p1')).toBe('connected');
    expect(selectPrinterStatus({ printer: state }, 'p2')).toBe('idle');
  });
});
