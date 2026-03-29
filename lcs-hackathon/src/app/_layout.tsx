import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router'; // Added Stack import
import React from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        
        {/* Instead of just <AppTabs />, we use a Stack. 
          The Stack looks into your file folders and decides what to show.
        */}
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
            },
            headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
          }}
        >
          {/* 1. The Main App (Tabs/Map) */}
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