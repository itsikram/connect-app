import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storyAPI } from '../lib/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StoryModal from './StoryModal';
import StorySliderSkeleton from './skeleton/StorySliderSkeleton';

const { width: screenWidth } = Dimensions.get('window');

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
  };
  createdAt: string;
}

interface StorySliderProps {
  onStoryPress?: (story: Story) => void;
}

const StorySlider: React.FC<StorySliderProps> = ({ onStoryPress }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number>(-1);
  const [showStoryModal, setShowStoryModal] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { colors: themeColors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const getAuthorName = (story: Story) => {
    if (!story?.author) return 'Unknown User';
    
    // Try fullName first
    if (story.author.fullName) {
      return story.author.fullName;
    }
    
    // Try to construct from user data
    if (story.author.user) {
      const firstName = story.author.user.firstName || '';
      const surname = story.author.user.surname || '';
      const fullName = `${firstName} ${surname}`.trim();
      if (fullName) return fullName;
    }
    
    return 'Unknown User';
  };

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await storyAPI.getAllStories();
      
      if (response.status === 200) {
        setStories(response.data || []);
        // Animate in the stories
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } catch (err: any) {
      console.error('Error fetching stories:', err);
      const errorMessage = err?.response?.data?.message || 'Failed to load stories';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  const handleStoryPress = (story: Story, index: number) => {
    if (onStoryPress) {
      onStoryPress(story);
    } else {
      // Default behavior - open story modal
      setSelectedStoryIndex(index);
      setShowStoryModal(true);
    }
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

  const scrollLeft = () => {
    const newPosition = Math.max(0, scrollPosition - 200);
    scrollViewRef.current?.scrollTo({ x: newPosition, animated: true });
  };

  const scrollRight = () => {
    const newPosition = scrollPosition + 200;
    scrollViewRef.current?.scrollTo({ x: newPosition, animated: true });
  };

  const handleScroll = (event: any) => {
    const currentPosition = event.nativeEvent.contentOffset.x;
    setScrollPosition(currentPosition);
    setCanScrollLeft(currentPosition > 0);
    setCanScrollRight(currentPosition < event.nativeEvent.contentSize.width - event.nativeEvent.layoutMeasurement.width);
  };

  if (loading) {
    return <StorySliderSkeleton count={5} />;
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: themeColors.status.error }]}>
            {error}
          </Text>
          <TouchableOpacity onPress={fetchStories} style={styles.retryButton}>
            <Text style={[styles.retryText, { color: themeColors.primary }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (stories.length === 0) {
    return null; // Don't show anything if no stories
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          backgroundColor: themeColors.background.primary,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.storyContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {stories.map((story, index) => (
            <TouchableOpacity
              key={story._id}
              style={styles.storyItem}
              onPress={() => handleStoryPress(story, index)}
              activeOpacity={0.7}
            >
              <View style={[styles.storyImageContainer, { shadowColor: '#000' }]}>
                <Image
                  source={{ uri: story.image }}
                  style={styles.storyImage}
                  resizeMode="cover"
                />
                <View style={styles.gradient} />
                
                {/* Story ring indicator */}
                <View style={[styles.storyRing, { borderColor: themeColors.primary }]} />
              </View>
              
              <View style={[styles.profilePicContainer, { borderColor: themeColors.primary }]}>
                <Image
                  source={{ uri: story.author.profilePic }}
                  style={styles.profilePic}
                  resizeMode="cover"
                />
                {/* Online indicator */}
                <View style={[styles.onlineIndicator, { backgroundColor: themeColors.status.success }]} />
              </View>
              
              <Text 
                style={[styles.authorName, { color: themeColors.text.inverse }]}
                numberOfLines={1}
              >
                {getAuthorName(story)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Enhanced Navigation arrows */}
        {stories.length > 3 && (
          <>
            {canScrollLeft && (
              <Animated.View style={styles.arrowContainer}>
                <TouchableOpacity
                  style={[styles.arrowLeft, { backgroundColor: themeColors.surface.primary }]}
                  onPress={scrollLeft}
                  activeOpacity={0.8}
                >
                  <Icon name="chevron-left" size={20} color={themeColors.text.primary} />
                </TouchableOpacity>
              </Animated.View>
            )}
            
            {canScrollRight && (
              <Animated.View style={styles.arrowContainer}>
                <TouchableOpacity
                  style={[styles.arrowRight, { backgroundColor: themeColors.surface.primary }]}
                  onPress={scrollRight}
                  activeOpacity={0.8}
                >
                  <Icon name="chevron-right" size={20} color={themeColors.text.primary} />
                </TouchableOpacity>
              </Animated.View>
            )}
          </>
        )}

        {/* Progress indicator */}
        {stories.length > 1 && (
          <View style={styles.progressContainer}>
            {stories.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  {
                    backgroundColor: index === Math.floor(scrollPosition / 107) ? themeColors.primary : themeColors.border.primary,
                  }
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Story Modal */}
      <StoryModal
        visible={showStoryModal}
        story={selectedStoryIndex >= 0 ? stories[selectedStoryIndex] : null}
        onClose={handleCloseStory}
        onNext={handleNextStory}
        onPrevious={handlePreviousStory}
        hasNext={selectedStoryIndex < stories.length - 1}
        hasPrevious={selectedStoryIndex > 0}
      />
    </Animated.View>
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
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  storyRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'transparent',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F1F3F4',
  },
  authorName: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.3,
  },
  arrowContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
  },
  arrowLeft: {
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  arrowRight: {
    right: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
    opacity: 0.6,
  },
});

export default StorySlider;
