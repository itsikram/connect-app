import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Dimensions,
  FlatList,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  RefreshControl,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import KeyboardSafeView from '../components/KeyboardSafeView';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { useDispatch, useSelector } from 'react-redux';
import api, { profileAPI } from '../lib/api';
import { useFocusEffect } from '@react-navigation/native';
import UserPP from '../components/UserPP';
import { fitWatchContainSize, useWatchTokens } from '../theme/watchTokens';
import { useToast } from '../contexts/ToastContext';
import WatchSkeleton from '../components/skeleton/WatchSkeleton';
import { saveWatchVideoFromUrl } from '../lib/saveWatchVideo';
import {
  subscribeWatchDownloads,
  WatchDownloadJob,
} from '../utils/watchDownloadProgress';
import { RootState } from '../store';
import { addPost } from '../reducers/postsReducer';
import { updateProfileField } from '../reducers/profileReducer';
import { useWatchPip } from '../contexts/WatchPipContext';

type Video = {
  _id: string;
  videoUrl?: string;
  caption?: string;
  photos?: string;
  type?: string;
  author?: {
    _id?: string;
    username?: string;
    fullName?: string;
    profilePic?: string;
    isActive?: boolean;
  };
  user?: {
    name?: string;
    username?: string;
    avatar?: string;
    profilePicture?: string;
    photo?: string;
  };
  likesCount?: number;
  commentsCount?: number;
  reacts?: Array<{ profile?: any; type?: string }>;
  comments?: any[];
  shares?: any[];
};

const sameId = (a: any, b: any) =>
  String(a?._id || a || '') === String(b?._id || b || '');

