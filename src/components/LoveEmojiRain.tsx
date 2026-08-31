import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LOVE_FALL_EMOJIS } from '../utils/chatThemes';

const FLAKE_COUNT = 56;
const BURST_MS = 7200;

type Flake = {
  id: string;
  emoji: string;
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
};

const LoveEmojiRain = ({ burstId }: { burstId: number }) => {
  const [box, setBox] = useState({ width: 360, height: 420 });
  const [flakes, setFlakes] = useState<Flake[]>([]);
  const anims = useRef<Animated.Value[]>([]);
  const measuredHeight = box.height;

  useEffect(() => {
    if (!burstId) return undefined;
    const next: Flake[] = Array.from({ length: FLAKE_COUNT }, (_, index) => ({
      id: `${burstId}-${index}`,
      emoji: LOVE_FALL_EMOJIS[index % LOVE_FALL_EMOJIS.length],
      left: Math.random() * 100,
      size: 16 + Math.random() * 18,
      delay: Math.random() * 1600,
      duration: 2600 + Math.random() * 2400,
      drift: (Math.random() - 0.5) * 80,
    }));
    anims.current = next.map(() => new Animated.Value(0));
    setFlakes(next);

    const animations = next.map((flake, index) =>
      Animated.timing(anims.current[index], {
        toValue: 1,
        duration: flake.duration,
        delay: flake.delay,
        easing: Easing.bezier(0.33, 0, 0.67, 0.28),
        useNativeDriver: true,
      }),
    );
    Animated.stagger(18, animations).start();

    const timer = setTimeout(() => setFlakes([]), BURST_MS);
    return () => clearTimeout(timer);
  }, [burstId, measuredHeight]);

  const flakeViews = useMemo(
    () =>
      flakes.map((flake, index) => {
        const progress = anims.current[index] || new Animated.Value(0);
        const travel = Math.max(measuredHeight, 280) + 48;
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-36, travel],
        });
        const translateX = progress.interpolate({
          inputRange: [0, 0.5, 1],
          outputRange: [0, flake.drift * 0.5, flake.drift],
        });
        const rotate = progress.interpolate({
          inputRange: [0, 1],
          outputRange: ['-12deg', `${flake.drift > 0 ? 220 : -200}deg`],
        });
        const opacity = progress.interpolate({
          inputRange: [0, 0.08, 0.82, 1],
          outputRange: [0, 1, 1, 0],
        });
        return (
          <Animated.Text
            key={flake.id}
            pointerEvents="none"
            style={[
              styles.flake,
              {
                left: (flake.left / 100) * box.width,
                fontSize: flake.size,
                opacity,
                transform: [{ translateY }, { translateX }, { rotate }],
              },
            ]}
          >
            {flake.emoji}
          </Animated.Text>
        );
      }),
    [flakes, measuredHeight, box.width],
  );

  if (!burstId) return null;

  return (
    <View
      pointerEvents="none"
      style={styles.overlay}
      onLayout={(event) =>
        setBox({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })
      }
    >
      {flakeViews}
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 1,
  },
  flake: {
    position: 'absolute',
    top: 0,
  },
});

export default LoveEmojiRain;
