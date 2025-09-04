import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { storyAPI } from '../lib/api';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StoryModal from './StoryModal';

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
  const { colors: themeColors } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchStories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await storyAPI.getAllStories();
      
      if (response.status === 200) {
        setStories(response.data || []);
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
    scrollViewRef.current?.scrollTo({ x: 0, animated: true });
  };

  const scrollRight = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.text.secondary }]}>
            Loading stories...
          </Text>
        </View>
      </View>
    );
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
    <View style={[styles.container, { backgroundColor: themeColors.background.primary }]}>
      <View style={styles.storyContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {stories.map((story, index) => (
            <TouchableOpacity
              key={story._id}
              style={styles.storyItem}
              onPress={() => handleStoryPress(story, index)}
              activeOpacity={0.8}
            >
              <View style={styles.storyImageContainer}>
                <Image
                  source={{ uri: story.image }}
                  style={styles.storyImage}
                  resizeMode="cover"
                />
                <View style={styles.gradient} />
              </View>
              
              <View style={styles.profilePicContainer}>
                <Image
                  source={{ uri: story.author.profilePic }}
                  style={[styles.profilePic, { borderColor: themeColors.primary }]}
                  resizeMode="cover"
                />
              </View>
              
              <Text 
                style={[styles.authorName, { color: themeColors.text.inverse }]}
                numberOfLines={1}
              >
                {story.author.fullName || `${story.author.user.firstName} ${story.author.user.surname}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Navigation arrows for larger screens or when needed */}
        {stories.length > 3 && (
          <>
            <TouchableOpacity
              style={[styles.arrowLeft, { backgroundColor: themeColors.surface.primary }]}
              onPress={scrollLeft}
            >
              <Icon name="chevron-left" size={20} color={themeColors.text.primary} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.arrowRight, { backgroundColor: themeColors.surface.primary }]}
              onPress={scrollRight}
            >
              <Icon name="chevron-right" size={20} color={themeColors.text.primary} />
            </TouchableOpacity>
          </>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  storyContainer: {
    position: 'relative',
    height: 140,
  },
  scrollView: {
    height: 140,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
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
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
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
    overflow: 'hidden',
    position: 'relative',
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
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  profilePicContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  authorName: {
    position: 'absolute',
    bottom: 8,
    left: 4,
    right: 4,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  arrowLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  arrowRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
});

export default StorySlider;
