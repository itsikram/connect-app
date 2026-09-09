import React, { useEffect, useState } from 'react';
import { Image, ImageProps, StyleSheet, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { SkeletonBlock } from './skeleton/Skeleton';

type ImageWithSkeletonProps = Omit<ImageProps, 'style'> & {
  style?: ImageProps['style'];
};

const ImageWithSkeleton = ({ style, onLoad, onError, ...props }: ImageWithSkeletonProps) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [retryKey, setRetryKey] = useState(0);

  const sourceKey = JSON.stringify(props.source);

  useEffect(() => {
    setState('loading');
    setRetryKey(0);
  }, [sourceKey]);

  return (
    <View style={[styles.frame, style]}>
      {state === 'loading' && <SkeletonBlock width="100%" height={1} style={StyleSheet.absoluteFillObject} />}
      {state === 'error' && (
        <TouchableOpacity
          style={styles.error}
          onPress={() => {
            setState('loading');
            setRetryKey(value => value + 1);
          }}
          accessibilityRole="button"
          accessibilityLabel="Reload image"
        >
          <Icon name="refresh" size={26} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
      )}
      <Image
        {...props}
        key={retryKey}
        style={[style, state === 'loading' && styles.hidden]}
        onLoad={event => {
          setState('loaded');
          onLoad?.(event);
        }}
        onError={event => {
          setState('error');
          onError?.(event);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', position: 'relative' },
  hidden: { opacity: 0 },
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
});

export default ImageWithSkeleton;