type RootStackParamList = {
  SingleVideo: { videoId: string };
  SingleWatch: { watchId: string };
  [key: string]: any;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const VideoPlaceholder = ({ text, muted }: { text: string; muted: string }) => (
  <View style={styles.placeholder}>
    <Text style={{ color: text }}>Video will play here</Text>
    <Text style={{ color: muted, marginTop: 6 }}>Loading video...</Text>
  </View>
);

const VideoItem = ({
  post,
  isActive,
  containerHeight,
  onOpenPip,
}: {
  post: Video;
  isActive: boolean;
  containerHeight: number;
  onOpenPip?: (post: Video) => void;
}) => {
  const t = useWatchTokens();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useDispatch();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { showInfo, showSuccess, showError } = useToast();
  const [downloadJob, setDownloadJob] = useState<WatchDownloadJob | null>(null);

  const sourceUri = post?.videoUrl || post.photos;
  const authorName =
    post?.author?.fullName ||
    post?.user?.name ||
    post?.author?.username ||
    post?.user?.username ||
    'Unknown';
  const authorAvatar =
    post?.author?.profilePic ||
    post?.user?.avatar ||
    post?.user?.profilePicture ||
    post?.user?.photo ||
    '';
  const authorIsActive = post?.author?.isActive || false;
  const myId = myProfile?._id;
  const initialReacts = Array.isArray(post?.reacts) ? post.reacts : [];
  const [liked, setLiked] = useState(() =>
    initialReacts.some(react => sameId(react?.profile, myId)),
  );
  const [reactsCount, setReactsCount] = useState(
    typeof post?.likesCount === 'number'
      ? post.likesCount
      : initialReacts.length,
  );
  const [commentsCount, setCommentsCount] = useState(
    typeof post?.commentsCount === 'number'
      ? post.commentsCount
      : post?.comments?.length || 0,
  );
  const [sharesCount, setSharesCount] = useState(
    Array.isArray(post?.shares) ? post.shares.length : 0,
  );
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCap, setShareCap] = useState('');
  const [sharing, setSharing] = useState(false);
  const [following, setFollowing] = useState(() =>
    (myProfile?.following || []).some((id: any) =>
      sameId(id, post?.author?._id),
    ),
  );
  const [followBusy, setFollowBusy] = useState(false);
  const isOwnWatch = sameId(post?.author?._id, myId);

  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const videoBox = fitWatchContainSize(
    naturalSize.width,
    naturalSize.height,
    SCREEN_WIDTH,
    containerHeight,
  );

  useEffect(() => {
    setFollowing(
      (myProfile?.following || []).some((id: any) =>
        sameId(id, post?.author?._id),
      ),
    );
  }, [myProfile?.following, post?.author?._id]);

  useEffect(() => {
    return subscribeWatchDownloads(list => {
      setDownloadJob(list.find(job => job.id === post._id) || null);
    });
  }, [post._id]);

  const handleDownload = useCallback(async () => {
    try {
      const result = await saveWatchVideoFromUrl(post);
      if (result.reason === 'in-progress') {
        showInfo('This video is already downloading…');
        return;
      }
      if (result.reason === 'already-saved') {
        showInfo('Already saved to Downloads');
        return;
      }
      showSuccess('Video saved to Downloads');
    } catch (err: any) {
      showError(err?.message || 'Failed to download video');
    }
  }, [post, showError, showInfo, showSuccess]);

  const handleReact = useCallback(async () => {
    if (!post?._id || !myId) return;
    const next = !liked;
    setLiked(next);
    setReactsCount(n => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) {
        const res = await api.post('/react/addReact', {
          id: post._id,
          postType: 'watch',
          reactType: 'like',
        });
        if (res.status === 200 && Array.isArray(res.data?.reacts)) {
          setReactsCount(res.data.reacts.length);
        }
      } else {
        const res = await api.post('/react/removeReact', {
          id: post._id,
          postType: 'watch',
          reactor: myId,
        });
        if (res.status === 200 && Array.isArray(res.data?.reacts)) {
          setReactsCount(res.data.reacts.length);
        }
      }
    } catch (err) {
      setLiked(!next);
      setReactsCount(n => Math.max(0, n + (next ? -1 : 1)));
      Alert.alert('Error', 'Failed to update reaction');
    }
  }, [liked, myId, post._id]);

  const handleComment = useCallback(async () => {
    if (!commentText.trim() || !post?._id || postingComment) return;
    setPostingComment(true);
    try {
      const res = await api.post('/comment/addComment', {
        body: commentText.trim(),
        watch: post._id,
      });
      if (res.status === 200) {
        setCommentsCount(n => n + 1);
        setCommentText('');
        setCommentOpen(false);
        showSuccess('Comment posted');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  }, [commentText, post._id, postingComment, showSuccess]);

  const handleShareNow = useCallback(async () => {
    if (!post?._id || sharing) return;
    setSharing(true);
    try {
      const res = await api.post('/watch/share', {
        watchId: post._id,
        caption: shareCap,
      });
      if (res.status === 200) {
        setSharesCount(n => n + 1);
        if (res.data?.post) dispatch(addPost(res.data.post));
        setShareOpen(false);
        setShareCap('');
        showSuccess('Video shared to your feed');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to share video');
    } finally {
      setSharing(false);
    }
  }, [dispatch, post._id, shareCap, sharing, showSuccess]);

  const handleFollow = useCallback(async () => {
    const targetId = post?.author?._id;
    if (!targetId || !myId || followBusy || isOwnWatch) return;
    const next = !following;
    setFollowing(next);
    setFollowBusy(true);
    try {
      const res = next
        ? await profileAPI.follow(String(targetId))
        : await profileAPI.unfollow(String(targetId));
      if (res.status === 200) {
        setFollowing(!!res.data?.following);
        if (Array.isArray(res.data?.followingIds)) {
          dispatch(
            updateProfileField({
              field: 'following',
              value: res.data.followingIds,
            }),
          );
        }
        showSuccess(next ? 'Following' : 'Unfollowed');
      }
    } catch (err) {
      setFollowing(!next);
      Alert.alert('Error', 'Failed to update follow');
    } finally {
      setFollowBusy(false);
    }
  }, [
    dispatch,
    followBusy,
    following,
    isOwnWatch,
    myId,
    post?.author?._id,
    showSuccess,
  ]);

  useEffect(() => {
    if (isActive) {
      setIsManuallyPaused(false);
    }
  }, [isActive]);

  return (
    <View
      style={[
        styles.item,
        { height: containerHeight, backgroundColor: t.pageBg },
      ]}
    >
      {sourceUri ? (
        <>
          <View
            style={[
              styles.videoWell,
              { height: containerHeight, backgroundColor: t.pageBg },
            ]}
          >
            <ExpoVideo
              source={{ uri: sourceUri }}
              style={[
                styles.video,
                videoBox,
                { backgroundColor: t.pageBg, marginBottom: 120 },
              ]}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={isActive && !isManuallyPaused}
              isLooping
              isMuted={false}
              useNativeControls={false}
              onReadyForDisplay={event => {
                const size = event?.naturalSize;
                if (size?.width && size?.height) {
                  setNaturalSize({ width: size.width, height: size.height });
                }
              }}
            />
            <Pressable
              onPress={() => setIsManuallyPaused(p => !p)}
              style={styles.videoHit}
            />
            {isManuallyPaused && (
              <View pointerEvents="none" style={styles.playOverlay}>
                <View
                  style={[
                    styles.playBadge,
                    {
                      backgroundColor: t.playBadgeBg,
                      borderColor: t.chipBorder,
                    },
                  ]}
                >
                  <Icon name="play" size={36} color={t.mediaIcon} />
                </View>
              </View>
            )}
          </View>

        </>
      ) : (
        <VideoPlaceholder text={t.text} muted={t.muted} />
      )}

      <View style={styles.sideActions}>
        <TouchableOpacity
          onPress={() => navigation.navigate('SingleWatch', { watchId: post._id })}
          activeOpacity={0.8}
          style={styles.sideAction}
        >
          <View
            style={[
              styles.sideBtn,
              { backgroundColor: t.btnBg, borderColor: t.chipBorder },
            ]}
          >
            <Icon name="open-outline" size={20} color={t.chromeText} />
          </View>
          <Text style={[styles.sideCount, { color: t.chromeMuted }]}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => onOpenPip && onOpenPip(post)}
          activeOpacity={0.8}
          style={styles.sideAction}
        >
          <View
            style={[
              styles.sideBtn,
              { backgroundColor: t.btnBg, borderColor: t.chipBorder },
            ]}
          >
            <Icon name="tv-outline" size={20} color={t.chromeText} />
          </View>
          <Text style={[styles.sideCount, { color: t.chromeMuted }]}>PiP</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleReact}
          activeOpacity={0.8}
          style={styles.sideAction}
        >
          <View
            style={[
              styles.sideBtn,
              { backgroundColor: t.btnBg, borderColor: t.chipBorder },
            ]}
          >
            <Icon
              name={liked ? 'heart' : 'heart-outline'}
              size={22}
              color={liked ? t.error : t.chromeText}
            />
          </View>
          {reactsCount > 0 ? (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              {reactsCount}
            </Text>
          ) : (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              Like
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCommentOpen(true)}
          activeOpacity={0.8}
          style={styles.sideAction}
        >
          <View
            style={[
              styles.sideBtn,
              { backgroundColor: t.btnBg, borderColor: t.chipBorder },
            ]}
          >
            <Icon name="chatbubble-ellipses" size={20} color={t.chromeText} />
          </View>
          {commentsCount > 0 ? (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              {commentsCount}
            </Text>
          ) : (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              Comment
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShareOpen(true)}
          activeOpacity={0.8}
          style={styles.sideAction}
        >
          <View
            style={[
              styles.sideBtn,
              { backgroundColor: t.btnBg, borderColor: t.chipBorder },
            ]}
          >
            <Icon name="share-social" size={20} color={t.chromeText} />
          </View>
          {sharesCount > 0 ? (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              {sharesCount}
            </Text>
          ) : (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              Share
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleDownload}
          activeOpacity={0.8}
          style={styles.sideAction}
        >
          <View
            style={[
              styles.sideBtn,
              { backgroundColor: t.btnBg, borderColor: t.chipBorder },
            ]}
          >
            {downloadJob?.status === 'downloading' ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <Icon
                name={
                  downloadJob?.status === 'completed'
                    ? 'checkmark'
                    : 'download-outline'
                }
                size={20}
                color={
                  downloadJob?.status === 'completed' ? t.success : t.chromeText
                }
              />
            )}
          </View>
          {downloadJob?.status === 'downloading' ? (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              {Math.round(downloadJob.percent)}%
            </Text>
          ) : (
            <Text style={[styles.sideCount, { color: t.chromeMuted }]}>
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View
        style={[
          styles.meta,
          { backgroundColor: t.metaBg, borderColor: t.chipBorder },
        ]}
      >
        <View style={styles.authorRow}>
          {authorAvatar ? (
            <UserPP size={40} image={authorAvatar} isActive={authorIsActive} />
          ) : (
            <View
              style={[styles.avatarFallback, { backgroundColor: t.chipBg }]}
            >
              <Icon name="person" size={22} color={t.chromeMuted} />
            </View>
          )}
          <Text
            style={[styles.authorName, { color: t.chromeText }]}
            numberOfLines={1}
          >
            {authorName}
          </Text>
          {isOwnWatch ? null : (
            <TouchableOpacity
              onPress={handleFollow}
              disabled={followBusy}
              activeOpacity={0.8}
              style={[
                styles.followBtn,
                {
                  backgroundColor: following ? t.chipBg : t.primary,
                  borderWidth: following ? 1 : 0,
                  borderColor: t.chipBorder,
                  opacity: followBusy ? 0.6 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: following ? t.chromeText : t.ctaText,
                  fontSize: 12,
                  fontWeight: '700',
                }}
              >
                {following ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {!!post?.caption && (
          <Text
            style={{ color: t.chromeMuted, fontSize: 14 }}
            numberOfLines={2}
          >
            {post.caption}
          </Text>
        )}
      </View>

      <Modal
        visible={commentOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCommentOpen(false)}
      >
        <KeyboardSafeView force style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setCommentOpen(false)}
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: t.surface, borderColor: t.chipBorder },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: t.chromeText }]}>
              Comment
            </Text>
            <TextInput
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Write a comment…"
              placeholderTextColor={t.placeholder}
              autoFocus
              multiline
              style={[
                styles.sheetInput,
                {
                  backgroundColor: t.inputBg,
                  color: t.chromeText,
                  borderColor: t.chipBorder,
                },
              ]}
            />
            <View style={styles.sheetRow}>
              <TouchableOpacity
                onPress={() => {
                  setCommentOpen(false);
                  navigation.navigate('SingleWatch', { watchId: post._id });
                }}
              >
                <Text style={{ color: t.primary, fontWeight: '700' }}>
                  View all comments
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleComment}
                disabled={!commentText.trim() || postingComment}
                style={[
                  styles.sheetCta,
                  {
                    backgroundColor: t.primary,
                    opacity: commentText.trim() && !postingComment ? 1 : 0.5,
                  },
                ]}
              >
                {postingComment ? (
                  <ActivityIndicator color={t.ctaText} />
                ) : (
                  <Text style={{ color: t.ctaText, fontWeight: '700' }}>
                    Post
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardSafeView>
      </Modal>

      <Modal
        visible={shareOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setShareOpen(false)}
      >
        <KeyboardSafeView force style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShareOpen(false)}
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: t.surface, borderColor: t.chipBorder },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: t.chromeText }]}>
              Share video
            </Text>
            <TextInput
              value={shareCap}
              onChangeText={setShareCap}
              placeholder="Say something about this video"
              placeholderTextColor={t.placeholder}
              multiline
              style={[
                styles.sheetInput,
                {
                  backgroundColor: t.inputBg,
                  color: t.chromeText,
                  borderColor: t.chipBorder,
                },
              ]}
            />
            <TouchableOpacity
              onPress={handleShareNow}
              disabled={sharing}
              style={[
                styles.sheetCta,
                { backgroundColor: t.primary, alignSelf: 'stretch' },
              ]}
            >
              {sharing ? (
                <ActivityIndicator color={t.ctaText} />
              ) : (
                <Text style={{ color: t.ctaText, fontWeight: '700' }}>
                  Share Now
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardSafeView>
      </Modal>
    </View>
  );
};

const Videos = () => {
  const t = useWatchTokens();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [listHeight, setListHeight] = useState(SCREEN_HEIGHT);
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(false);

  // Use global WatchPipContext to open a floating Pip player that persists across screens
  const { pip: currentPip, isPipActive, startPip } = useWatchPip();
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();

  const openGlobalPip = (post: Video) => {
    const uri = post?.videoUrl || post?.photos;
    if (!uri) return;
    // Start the global Watch PiP
    startPip({
      videoUrl: uri,
      watchId: post._id,
      title: post.caption || post?.author?.fullName || 'Watch',
      playing: true,
      source: 'watch',
    });
    // ensure in-feed playback stops
    setActiveIndex(-1);
    // navigate back to Home tab so pip floats above app like media players
    navigation.navigate('Home');
  };

  const closeGlobalPip = () => {
    // close via context
    // useWatchPip provides closePip but we don't destructure it here; call startPip(null) is not valid
    // better to call update via optional hook - instead, import useWatchPip and call closePip if needed
    // Keep a no-op here; WatchPipPlayer will provide its own close control.
  };

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await api.get(`watch/profileWatch?pageNumber=${pageNum}`);
      if (res.status === 200) {
        const data = res.data || {};
        const items: Video[] = Array.isArray(data.watchs)
          ? data.watchs
          : Array.isArray(data)
          ? data
          : [];
        const more =
          typeof data.hasNewWatch === 'boolean' ? data.hasNewWatch : false;
        setHasMore(more);
        setVideos(prev => (append ? [...prev, ...items] : items));
      }
    } catch (e) {
      console.log('Failed to load videos', e);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchFeed(1, false);
    setRefreshing(false);
  }, [fetchFeed]);

  useEffect(() => {
    fetchFeed(1, false);
  }, [fetchFeed]);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
      };
    }, []),
  );

  // If the Videos screen loses focus and PiP is not open, ensure no video remains active
  useEffect(() => {
    if (!isScreenFocused && !isPipActive) {
      setActiveIndex(-1);
    }
  }, [isScreenFocused, isPipActive]);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setIsAppBackgrounded(nextAppState !== 'active');
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    handleAppStateChange(AppState.currentState);
    return () => {
      subscription.remove();
    };
  }, []);

  const onEndReached = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchFeed(next, true);
    }
  };

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 80 }),
    [],
  );
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const first = viewableItems[0];
      if (typeof first.index === 'number') setActiveIndex(first.index);
    }
  }).current;

  const onMomentumScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const newIndex = Math.round(offsetY / listHeight);
      if (newIndex !== activeIndex) setActiveIndex(newIndex);
    },
    [activeIndex, listHeight],
  );

  if (loading && videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.pageBg, paddingBottom: 70 }}>
        <WatchSkeleton />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.pageBg,
        paddingBottom: 30,
      }}
    >
      <StatusBar barStyle={t.statusBar} backgroundColor={t.pageBg} />
      <FlatList
        data={videos}
        keyExtractor={(item, idx) => item._id || String(idx)}
        renderItem={({ item, index }) => (
          <VideoItem
            post={item}
            isActive={
              index === activeIndex && (isScreenFocused || isAppBackgrounded)
            }
            containerHeight={listHeight}
            onOpenPip={openGlobalPip}
          />
        )}
        pagingEnabled
        onLayout={e => setListHeight(e.nativeEvent.layout.height)}
        onMomentumScrollEnd={onMomentumScrollEnd}
        showsVerticalScrollIndicator={false}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.8}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator color={t.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[t.primary]}
            tintColor={t.primary}
          />
        }
        ListEmptyComponent={
          <View
            style={[
              styles.centered,
              { height: SCREEN_HEIGHT, backgroundColor: t.pageBg },
            ]}
          >
            <Icon name="videocam-outline" size={48} color={t.tertiary} />
            <Text style={{ color: t.text, marginTop: 12, fontWeight: '600' }}>
              No videos found.
            </Text>
            <Text style={{ color: t.muted, marginTop: 4 }}>
              Pull down to refresh
            </Text>
          </View>
        }
      />


    </View>
  );
};

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  item: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    height: 400,
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoWell: {
    width: SCREEN_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  video: {
    width: SCREEN_WIDTH,
    alignSelf: 'center',
  },
  videoHit: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  playBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: -115,
  },
  detailsChip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  sideActions: {
    position: 'absolute',
    right: 5,
    top: 0,
    bottom: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 12,
  },
  sideAction: {
    alignItems: 'center',
    minWidth: 48,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  sideCount: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    position: 'absolute',
    left: '5%',
    width: '90%',
    bottom: 80,
    zIndex: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    flex: 1,
    fontWeight: '700',
    fontSize: 16,
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  footer: {
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    margin: 16,
    marginBottom: 28,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sheetInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetCta: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  // PiP window styles
  pipWindow: {
    width: Math.min(360, SCREEN_WIDTH - 32),
    height: Math.round((Math.min(360, SCREEN_WIDTH - 32) * 9) / 16),
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipDragHandle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 28,
    backgroundColor: 'transparent',
    zIndex: 20,
  },
});

export default Videos;
