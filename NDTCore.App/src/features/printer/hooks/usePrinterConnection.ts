import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import { PrinterService } from '../services/PrinterService';
import { printerStatusChanged, selectPrinterStatus } from '../store/printerSlice';
import type { PrinterStatus } from '../types/printer.types';

export const usePrinterConnection = (printerId: string): PrinterStatus => {
  const dispatch = useDispatch<AppDispatch>();
  const status = useSelector((state: RootState) => selectPrinterStatus(state, printerId));

  useEffect(() => {
    const unsubscribe = PrinterService.onStatusChange(printerId, (nextStatus) => {
      dispatch(printerStatusChanged({ printerId, status: nextStatus }));
    });
    return unsubscribe;
  }, [dispatch, printerId]);

  return status;
};
