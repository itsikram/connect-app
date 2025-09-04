import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface StorySliderSkeletonProps {
  count?: number;
}

const StorySliderSkeleton: React.FC<StorySliderSkeletonProps> = ({ count = 5 }) => {
  const { colors: themeColors } = useTheme();

  const skeletonColor = themeColors.gray[300];
  const shimmerColor = themeColors.gray[200];

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.scrollContent}>
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} style={styles.storyItem}>
            <View style={[styles.storyImageContainer, { backgroundColor: skeletonColor }]}>
              {/* Profile pic skeleton */}
              <View style={[styles.profilePicSkeleton, { backgroundColor: shimmerColor }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    height: 140,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  storyItem: {
    width: 95,
    height: 120,
    marginRight: 12,
    position: 'relative',
  },
  storyImageContainer: {
    width: 95,
    height: 120,
    borderRadius: 12,
    position: 'relative',
  },
  profilePicSkeleton: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
  },
});

export default StorySliderSkeleton;
