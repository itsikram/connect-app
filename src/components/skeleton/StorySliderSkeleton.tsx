import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SkeletonBlock } from './Skeleton';
import { useTheme } from '../../contexts/ThemeContext';

interface StorySliderSkeletonProps {
  count?: number;
}

const StorySliderSkeleton: React.FC<StorySliderSkeletonProps> = ({ count = 5 }) => {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.storyContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {Array.from({ length: count }).map((_, index) => (
            <View key={index} style={styles.storyItem}>
              {/* Story image skeleton */}
              <View style={styles.storyImageContainer}>
                <SkeletonBlock 
                  width="100%" 
                  height={120} 
                  borderRadius={12}
                />
                
                {/* Profile picture skeleton */}
                <View style={styles.profilePicContainer}>
                  <SkeletonBlock 
                    width={36} 
                    height={36} 
                    borderRadius={18}
                  />
                </View>
                
                {/* Author name skeleton */}
                <View style={styles.authorNameContainer}>
                  <SkeletonBlock 
                    width={60} 
                    height={10} 
                    borderRadius={5}
                  />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  storyContainer: {
    position: 'relative',
    height: 160,
  },
  scrollView: {
    height: 160,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  storyItem: {
    width: 100,
    height: 140,
    marginRight: 16,
    position: 'relative',
  },
  storyImageContainer: {
    width: 100,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  profilePicContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    overflow: 'hidden',
    borderColor: 'transparent', // Will be overridden by skeleton
  },
  authorNameContainer: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    alignItems: 'center',
  },
});

export default StorySliderSkeleton;
