import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StoreProvider } from '../lib/store';
import { usePalette } from '../theme';

export default function RootLayout() {
  const p = usePalette();
  const [loaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  if (!loaded) return <View style={{ flex: 1, backgroundColor: p.bg }} />;

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: p.bg },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          <Stack.Screen name="txn/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="add" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="category/[id]" />
          <Stack.Screen name="day/[date]" />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
