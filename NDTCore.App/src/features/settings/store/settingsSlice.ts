import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type SettingsMenuKey = 'printer';

interface SettingsState {
  activeMenuKey: SettingsMenuKey;
}

const initialState: SettingsState = {
  activeMenuKey: 'printer',
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    activeMenuKeyChanged(state, action: PayloadAction<SettingsMenuKey>) {
      state.activeMenuKey = action.payload;
    },
  },
});

export const { activeMenuKeyChanged } = settingsSlice.actions;

interface StateWithSettings {
  settings: SettingsState;
}

export const selectActiveMenuKey = (state: StateWithSettings): SettingsMenuKey => state.settings.activeMenuKey;

export default settingsSlice.reducer;
