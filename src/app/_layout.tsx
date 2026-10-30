import { Sora_400Regular, Sora_500Medium, Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from '@expo-google-fonts/sora';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { currencyLayout } from '../components/CurrencyScope';
import { SmsConsentProvider } from '../components/SmsConsent';
import { UpdateGate } from '../components/UpdateGate';
import { StoreProvider } from '../lib/store';
import { buildPalette, ThemeProvider, usePalette, useTheme } from '../theme';

const modal = { presentation: 'modal', animation: 'slide_from_bottom' } as const;

/**
 * Shown instead of the app when a screen crashes, so one broken screen doesn't close Kharcha.
 * Everything saved stays saved. It sits outside the theme and fonts (they may be what broke),
 * so it uses the default colours for the phone's light or dark mode and the system font.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const p = buildPalette(useColorScheme() === 'dark' ? 'dark' : 'light', 'lime', 'blue');
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, justifyContent: 'center', padding: 24, gap: 12 }}>
      <Text accessibilityRole="header" style={{ color: p.ink, fontSize: 24, fontWeight: '700' }}>
        Something went wrong
      </Text>
      <Text style={{ color: p.muted, fontSize: 15, lineHeight: 21 }}>
        Your payments and everything you saved are safe on this phone. Try again. If it keeps happening, close Kharcha and open it again.
      </Text>
      {dev ? <Text style={{ color: p.muted, fontSize: 12 }}>{error.message}</Text> : null}
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        style={{ backgroundColor: p.accent, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 }}
      >
        <Text style={{ color: p.onAccent, fontSize: 16, fontWeight: '600' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

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
        <SmsConsentProvider>
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
          <Stack.Screen name="link/[id]" options={modal} />
          <Stack.Screen name="add" options={modal} />
          <Stack.Screen name="goal" options={modal} />
          <Stack.Screen name="budget" options={modal} />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="people" />
          <Stack.Screen name="sort" />
          <Stack.Screen name="flow" />
          <Stack.Screen name="cards" />
          <Stack.Screen name="investments" />
          <Stack.Screen name="day/[date]" />
          <Stack.Screen name="account/[key]" />
          <Stack.Screen name="goals" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="privacy" />
          <Stack.Screen name="design-system" />
        </Stack>
        {/* Covers everything when the Play Store has a new major version. */}
        <UpdateGate />
        </SmsConsentProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
