import React, { createContext, useContext, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';

type HeaderVisibilityContextType = {
  translateY: Animated.Value;
  spacerHeight: Animated.AnimatedInterpolation<string | number>;
  hide: () => void;
  show: () => void;
  handleScroll: (offsetY: number) => void;
};

const HeaderVisibilityContext = createContext<HeaderVisibilityContextType | undefined>(undefined);

export const HeaderVisibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const lastOffsetRef = useRef(0);

  const animateTo = (toValue: number) => {
    Animated.timing(translateY, {
      toValue,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false, // Changed to false because we're animating height
    }).start();
  };

  const hide = () => animateTo(-56);
  const show = () => animateTo(0);

  const spacerHeight = translateY.interpolate({
    inputRange: [-56, 0],
    outputRange: [0, 56],
    extrapolate: 'clamp',
  });

  const handleScroll = (offsetY: number) => {
    const last = lastOffsetRef.current;
    const delta = offsetY - last;
    const threshold = 8;
    if (delta > threshold && offsetY > 0) {
      hide();
    } else if (delta < -threshold) {
      show();
    }
    lastOffsetRef.current = offsetY;
  };

  const value = useMemo(() => ({ translateY, spacerHeight, hide, show, handleScroll }), [translateY, spacerHeight]);

  return (
    <HeaderVisibilityContext.Provider value={value}>{children}</HeaderVisibilityContext.Provider>
  );
};

export const useHeaderVisibility = () => {
  const ctx = useContext(HeaderVisibilityContext);
  if (!ctx) throw new Error('useHeaderVisibility must be used within HeaderVisibilityProvider');
  return ctx;
};


