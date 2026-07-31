import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PrinterConfig, PrinterStatus } from '../types/printer.types';

interface PrinterState {
  printers: PrinterConfig[];
  defaultPrinterId: string | null;
  statusById: Record<string, PrinterStatus>;
}

const initialState: PrinterState = {
  printers: [],
  defaultPrinterId: null,
  statusById: {},
};

const printerSlice = createSlice({
  name: 'printer',
  initialState,
  reducers: {
    printersLoaded(state, action: PayloadAction<PrinterConfig[]>) {
      state.printers = action.payload;
    },
    printerUpserted(state, action: PayloadAction<PrinterConfig>) {
      const index = state.printers.findIndex((p) => p.id === action.payload.id);
      if (index === -1) state.printers.push(action.payload);
      else state.printers[index] = action.payload;
    },
    printerRemoved(state, action: PayloadAction<string>) {
      state.printers = state.printers.filter((p) => p.id !== action.payload);
    },
    defaultPrinterSet(state, action: PayloadAction<string>) {
      state.defaultPrinterId = action.payload;
    },
    printerStatusChanged(state, action: PayloadAction<{ printerId: string; status: PrinterStatus }>) {
      state.statusById[action.payload.printerId] = action.payload.status;
    },
  },
});

export const {
  printersLoaded,
  printerUpserted,
  printerRemoved,
  defaultPrinterSet,
  printerStatusChanged,
} = printerSlice.actions;

interface StateWithPrinter {
  printer: PrinterState;
}

export const selectPrinters = (state: StateWithPrinter): PrinterConfig[] => state.printer.printers;
export const selectDefaultPrinterId = (state: StateWithPrinter): string | null => state.printer.defaultPrinterId;
export const selectPrinterStatus = (state: StateWithPrinter, printerId: string): PrinterStatus =>
  state.printer.statusById[printerId] ?? 'idle';

export default printerSlice.reducer;
