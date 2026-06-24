import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Circle, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { 
  useAnimatedProps, 
  useSharedValue, 
  withSpring, 
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MeterProps {
  currentmA: number;
  statusText: string;
  isCharging: boolean;
}

export default function Meter({ currentmA, statusText, isCharging }: MeterProps) {
  const animatedValue = useSharedValue(0);
  
  // Calculate max expected current for the scale
  const MAX_CURRENT = 5000;
  
  useEffect(() => {
    // Normalize value to a 0-1 scale
    let normalized = Math.min(Math.abs(currentmA) / MAX_CURRENT, 1.0);
    animatedValue.value = withSpring(normalized, {
      damping: 20, // More damping for a smoother, elegant animation
      stiffness: 70
    });
  }, [currentmA]);

  const size = 260; // Slightly smaller for a more refined look
  const strokeWidth = 24; // Thicker, bolder stroke
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const animatedCircleProps = useAnimatedProps(() => {
    const dashoffset = circumference - (circumference * animatedValue.value * 0.75);
    return {
      strokeDashoffset: dashoffset,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Darker aesthetic gradients */}
          <LinearGradient id="gradCharge" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#1E8449" stopOpacity="1" />
            <Stop offset="100%" stopColor="#117A65" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="gradDischarge" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#922B21" stopOpacity="1" />
            <Stop offset="100%" stopColor="#7B241C" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <G rotation="135" origin={`${size/2}, ${size/2}`}>
          {/* Background Track - Subtle transparency */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(0, 0, 0, 0.4)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * 0.25}
            strokeLinecap="round"
          />
          
          {/* Soft Glow / Aura */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth * 1.5}
            fill="none"
            stroke={isCharging ? "url(#gradCharge)" : "url(#gradDischarge)"}
            strokeDasharray={circumference}
            animatedProps={animatedCircleProps}
            strokeLinecap="round"
            opacity={0.15} 
          />
          
          {/* Main Indicator */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            fill="none"
            stroke={isCharging ? "url(#gradCharge)" : "url(#gradDischarge)"}
            strokeDasharray={circumference}
            animatedProps={animatedCircleProps}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      
      <View style={styles.textContainer}>
        <Text style={[styles.currentText, { color: isCharging ? '#2ecc71' : '#e74c3c' }]}>
          {Math.abs(Math.round(currentmA))}
        </Text>
        <Text style={styles.unitText}>mA</Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: 40,
    // Removed flashy drop shadows to keep it minimal and elegant
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentText: {
    fontSize: 56,
    fontWeight: '300', // Lighter font weight for a sleek modern look
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
    letterSpacing: -1, // Tighter letter spacing
  },
  unitText: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginTop: -2,
    textTransform: 'uppercase',
  },
  statusText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 3,
    fontWeight: '600',
  }
});
