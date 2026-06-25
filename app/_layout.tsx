import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, Animated } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent the native splash screen from hiding immediately
SplashScreen.preventAutoHideAsync().catch(() => {});

const WelcomeOverlay = ({ onFinish }: { onFinish: () => void }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const screenFadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Hide the native solid splash screen once the custom React Native view has mounted
    SplashScreen.hideAsync().catch(() => {});

    // Run welcome animations (fade in & scale text, pause, fade out screen)
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1000),
      Animated.timing(screenFadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, []);

  return (
    <Animated.View style={[styles.welcomeContainer, { opacity: screenFadeAnim }]} pointerEvents="none">
      <Animated.Text
        style={[
          styles.welcomeText,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        Welcome
      </Animated.Text>
    </Animated.View>
  );
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [showWelcome, setShowWelcome] = useState(true);

  const [loaded, error] = useFonts({
    'Pacifico': require('../assets/fonts/Pacifico-Regular.ttf'),
  });

  useEffect(() => {
    if (error) {
      console.warn('Error loading Pacifico font, falling back to default styling.', error);
      // Hide splash screen if loading fonts fails
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
      
      {showWelcome && (
        <WelcomeOverlay onFinish={() => setShowWelcome(false)} />
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  welcomeContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#38BCBC',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
  },
  welcomeText: {
    fontFamily: 'Pacifico',
    fontSize: 56,
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});
