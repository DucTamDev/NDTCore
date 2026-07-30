import { createSlice } from '@reduxjs/toolkit';

const settingsSlice = createSlice({
  name: 'settings',
  initialState: { activeMenuKey: 'printer' as const },
  reducers: {},
});

export default settingsSlice.reducer;
