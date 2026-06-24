import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Canvas, Circle, BlurMask } from '@shopify/react-native-skia';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  withSequence,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

const AnimatedFluidOrb = ({ color, duration, startX, startY, radius }: any) => {
  const cx = useSharedValue(startX);
  const cy = useSharedValue(startY);
  const r = useSharedValue(radius);

  useEffect(() => {
    // X-axis drifting
    cx.value = withRepeat(
      withSequence(
        withTiming(startX + width * 0.4, { duration: duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(startX - width * 0.2, { duration: duration * 1.2, easing: Easing.inOut(Easing.sin) }),
        withTiming(startX, { duration: duration * 0.8, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    
    // Y-axis drifting
    cy.value = withRepeat(
      withSequence(
        withTiming(startY - height * 0.3, { duration: duration * 1.1, easing: Easing.inOut(Easing.sin) }),
        withTiming(startY + height * 0.4, { duration: duration * 0.9, easing: Easing.inOut(Easing.sin) }),
        withTiming(startY, { duration: duration, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );

    // Pulsing size
    r.value = withRepeat(
      withSequence(
        withTiming(radius * 1.3, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
        withTiming(radius * 0.8, { duration: duration * 1.2, easing: Easing.inOut(Easing.ease) }),
        withTiming(radius, { duration: duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  return (
    <Circle cx={cx} cy={cy} r={r} color={color}>
      {/* 
        This heavy blur causes the solid color to diffuse out like a gas, 
        blending perfectly with the other overlapping orbs to create the 
        glassy, fluid mesh gradient look.
      */}
      <BlurMask blur={80} style="normal" />
    </Circle>
  );
};

export default function AnimatedBackground() {
  return (
    <Canvas style={styles.backgroundBase}>
      {/* Deep background color base */}
      <Circle cx={width / 2} cy={height / 2} r={height} color="#020308" />

      {/* Orbs drifting using Reanimated Sine wave approximations */}
      
      {/* Dark Violet */}
      <AnimatedFluidOrb color="#240046" duration={2000} startX={width * 0.2} startY={height * 0.2} radius={width * 0.5} />
      
      {/* Dark Charcoal Teal */}
      <AnimatedFluidOrb color="#03254c" duration={2500} startX={width * 0.8} startY={height * 0.8} radius={width * 0.6} />
      
      {/* Deep Plum */}
      <AnimatedFluidOrb color="#3c096c" duration={3000} startX={width * 0.6} startY={height * 0.3} radius={width * 0.55} />
      
      {/* Midnight Blue */}
      <AnimatedFluidOrb color="#0a1128" duration={2300} startX={width * 0.3} startY={height * 0.7} radius={width * 0.45} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  backgroundBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  }
});
