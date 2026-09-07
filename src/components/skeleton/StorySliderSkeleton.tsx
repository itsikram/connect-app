import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface StorySliderSkeletonProps {
  count?: number;
}

const STORY_WIDTH = 116;
const STORY_HEIGHT = 176;

const StorySliderSkeleton: React.FC<StorySliderSkeletonProps> = ({ count = 7 }) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {Array.from({ length: count }).map((_, index) => (
          <View key={index} style={styles.storyItem}>
            <View style={[styles.storyCard, { backgroundColor: themeColors.surface.secondary }]}>
              <View style={styles.profilePicContainer}>
                <SkeletonBlock width={32} height={32} borderRadius={16} />
              </View>
              <View style={styles.imageArea}>
                <SkeletonBlock width={'90%'} height={120} borderRadius={8} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
    minHeight: STORY_HEIGHT,
  },
  scrollContent: {
    paddingHorizontal: 0,
  },
  storyItem: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    marginRight: 8,
  },
  storyCard: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  profilePicContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  imageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StorySliderSkeleton;
