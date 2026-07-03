import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../components/theme';
import { RootTabs } from './navigation';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    primary: colors.primary,
    border: colors.border,
  },
};

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer theme={theme}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
          <StatusBar style="light" />
          <RootTabs />
        </SafeAreaView>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
