import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <AnimatedSplashOverlay />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#000',
          }}
        >
          {/* 1. The Main Map Screen */}
          <Stack.Screen
            name="index"
            options={{ headerShown: false }}
          />

          {/* 2. The Main App (Tabs/Map) */}
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          
          {/* 2. The Service Detail Page */}
          <Stack.Screen 
            name="service/[id]" 
            options={{ 
              headerShown: true, 
              title: 'Shelter Details',
              headerBackTitle: 'Map', // Shows on iOS
              presentation: 'card',   // Standard slide-in animation
            }} 
          />
        </Stack>

      </ThemeProvider>
    </GestureHandlerRootView>
  );
}