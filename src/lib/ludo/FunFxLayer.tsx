import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

/**
 * Comic-style pop-ups over the board, matching the web game
 * (web/src/pages/ludo/components/FunFxLayer.js): a big bouncy caption such as
 * "BONK!" or "SIX!" plus emoji that fly outward and fade.
 */

export type FxKind = 'capture' | 'rolledSix' | 'threeSixes' | 'pieceOut' | 'win';

export interface FxBurst {
  id: string;
  kind: FxKind;
  text: string;
  color: string;
  particles: { emoji: string; dx: number; dy: number; rot: number; delay: number }[];
}

export const FX_PRESETS: Record<FxKind, { texts: string[]; emojis: string[]; color: string }> = {
  capture: {
    texts: ['BONK!', 'POW!', 'Gotcha!', 'Back home! 😂', 'WHAM!'],
    emojis: ['💥', '⭐', '😵', '💫', '🤕'],
    color: '#ff4d4f',
  },
  rolledSix: {
    texts: ['SIX! 🎲', 'Lucky 6!', 'Boom, six!', 'Roll again!'],
    emojis: ['✨', '🎲', '⭐', '🔥'],
    color: '#faad14',
  },
  threeSixes: {
    texts: ['Three sixes?! 😵', 'Too lucky! Turn over', 'Oops! 🙈'],
    emojis: ['😭', '🙈', '💀', '🥲'],
    color: '#8c8c8c',
  },
  pieceOut: {
    texts: ["Let's go! 🚀", 'Out it comes!', 'Zoom!'],
    emojis: ['🚀', '💨', '✨'],
    color: '#2ec4b6',
  },
  win: {
    texts: ['WINNER! 🏆', 'Champion! 👑', 'Victory! 🎉'],
    emojis: ['🎉', '🏆', '🎊', '👑', '🥳', '⭐'],
    color: '#52c41a',
  },
};

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

export const createBurst = (kind: string, scale = 1): FxBurst | null => {
  const preset = FX_PRESETS[kind as FxKind];
  if (!preset) return null;
  const count = kind === 'win' ? 14 : 8;
  const radius = (kind === 'win' ? 150 : 95) * scale;
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: kind as FxKind,
    text: pick(preset.texts),
    color: preset.color,
    particles: Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const r = radius * (0.7 + Math.random() * 0.5);
      return {
        emoji: pick(preset.emojis),
        dx: Math.round(Math.cos(angle) * r),
        dy: Math.round(Math.sin(angle) * r),
        rot: Math.round((Math.random() - 0.5) * 540),
        delay: Math.round(Math.random() * 120),
      };
    }),
  };
};

const Particle = ({ particle, big, still }: { particle: FxBurst['particles'][number]; big: boolean; still: boolean }) => {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: still ? 700 : big ? 1150 : 950,
      delay: particle.delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, particle.delay, big, still]);
  const travel = still ? 0.35 : 1;
  return (
    <Animated.Text
      style={[
        styles.particle,
        big && styles.particleBig,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.dx * travel] }) },
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, particle.dy * travel] }) },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${still ? 0 : particle.rot}deg`],
              }),
            },
            { scale: progress.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0.3, 1.25, 0.8] }) },
          ],
        },
      ]}
    >
      {particle.emoji}
    </Animated.Text>
  );
};

const Burst = ({ burst, onDone, reduceMotion }: { burst: FxBurst; onDone: (id: string) => void; reduceMotion: boolean }) => {
  const caption = useRef(new Animated.Value(0)).current;
  const big = burst.kind === 'win';
  useEffect(() => {
    const life = big ? 1700 : 1300;
    Animated.sequence([
      reduceMotion
        ? Animated.timing(caption, { toValue: 1, duration: 150, useNativeDriver: true })
        : Animated.spring(caption, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      Animated.delay(life - 600),
      Animated.timing(caption, { toValue: 2, duration: 300, useNativeDriver: true }),
    ]).start(() => onDone(burst.id));
  }, [caption, big, burst.id, onDone, reduceMotion]);

  return (
    <View style={styles.burst} pointerEvents="none">
      {burst.particles.map((p, i) => (
        <Particle key={i} particle={p} big={big} still={reduceMotion} />
      ))}
      <Animated.Text
        style={[
          styles.caption,
          big && styles.captionBig,
          {
            color: burst.color,
            opacity: caption.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] }),
            transform: [
              { scale: caption.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 1, 1.15] }) },
              { rotate: caption.interpolate({ inputRange: [0, 1, 2], outputRange: ['-14deg', '-4deg', '-4deg'] }) },
              { translateY: caption.interpolate({ inputRange: [0, 1, 2], outputRange: [10, 0, -18] }) },
            ],
          },
        ]}
      >
        {burst.text}
      </Animated.Text>
    </View>
  );
};

export const FunFxLayer = ({
  bursts,
  onDone,
  reduceMotion = false,
}: {
  bursts: FxBurst[];
  onDone: (id: string) => void;
  reduceMotion?: boolean;
}) => {
  if (!bursts.length) return null;
  return (
    <View style={styles.layer} pointerEvents="none" testID="ludo-fx-layer">
      {bursts.map((burst) => (
        <Burst key={burst.id} burst={burst} onDone={onDone} reduceMotion={reduceMotion} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 2, height: 3 },
    textShadowRadius: 1,
    paddingHorizontal: 8,
  },
  captionBig: { fontSize: 38 },
  particle: { position: 'absolute', fontSize: 24 },
  particleBig: { fontSize: 30 },
});
