import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { View, ActivityIndicator } from 'react-native';
import { LanguageProvider } from '../context/LanguageContext';
import { fontMap, colors } from '../constants/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts(fontMap);

  // Keep a simple warm-paper screen while fonts load
  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <StatusBar style="dark" backgroundColor={colors.paper} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.paper },
            animation: 'fade',
          }}
        />
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
