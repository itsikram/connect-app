import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardSafeView from './KeyboardSafeView';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ProfileImage from './ProfileImage';
import UserPP from './UserPP';
import StoryEngagementSheet from './story/StoryEngagementSheet';
import { storyAPI } from '../lib/api';
import { RootState } from '../store';
import {
  REACT_LIST,
  profileDisplayName,
  sameProfileId,
  uniqueReactCount,
} from '../utils/reactTypes';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const ACCENT = '#00D4FF';

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
  reacts?: any[];
  comments?: any[];
}

interface StoryModalProps {
  visible: boolean;
  story: Story | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  onDeleted?: (storyId: string) => void;
}

const StoryModal: React.FC<StoryModalProps> = ({
  visible,
  story,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  onDeleted,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const myProfile = useSelector((state: RootState) => state.profile) as any;
  const myId = myProfile?._id;

  const [imageLoading, setImageLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [storyData, setStoryData] = useState<Story | null>(story);
  const [comments, setComments] = useState<any[]>([]);
  const [reactType, setReactType] = useState<string | null>(null);
  const [panel, setPanel] = useState<'comments' | 'reacts' | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [holding, setHolding] = useState(false);
  const reactLockRef = useRef(false);
  const pressStartedAt = useRef(0);

  const activeStory = storyData || story;
  const paused = !!panel || inputFocused || holding;
  const isOwnStory = sameProfileId(activeStory?.author, myId);
  const reacts = Array.isArray(activeStory?.reacts) ? activeStory.reacts.filter(Boolean) : [];
  const populatedComments = useMemo(
    () => comments.filter((item) => item && typeof item === 'object' && (item._id || item.body)),
    [comments]
  );
  const reactCount = uniqueReactCount(reacts);
  const commentCount = populatedComments.length;

  useEffect(() => {
    if (!visible || !story?._id) {
      setStoryData(story);
      setComments([]);
      setReactType(null);
      setPanel(null);
      return;
    }

    setStoryData(story);
    const incoming = Array.isArray(story.comments)
      ? story.comments.filter((item) => item && typeof item === 'object')
      : [];
    setComments(incoming);
    const mine = (story.reacts || []).find((react: any) => sameProfileId(react.profile, myId));
    setReactType(mine?.type ? String(mine.type).toLowerCase() : null);
    setPanel(null);
    setInputFocused(false);
    setHolding(false);

    let cancelled = false;
    setDetailsLoading(true);
    storyAPI
      .getSingleStory(story._id)
      .then((res) => {
        if (cancelled || res.status !== 200 || !res.data?._id) return;
        setStoryData(res.data);
        const nextComments = Array.isArray(res.data.comments)
          ? res.data.comments.filter((item: any) => item && typeof item === 'object')
          : [];
        setComments(nextComments);
        const myReact = (res.data.reacts || []).find((react: any) => sameProfileId(react.profile, myId));
        setReactType(myReact?.type ? String(myReact.type).toLowerCase() : null);
      })
      .catch((e) => console.log(e))
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, story?._id, myId]);

  useEffect(() => {
    if (!visible || !story || paused) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (hasNext && onNext) {
            onNext();
            return 0;
          }
          onClose();
          return 0;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [visible, story?._id, paused, hasNext, onNext, onClose]);

  useEffect(() => {
    setProgress(0);
    setImageLoading(true);
  }, [story?._id]);

  const requireAuth = () => {
    if (myId) return true;
    Alert.alert('Log in required', 'Log in to react and comment on stories.');
    return false;
  };

  const applyReacts = (nextReacts: any[]) => {
    setStoryData((prev) => (prev ? { ...prev, reacts: nextReacts } : prev));
    const mine = nextReacts.find((react) => sameProfileId(react.profile, myId));
    setReactType(mine?.type ? String(mine.type).toLowerCase() : null);
  };

  const clickStoryReact = async (type: string) => {
    if (!requireAuth() || !activeStory?._id || reactLockRef.current) return;
    reactLockRef.current = true;
    const prevType = reactType;
    const prevReacts = [...reacts];

    if (reactType === type) {
      applyReacts(reacts.filter((react) => !sameProfileId(react.profile, myId)));
      try {
        const res = await storyAPI.removeReact(activeStory._id);
        if (res.status === 200 && Array.isArray(res.data?.reacts)) {
          applyReacts(res.data.reacts);
        } else if (res.status !== 200) {
          applyReacts(prevReacts);
          setReactType(prevType);
        }
      } catch (e) {
        applyReacts(prevReacts);
        setReactType(prevType);
      } finally {
        reactLockRef.current = false;
      }
      return;
    }

    const nextReacts = [...reacts];
    const idx = nextReacts.findIndex((react) => sameProfileId(react.profile, myId));
    if (idx >= 0) nextReacts[idx] = { ...nextReacts[idx], type };
    else nextReacts.push({ profile: myProfile || myId, type });
    applyReacts(nextReacts);

    try {
      const res = await storyAPI.addReact(activeStory._id, type);
      if (res.status === 200 && Array.isArray(res.data?.reacts)) {
        applyReacts(res.data.reacts);
      } else if (res.status !== 200) {
        applyReacts(prevReacts);
        setReactType(prevType);
      }
    } catch (e) {
      applyReacts(prevReacts);
      setReactType(prevType);
    } finally {
      reactLockRef.current = false;
    }
  };

  const openProfile = useCallback(
    (profileId: string) => {
      if (!profileId) return;
      onClose();
      if (sameProfileId(profileId, myId)) {
        (navigation as any).navigate('Menu', { screen: 'MyProfile' });
        return;
      }
      (navigation as any).navigate('FriendProfile', { friendId: profileId });
    },
    [myId, navigation, onClose]
  );

  const handleDeleteStory = () => {
    if (!activeStory?._id) return;
    Alert.alert('Delete story', 'Are you sure you want to delete this story?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await storyAPI.deleteStory(activeStory._id);
            if (res.status === 200) {
              onDeleted?.(activeStory._id);
              onClose();
            }
          } catch (e) {
            console.log(e);
          }
        },
      },
    ]);
  };

  const handleHoldIn = () => {
    pressStartedAt.current = Date.now();
    setHolding(true);
  };

  const handleHoldOut = () => {
    setHolding(false);
  };

  const wasTap = () => Date.now() - pressStartedAt.current < 280;

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return `${Math.floor(diffInHours * 60)}m ago`;
    }
    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    }
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  if (!visible || !activeStory) return null;

  const authorName = profileDisplayName(activeStory.author);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (panel) {
          setPanel(null);
          return;
        }
        onClose();
      }}
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.9)" />
      <KeyboardSafeView force nested>
        <View style={[styles.container, { paddingTop: insets.top || StatusBar.currentHeight || 0 }]}>
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBar, { width: `${progress}%` }]} />
              </View>
            </View>

            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.authorContainer}
                onPress={() => openProfile(activeStory.author?._id)}
                activeOpacity={0.8}
              >
                <ProfileImage
                  uri={activeStory.author?.profilePic}
                  pixelSize={80}
                  style={styles.authorPic}
                  resizeMode="cover"
                />
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{authorName}</Text>
                  <Text style={styles.storyTime}>{formatTime(activeStory.createdAt)}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.headerActions}>
                <TouchableOpacity
                  style={[styles.headerAction, panel === 'reacts' && styles.headerActionActive]}
                  onPress={() => setPanel((prev) => (prev === 'reacts' ? null : 'reacts'))}
                >
                  <Icon name="favorite" size={18} color={panel === 'reacts' ? ACCENT : 'white'} />
                  <Text style={styles.headerActionCount}>{reactCount}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.headerAction, panel === 'comments' && styles.headerActionActive]}
                  onPress={() => setPanel((prev) => (prev === 'comments' ? null : 'comments'))}
                >
                  <Icon name="chat-bubble" size={18} color={panel === 'comments' ? ACCENT : 'white'} />
                  <Text style={styles.headerActionCount}>{commentCount}</Text>
                </TouchableOpacity>
                {isOwnStory ? (
                  <TouchableOpacity onPress={handleDeleteStory} style={styles.closeButton}>
                    <Icon name="delete" size={20} color="#FF5A5A" />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Icon name="close" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={[styles.contentContainer, panel ? styles.contentWithPanel : null]}>
            {imageLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="white" />
              </View>
            )}

            <Image
              source={{ uri: activeStory.image }}
              style={styles.storyImage}
              resizeMode="contain"
              onLoadStart={() => setImageLoading(true)}
              onLoadEnd={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />

            {!panel && (
              <>
                <TouchableOpacity
                  style={styles.leftTouchArea}
                  onPress={() => {
                    if (!wasTap() || !hasPrevious) return;
                    onPrevious?.();
                  }}
                  onPressIn={handleHoldIn}
                  onPressOut={handleHoldOut}
                  activeOpacity={hasPrevious ? 0.3 : 1}
                />
                <TouchableOpacity
                  style={styles.rightTouchArea}
                  onPress={() => {
                    if (!wasTap()) return;
                    if (hasNext && onNext) onNext();
                    else onClose();
                  }}
                  onPressIn={handleHoldIn}
                  onPressOut={handleHoldOut}
                  activeOpacity={0.3}
                />
                {hasPrevious && (
                  <View style={styles.leftIndicator} pointerEvents="none">
                    <Icon name="chevron-left" size={32} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
                {hasNext && (
                  <View style={styles.rightIndicator} pointerEvents="none">
                    <Icon name="chevron-right" size={32} color="rgba(255,255,255,0.7)" />
                  </View>
                )}
              </>
            )}
          </View>

          <View style={[styles.footer, !panel && { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={styles.reactRow}>
              {REACT_LIST.map((react) => {
                const selected = reactType === react.key;
                return (
                  <TouchableOpacity
                    key={react.key}
                    style={[styles.reactButton, selected && styles.reactButtonSelected]}
                    onPress={() => clickStoryReact(react.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.reactEmoji}>{react.emoji}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!panel ? (
              <TouchableOpacity
                style={styles.peekComposer}
                onPress={() => {
                  if (!requireAuth()) return;
                  setPanel('comments');
                }}
                activeOpacity={0.85}
              >
                <UserPP image={myProfile?.profilePic} size={32} />
                <Text style={styles.peekPlaceholder} numberOfLines={1}>
                  {myId ? 'Write a public comment…' : 'Log in to comment'}
                </Text>
                <Icon name="send" size={18} color={ACCENT} />
              </TouchableOpacity>
            ) : null}
          </View>

          {panel ? (
            <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
              <StoryEngagementSheet
                storyId={activeStory._id}
                comments={populatedComments}
                reacts={reacts}
                myProfile={myProfile}
                activeTab={panel}
                loading={detailsLoading && populatedComments.length === 0 && panel === 'comments'}
                onTabChange={setPanel}
                onCommentsChange={setComments}
                onClose={() => setPanel(null)}
                onOpenProfile={openProfile}
                onInputFocus={() => setInputFocused(true)}
                onInputBlur={() => setInputFocused(false)}
              />
            </View>
          ) : null}
        </View>
      </KeyboardSafeView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 2,
  },
  headerActionActive: {
    backgroundColor: 'rgba(0,212,255,0.16)',
  },
  headerActionCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
    marginLeft: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  contentWithPanel: {
    flex: 0.42,
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
    height: screenHeight * 0.52,
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
  footer: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  reactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reactButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(36,37,38,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reactButtonSelected: {
    borderColor: ACCENT,
    transform: [{ scale: 1.08 }],
    backgroundColor: 'rgba(0,212,255,0.16)',
  },
  reactEmoji: {
    fontSize: 24,
  },
  peekComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#242526',
    borderRadius: 22,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  peekPlaceholder: {
    flex: 1,
    color: '#B0B3B8',
    fontSize: 14,
  },
});

export default StoryModal;
