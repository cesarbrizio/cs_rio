import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { VisualEffectVariant } from '../features/visualFeedback';

interface FeedbackBurstProps {
  triggerKey: string;
  variant: VisualEffectVariant;
}

interface ParticleDefinition {
  delay: number;
  dx: number;
  dy: number;
  size: number;
}

const PARTICLES: ParticleDefinition[] = [
  { delay: 0, dx: -42, dy: -28, size: 8 },
  { delay: 20, dx: -10, dy: -44, size: 10 },
  { delay: 40, dx: 22, dy: -36, size: 7 },
  { delay: 60, dx: 40, dy: -14, size: 9 },
  { delay: 80, dx: 34, dy: 18, size: 8 },
  { delay: 100, dx: 4, dy: 36, size: 10 },
  { delay: 120, dx: -28, dy: 30, size: 7 },
  { delay: 140, dx: -44, dy: 8, size: 9 },
];

const VARIANT_COLORS: Record<VisualEffectVariant, string[]> = {
  combat: ['#e0b04b', '#f4f1e8', '#d96c6c'],
  danger: ['#d96c6c', '#ffb84d', '#f4f1e8'],
  level_up: ['#e0b04b', '#3fa34d', '#f4f1e8'],
  success: ['#3fa34d', '#e0b04b', '#f4f1e8'],
};

export function FeedbackBurst({ triggerKey, variant }: FeedbackBurstProps): JSX.Element {
  const progress = useRef(new Animated.Value(0)).current;
  const colors = useMemo(() => VARIANT_COLORS[variant], [variant]);

  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(0);

    Animated.timing(progress, {
      delay: 30,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [progress, triggerKey, variant]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {PARTICLES.map((particle, index) => {
        const color = colors[index % colors.length];
        const localProgress = progress.interpolate({
          inputRange: [0, particle.delay / 520, 1],
          outputRange: [0, 0, 1],
          extrapolate: 'clamp',
        });

        return (
          <Animated.View
            key={`${variant}-${index}`}
            style={[
              styles.particle,
              {
                backgroundColor: color,
                height: particle.size,
                opacity: localProgress.interpolate({
                  inputRange: [0, 0.15, 0.75, 1],
                  outputRange: [0, 0.95, 0.5, 0],
                }),
                transform: [
                  {
                    translateX: localProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, particle.dx],
                    }),
                  },
                  {
                    translateY: localProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, particle.dy],
                    }),
                  },
                  {
                    scale: localProgress.interpolate({
                      inputRange: [0, 0.15, 1],
                      outputRange: [0.4, 1, 0.72],
                    }),
                  },
                ],
                width: particle.size,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  particle: {
    borderRadius: 999,
    position: 'absolute',
  },
});
