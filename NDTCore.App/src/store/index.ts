import { configureStore } from '@reduxjs/toolkit';
import printerReducer from '../features/printer/store/printerSlice';
import settingsReducer from '../features/settings/store/settingsSlice';

export const store = configureStore({
  reducer: {
    printer: printerReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
