// App.tsx
import React from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { store } from './src/store';
import { theme } from './src/theme/theme';
import { RootNavigator } from './src/navigation/RootNavigator';

const queryClient = new QueryClient();

function App(): React.JSX.Element {
  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <PaperProvider theme={theme}>
            <RootNavigator />
          </PaperProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ReduxProvider>
  );
}

export default App;
