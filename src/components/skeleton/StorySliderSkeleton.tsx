import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface StorySliderSkeletonProps {
  count?: number;
}

const STORY_WIDTH = 150;
const STORY_HEIGHT = 230;

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
                <SkeletonBlock width={40} height={40} borderRadius={20} />
              </View>
              <View style={styles.imageArea}>
                <SkeletonBlock width={'90%'} height={150} borderRadius={8} />
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
    marginTop: 4,
    marginBottom: 10,
    minHeight: STORY_HEIGHT,
  },
  scrollContent: {
    paddingHorizontal: 10,
  },
  storyItem: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    marginRight: 10,
  },
  storyCard: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
  },
  profilePicContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  imageArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default StorySliderSkeleton;
