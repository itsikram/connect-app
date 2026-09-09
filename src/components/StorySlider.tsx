import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import { storyAPI } from '../lib/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StoryModal from './StoryModal';
import StorySliderSkeleton from './skeleton/StorySliderSkeleton';
import UserPP from './UserPP';
import ImageWithSkeleton from './ImageWithSkeleton';
import CacheManager from '../utils/cacheManager';
import { RootState } from '../store';

const STORY_WIDTH = 116;
const STORY_HEIGHT = 176;
const STORY_GAP = 8;
const SCROLL_STEP = STORY_WIDTH + STORY_GAP;

interface Story {
  _id: string;
  image: string;
  bgColor?: string;
  author: {
    _id: string;
    profilePic: string;
    user: {
      firstName: string;
      surname: string;
    };
    fullName: string;
    isActive?: boolean;
  };
  createdAt: string;
}

interface StorySliderProps {
  onStoryPress?: (story: Story) => void;
  refreshKey?: number;
}

const parseStoryGradient = (bg?: string, fallback: string[] = ['#242526', '#1a1c1e']) => {
  if (!bg) return fallback;
  const matches = bg.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{3,8}/g);
  if (matches && matches.length >= 2) return matches.slice(0, 2);
  if (matches && matches.length === 1) return [matches[0], matches[0]];
  return fallback;
};

const StorySlider: React.FC<StorySliderProps> = ({ onStoryPress, refreshKey = 0 }) => {
  const myProfile = useSelector((state: RootState) => state.profile);
  const profileId = (myProfile as any)?._id || 'guest';
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number>(-1);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const { colors: themeColors, isDarkMode } = useTheme();
  const storyFallback = isDarkMode
    ? ['#242526', '#1a1c1e']
    : [themeColors.surface.secondary, themeColors.background.tertiary];
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchStories = useCallback(async () => {
    try {
      const response = await storyAPI.getAllStories();
      if (response.status === 200) {
        const nextStories = Array.isArray(response.data) ? response.data : [];
        setStories(nextStories);
        CacheManager.setCachedStories(profileId, nextStories);
      }
    } catch (err) {
      console.error('Error fetching stories:', err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      const cached = await CacheManager.getCachedStories(profileId);
      if (!cancelled && cached && cached.length > 0) {
        setStories(cached);
        setLoading(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  useEffect(() => {
    const timer = setTimeout(fetchStories, 250);
    return () => clearTimeout(timer);
  }, [fetchStories, refreshKey]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('story:created', () => {
      fetchStories();
    });
    return () => sub.remove();
  }, [fetchStories]);

  const handleStoryPress = (story: Story, index: number) => {
    if (onStoryPress) {
      onStoryPress(story);
      return;
    }
    setSelectedStoryIndex(index);
    setShowStoryModal(true);
  };

  const handleNextStory = () => {
    if (selectedStoryIndex < stories.length - 1) {
      setSelectedStoryIndex(selectedStoryIndex + 1);
    } else {
      setShowStoryModal(false);
      setSelectedStoryIndex(-1);
    }
  };

  const handlePreviousStory = () => {
    if (selectedStoryIndex > 0) {
      setSelectedStoryIndex(selectedStoryIndex - 1);
    }
  };

  const handleCloseStory = () => {
    setShowStoryModal(false);
    setSelectedStoryIndex(-1);
  };

  const handleStoryDeleted = (storyId: string) => {
    setStories((prev) => {
      const next = prev.filter((item) => item._id !== storyId);
      CacheManager.setCachedStories(profileId, next);
      return next;
    });
    setShowStoryModal(false);
    setSelectedStoryIndex(-1);
  };

  const scrollLeft = () => {
    const next = Math.max(0, scrollPosition - SCROLL_STEP * 2);
    scrollViewRef.current?.scrollTo({ x: next, animated: true });
  };

  const scrollRight = () => {
    const maxOffset = Math.max(0, contentWidth - viewportWidth);
    const next = Math.min(maxOffset, scrollPosition + SCROLL_STEP * 2);
    scrollViewRef.current?.scrollTo({ x: next, animated: true });
  };

  const canScrollLeft = scrollPosition > 4;
  const canScrollRight = contentWidth > viewportWidth && scrollPosition < contentWidth - viewportWidth - 4;

  if (loading && stories.length === 0) {
    return <StorySliderSkeleton count={7} />;
  }

  if (!loading && stories.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.storyContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
          onScroll={(event) => setScrollPosition(event.nativeEvent.contentOffset.x)}
          onContentSizeChange={(width) => setContentWidth(width)}
          onLayout={(event) => setViewportWidth(event.nativeEvent.layout.width)}
          scrollEventThrottle={16}
        >
          {stories.map((story, index) => {
            const gradientColors = parseStoryGradient(story.bgColor, storyFallback);
            return (
              <TouchableOpacity
                key={story._id || `story-${index}`}
                style={styles.storyItem}
                onPress={() => handleStoryPress(story, index)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={gradientColors as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.storyCard, { backgroundColor: themeColors.surface.secondary }]}
                >
                  <View style={styles.profilePicContainer}>
                    <UserPP
                      image={story.author?.profilePic}
                      isActive={!!story.author?.isActive}
                      size={32}
                      hasStory
                    />
                  </View>
                  <View style={styles.storyImageContainer}>
                    {!!story.image && (
                      <ImageWithSkeleton
                        source={{ uri: story.image }}
                        style={styles.storyImage}
                        resizeMode="contain"
                      />
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={[
            styles.arrow,
            styles.arrowLeft,
            { backgroundColor: themeColors.surface.secondary, opacity: canScrollLeft ? 1 : 0.45 },
          ]}
          onPress={scrollLeft}
          activeOpacity={0.8}
          disabled={!canScrollLeft}
        >
          <Icon name="chevron-left" size={30} color={themeColors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.arrow,
            styles.arrowRight,
            { backgroundColor: themeColors.surface.secondary, opacity: canScrollRight ? 1 : 0.45 },
          ]}
          onPress={scrollRight}
          activeOpacity={0.8}
          disabled={!canScrollRight}
        >
          <Icon name="chevron-right" size={30} color={themeColors.text.primary} />
        </TouchableOpacity>
      </View>

      <StoryModal
        visible={showStoryModal}
        story={selectedStoryIndex >= 0 ? stories[selectedStoryIndex] : null}
        onClose={handleCloseStory}
        onNext={handleNextStory}
        onPrevious={handlePreviousStory}
        hasNext={selectedStoryIndex < stories.length - 1}
        hasPrevious={selectedStoryIndex > 0}
        onDeleted={handleStoryDeleted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 8,
  },
  storyContainer: {
    position: 'relative',
    minHeight: STORY_HEIGHT,
  },
  scrollView: {
    minHeight: STORY_HEIGHT,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  storyItem: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    marginRight: STORY_GAP,
  },
  storyCard: {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  storyImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  profilePicContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
  },
  arrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  arrowLeft: {
    left: 6,
  },
  arrowRight: {
    right: 6,
  },
});

export default StorySlider;
