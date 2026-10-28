import { Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { currencyLayout } from '../components/CurrencyScope';
import { UpdateGate } from '../components/UpdateGate';
import { StoreProvider } from '../lib/store';
import { ThemeProvider, usePalette, useTheme } from '../theme';

// Before any screen loads, so nothing can slip a request out first.

const modal = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const p = usePalette();
  const { scheme, ready } = useTheme();
  // Font files are bundled in the app (node_modules/@expo-google-fonts), never fetched.
  const [loaded] = useFonts({ Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold });

  // Paint the window behind the app (seen during screen changes and the keyboard) in the theme colour.
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(p.bg).catch(() => {});
  }, [p.bg]);

  if (!loaded || !ready) return <View style={{ flex: 1, backgroundColor: p.bg }} />;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack
          screenLayout={currencyLayout}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: p.bg },
            // Pushed screens slide in from the right while the one behind drifts left (iOS style).
            animation: 'ios_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="txn/[id]" options={modal} />
          <Stack.Screen name="add" options={modal} />
          <Stack.Screen name="goal" options={modal} />
          <Stack.Screen name="budget" options={modal} />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="day/[date]" />
          <Stack.Screen name="account/[key]" />
          <Stack.Screen name="goals" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="design-system" />
        </Stack>
        {/* Covers everything when the Play Store has a new major version. */}
        <UpdateGate />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
