import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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

interface StoryModalProps {
  visible: boolean;
  story: Story | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

const StoryModal: React.FC<StoryModalProps> = ({
  visible,
  story,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}) => {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const [imageLoading, setImageLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  // Auto-progress timer (5 seconds per story)
  useEffect(() => {
    if (!visible || !story) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (hasNext && onNext) {
            onNext();
            return 0;
          } else {
            onClose();
            return 0;
          }
        }
        return prev + 2; // 2% every 100ms = 5 seconds total
      });
    }, 100);

    return () => {
      clearInterval(timer);
      setProgress(0);
    };
  }, [visible, story, hasNext, onNext, onClose]);

  // Reset progress when story changes
  useEffect(() => {
    setProgress(0);
    setImageLoading(true);
  }, [story]);

  if (!story) return null;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return `${Math.floor(diffInHours * 60)}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
      <View style={[styles.container, { paddingTop: insets.top || StatusBar.currentHeight || 0 }]}>
        <View style={styles.header}>
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[styles.progressBar, { width: `${progress}%` }]} 
              />
            </View>
          </View>

          {/* Header row with author info and close button */}
          <View style={styles.headerRow}>
            {/* Story author info */}
            <View style={styles.authorContainer}>
              <Image
                source={{ uri: story.author.profilePic }}
                style={styles.authorPic}
                resizeMode="cover"
              />
              <View style={styles.authorInfo}>
                <Text style={styles.authorName}>
                  {story.author.fullName || `${story.author.user.firstName} ${story.author.user.surname}`}
                </Text>
                <Text style={styles.storyTime}>
                  {formatTime(story.createdAt)}
                </Text>
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Story content */}
        <View style={styles.contentContainer}>
          {imageLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="white" />
            </View>
          )}
          
          <Image
            source={{ uri: story.image }}
            style={styles.storyImage}
            resizeMode="contain"
            onLoadStart={() => setImageLoading(true)}
            onLoadEnd={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
          />

          {/* Navigation areas */}
          <TouchableOpacity
            style={styles.leftTouchArea}
            onPress={hasPrevious ? onPrevious : undefined}
            activeOpacity={hasPrevious ? 0.3 : 1}
          />
          
          <TouchableOpacity
            style={styles.rightTouchArea}
            onPress={hasNext ? onNext : onClose}
            activeOpacity={0.3}
          />

          {/* Navigation indicators */}
          {hasPrevious && (
            <View style={styles.leftIndicator}>
              <Icon name="chevron-left" size={32} color="rgba(255,255,255,0.7)" />
            </View>
          )}
          
          {hasNext && (
            <View style={styles.rightIndicator}>
              <Icon name="chevron-right" size={32} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBarBackground: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
  },
  progressBar: {
    height: 2,
    backgroundColor: 'white',
    borderRadius: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorPic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  authorInfo: {
    flex: 1,
  },
  authorName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  storyTime: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
    zIndex: 5,
  },
  storyImage: {
    width: screenWidth,
    height: screenHeight * 0.7,
  },
  leftTouchArea: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.3,
  },
  rightTouchArea: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: screenWidth * 0.7,
  },
  leftIndicator: {
    position: 'absolute',
    left: 20,
    top: '50%',
    marginTop: -16,
  },
  rightIndicator: {
    position: 'absolute',
    right: 20,
    top: '50%',
    marginTop: -16,
  },
});

export default StoryModal;
