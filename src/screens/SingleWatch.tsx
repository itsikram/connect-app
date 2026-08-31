import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import { ResizeMode, Video as ExpoVideo } from 'expo-av';
import { useDispatch, useSelector } from 'react-redux';
import moment from 'moment';
import api, { profileAPI } from '../lib/api';
import UserPP from '../components/UserPP';
import { RootState } from '../store';
import { saveWatchVideoFromUrl } from '../lib/saveWatchVideo';
import { subscribeWatchDownloads, WatchDownloadJob } from '../utils/watchDownloadProgress';
import { fitWatchContainSize, useWatchTokens } from '../theme/watchTokens';
import WatchSkeleton from '../components/skeleton/WatchSkeleton';
import { useToast } from '../contexts/ToastContext';
import { addPost } from '../reducers/postsReducer';
import { updateProfileField } from '../reducers/profileReducer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_MAX_H = Math.min(420, Math.round(SCREEN_WIDTH * 0.72));

type RootStackParamList = {
  SingleWatch: { watchId?: string; videoId?: string };
  SingleVideo: { videoId?: string; watchId?: string };
  FriendProfile: { friendId: string };
};

type WatchAuthor = {
  _id?: string;
  fullName?: string;
  username?: string;
  profilePic?: string;
  isActive?: boolean;
  user?: { firstName?: string; surname?: string };
};

type WatchComment = {
  _id: string;
  body?: string;
  content?: string;
  text?: string;
  createdAt?: string;
  author?: WatchAuthor;
};

type WatchItem = {
  _id: string;
  videoUrl?: string;
  thumbnail?: string;
  caption?: string;
  photos?: string;
  createdAt?: string;
  author?: WatchAuthor;
  reacts?: Array<{ profile?: string; type?: string }>;
  comments?: WatchComment[];
  shares?: any[];
};

const displayName = (person?: WatchAuthor) => {
  if (!person) return 'Unknown';
  if (person.fullName) return person.fullName;
  const fromUser = [person.user?.firstName, person.user?.surname].filter(Boolean).join(' ').trim();
  return fromUser || person.username || 'Unknown';
};

const commentBody = (comment: WatchComment) =>
  comment.body || comment.content || comment.text || '';

const SingleWatch = () => {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const params = (route.params || {}) as { watchId?: string; videoId?: string };
  const watchId = params.watchId || params.videoId || '';

  const t = useWatchTokens();
  const dispatch = useDispatch();
  const myProfile = useSelector((state: RootState) => state.profile);
  const { showInfo, showSuccess, showError } = useToast();
  const scrollRef = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);

  const [watch, setWatch] = useState<WatchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [focused, setFocused] = useState(true);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCap, setShareCap] = useState('');
  const [sharing, setSharing] = useState(false);
  const [following, setFollowing] = useState(false);
  const [liked, setLiked] = useState(false);
  const [reactsCount, setReactsCount] = useState(0);
  const [comments, setComments] = useState<WatchComment[]>([]);
  const [sharesCount, setSharesCount] = useState(0);
  const [downloadJob, setDownloadJob] = useState<WatchDownloadJob | null>(null);

  const videoBox = fitWatchContainSize(naturalSize.width, naturalSize.height, SCREEN_WIDTH - 2, PLAYER_MAX_H);
  const sourceUri = watch?.videoUrl || watch?.photos || '';
  const authorId = watch?.author?._id;
  const isOwn = authorId && myProfile?._id && String(authorId) === String(myProfile._id);

  const fetchWatch = useCallback(async () => {
    if (!watchId) {
      setError('Video not found');
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const res = await api.get('/watch/single', { params: { watchId } });
      if (res.status === 200 && res.data) {
        const item: WatchItem = res.data.watch || res.data;
        setWatch(item);
        const reacts = Array.isArray(item.reacts) ? item.reacts : [];
        setReactsCount(reacts.length);
        setLiked(!!myProfile?._id && reacts.some((r) => String(r?.profile) === String(myProfile._id)));
        setComments(Array.isArray(item.comments) ? item.comments : []);
        setSharesCount(Array.isArray(item.shares) ? item.shares.length : 0);
        setFollowing(
          !!item.author?._id &&
            (myProfile?.following || []).some((id: any) => String(id?._id || id) === String(item.author?._id)),
        );
      } else {
        setError('Video not found');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load video');
    } finally {
      setLoading(false);
    }
  }, [watchId, myProfile?._id]);

  useEffect(() => {
    fetchWatch();
  }, [fetchWatch]);

  useEffect(() => {
    if (!watchId) return;
    return subscribeWatchDownloads((list) => {
      setDownloadJob(list.find((job) => job.id === watchId) || null);
    });
  }, [watchId]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      setPaused(false);
      return () => {
        setFocused(false);
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWatch();
    setRefreshing(false);
  }, [fetchWatch]);

  const handleLike = async () => {
    if (!watch?._id || !myProfile?._id) return;
    const next = !liked;
    setLiked(next);
    setReactsCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      if (next) {
        const res = await api.post('/react/addReact', {
          id: watch._id,
          postType: 'watch',
          reactType: 'like',
        });
        if (res.status === 200 && Array.isArray(res.data?.reacts)) {
          setReactsCount(res.data.reacts.length);
        }
      } else {
        const res = await api.post('/react/removeReact', {
          id: watch._id,
          postType: 'watch',
          reactor: myProfile._id,
        });
        if (res.status === 200 && Array.isArray(res.data?.reacts)) {
          setReactsCount(res.data.reacts.length);
        }
      }
    } catch (err) {
      setLiked(!next);
      setReactsCount((n) => Math.max(0, n + (next ? -1 : 1)));
      Alert.alert('Error', 'Failed to update like');
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !watch?._id || postingComment) return;
    setPostingComment(true);
    try {
      const res = await api.post('/comment/addComment', {
        body: commentText.trim(),
        watch: watch._id,
      });
      if (res.status === 200) {
        const created: WatchComment = {
          ...res.data,
          body: res.data.body || res.data.content || commentText.trim(),
          author: res.data.author || {
            _id: myProfile?._id,
            fullName: myProfile?.fullName,
            profilePic: myProfile?.profilePic,
          },
        };
        setComments((prev) => [...prev, created]);
        setCommentText('');
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add comment');
    } finally {
      setPostingComment(false);
    }
  };

  const handleShareNow = async () => {
    if (!watch?._id || sharing) return;
    setSharing(true);
    try {
      const res = await api.post('/watch/share', { watchId: watch._id, caption: shareCap });
      if (res.status === 200) {
        setSharesCount((n) => n + 1);
        if (res.data?.post) dispatch(addPost(res.data.post));
        setShareOpen(false);
        setShareCap('');
        showSuccess('Video shared');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to share video');
    } finally {
      setSharing(false);
    }
  };

  const handleFollow = async () => {
    if (!authorId || !myProfile?._id || isOwn) return;
    const next = !following;
    setFollowing(next);
    try {
      const res = next
        ? await profileAPI.follow(String(authorId))
        : await profileAPI.unfollow(String(authorId));
      if (res.status === 200) {
        setFollowing(!!res.data?.following);
        if (Array.isArray(res.data?.followingIds)) {
          dispatch(updateProfileField({ field: 'following', value: res.data.followingIds }));
        }
        showSuccess(next ? 'Following' : 'Unfollowed');
      }
    } catch (err) {
      setFollowing(!next);
      Alert.alert('Error', 'Failed to update follow');
    }
  };

  const handleDownload = async () => {
    if (!watch) return;
    try {
      const result = await saveWatchVideoFromUrl(watch);
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
  };

  const openAuthor = () => {
    if (!authorId) return;
    navigation.navigate('FriendProfile', { friendId: authorId });
  };

  const focusComposer = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
    setTimeout(() => commentInputRef.current?.focus(), 280);
  };

  const chromeBtn = useMemo(
    () => ({
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.btnBg,
      borderWidth: 1,
      borderColor: t.chipBorder,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    }),
    [t.btnBg, t.chipBorder],
  );

  if (loading || !myProfile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.pageBg }]}>
        <WatchSkeleton variant="page" showBack />
      </SafeAreaView>
    );
  }

  if (error || !watch) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: t.pageBg }]}>
        <StatusBar barStyle={t.statusBar} backgroundColor={t.pageBg} />
        <View style={[styles.header, { borderBottomColor: t.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="arrow-back" size={24} color={t.chromeText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.chromeText }]}>Watch</Text>
        </View>
        <View style={styles.centered}>
          <Icon name="alert-circle-outline" size={48} color={t.error} />
          <Text style={[styles.errorText, { color: t.chromeText }]}>{error || 'Video not found'}</Text>
          <TouchableOpacity
            onPress={fetchWatch}
            style={[styles.retry, { backgroundColor: t.primary }]}
          >
            <Text style={{ color: t.ctaText, fontWeight: '700' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.pageBg }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.pageBg} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: t.border, backgroundColor: t.pageBg }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <Icon name="arrow-back" size={24} color={t.chromeText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: t.chromeText }]}>Watch</Text>
          <TouchableOpacity onPress={handleDownload} style={styles.headerBtn}>
            {downloadJob?.status === 'downloading' ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <Icon
                name={downloadJob?.status === 'completed' ? 'checkmark' : 'download-outline'}
                size={22}
                color={downloadJob?.status === 'completed' ? t.success : t.chromeText}
              />
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[t.primary]}
              tintColor={t.primary}
            />
          }
        >
          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
            <View style={styles.authorRow}>
              <TouchableOpacity onPress={openAuthor} style={styles.authorLeft}>
                <UserPP size={44} image={watch.author?.profilePic || ''} isActive={watch.author?.isActive} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.authorName, { color: t.chromeText }]} numberOfLines={1}>
                    {displayName(watch.author)}
                  </Text>
                  <Text style={{ color: t.chromeMuted, fontSize: 12 }}>
                    {watch.createdAt ? moment(watch.createdAt).fromNow() : ''}
                  </Text>
                </View>
              </TouchableOpacity>
              {!isOwn ? (
                <TouchableOpacity
                  onPress={handleFollow}
                  style={[
                    styles.follow,
                    {
                      backgroundColor: following ? t.chipBg : t.primary,
                      borderColor: t.chipBorder,
                      borderWidth: following ? 1 : 0,
                    },
                  ]}
                >
                  <Text style={{ color: following ? t.chromeText : t.ctaText, fontWeight: '700', fontSize: 12 }}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {!!watch.caption && (
              <Text style={[styles.caption, { color: t.chromeText }]}>{watch.caption}</Text>
            )}

            <View style={[styles.player, { backgroundColor: t.pageBg, height: videoBox.height }]}>
              {sourceUri ? (
                <>
                  <ExpoVideo
                    source={{ uri: sourceUri }}
                    style={{
                      width: videoBox.width,
                      height: videoBox.height,
                      backgroundColor: t.pageBg,
                    }}
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay={focused && !paused}
                    isLooping
                    isMuted={false}
                    useNativeControls={false}
                    onReadyForDisplay={(event) => {
                      const size = event?.naturalSize;
                      if (size?.width && size?.height) {
                        setNaturalSize({ width: size.width, height: size.height });
                      }
                    }}
                  />
                  <TouchableOpacity
                    style={styles.playerHit}
                    onPress={() => setPaused((p) => !p)}
                    activeOpacity={1}
                  >
                    {paused ? (
                      <View style={[styles.playBadge, { backgroundColor: t.playBadgeBg, borderColor: t.chipBorder }]}>
                        <Icon name="play" size={32} color={t.mediaIcon} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={{ color: t.chromeMuted }}>Video not available</Text>
              )}
            </View>

            <View style={styles.stats}>
              <Text style={{ color: t.chromeMuted, fontSize: 13 }}>
                {reactsCount} {reactsCount === 1 ? 'react' : 'reacts'}
              </Text>
              <Text style={{ color: t.chromeMuted, fontSize: 13 }}>
                {comments.length} {comments.length === 1 ? 'comment' : 'comments'} · {sharesCount} shares
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity onPress={handleLike} style={styles.action}>
                <View style={chromeBtn}>
                  <Icon name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? t.error : t.chromeText} />
                </View>
                <Text style={[styles.actionLabel, { color: t.chromeMuted }]}>{liked ? 'Liked' : 'Like'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.action} onPress={focusComposer}>
                <View style={chromeBtn}>
                  <Icon name="chatbubble-outline" size={20} color={t.chromeText} />
                </View>
                <Text style={[styles.actionLabel, { color: t.chromeMuted }]}>Comment</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShareOpen(true)} style={styles.action}>
                <View style={chromeBtn}>
                  <Icon name="share-outline" size={20} color={t.chromeText} />
                </View>
                <Text style={[styles.actionLabel, { color: t.chromeMuted }]}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDownload} style={styles.action}>
                <View style={chromeBtn}>
                  {downloadJob?.status === 'downloading' ? (
                    <ActivityIndicator size="small" color={t.primary} />
                  ) : (
                    <Icon
                      name={downloadJob?.status === 'completed' ? 'checkmark' : 'download-outline'}
                      size={20}
                      color={downloadJob?.status === 'completed' ? t.success : t.chromeText}
                    />
                  )}
                </View>
                <Text style={[styles.actionLabel, { color: t.chromeMuted }]}>
                  {downloadJob?.status === 'downloading' ? `${Math.round(downloadJob.percent)}%` : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, paddingBottom: 8 }]}>
            <Text style={[styles.commentsTitle, { color: t.chromeText }]}>
              Comments ({comments.length})
            </Text>
            {comments.length === 0 ? (
              <View style={styles.emptyComments}>
                <Icon name="chatbubble-ellipses-outline" size={36} color={t.tertiary} />
                <Text style={{ color: t.chromeMuted, marginTop: 8 }}>No comments yet</Text>
              </View>
            ) : (
              comments.map((comment) => (
                <View key={comment._id} style={styles.commentRow}>
                  <UserPP size={32} image={comment.author?.profilePic || ''} isActive={false} />
                  <View style={[styles.commentBubble, { backgroundColor: t.chipBg }]}>
                    <Text style={[styles.commentAuthor, { color: t.chromeText }]}>
                      {displayName(comment.author)}
                    </Text>
                    <Text style={{ color: t.chromeText, fontSize: 14, lineHeight: 20 }}>
                      {commentBody(comment)}
                    </Text>
                    {comment.createdAt ? (
                      <Text style={{ color: t.chromeMuted, fontSize: 11, marginTop: 4 }}>
                        {moment(comment.createdAt).fromNow()}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <View style={[styles.composer, { backgroundColor: t.surface, borderTopColor: t.border }]}>
          <UserPP size={34} image={myProfile?.profilePic || ''} isActive={false} />
          <TextInput
            ref={commentInputRef}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment…"
            placeholderTextColor={t.placeholder}
            style={[
              styles.input,
              { backgroundColor: t.inputBg, color: t.chromeText, borderColor: t.chipBorder },
            ]}
            multiline
          />
          <TouchableOpacity
            onPress={handleComment}
            disabled={!commentText.trim() || postingComment}
            style={{ opacity: commentText.trim() && !postingComment ? 1 : 0.45 }}
          >
            {postingComment ? (
              <ActivityIndicator size="small" color={t.primary} />
            ) : (
              <Icon name="send" size={22} color={t.primary} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={shareOpen} transparent animationType="fade" onRequestClose={() => setShareOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShareOpen(false)} />
          <View style={[styles.shareSheet, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Text style={[styles.shareTitle, { color: t.chromeText }]}>Share video</Text>
            <TextInput
              value={shareCap}
              onChangeText={setShareCap}
              placeholder="Say something about this video"
              placeholderTextColor={t.placeholder}
              style={[
                styles.shareInput,
                { backgroundColor: t.inputBg, color: t.chromeText, borderColor: t.chipBorder },
              ]}
              multiline
            />
            <TouchableOpacity
              onPress={handleShareNow}
              disabled={sharing}
              style={[styles.retry, { backgroundColor: t.primary, alignSelf: 'stretch' }]}
            >
              {sharing ? (
                <ActivityIndicator color={t.ctaText} />
              ) : (
                <Text style={{ color: t.ctaText, fontWeight: '700' }}>Share Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    padding: 12,
    paddingBottom: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
    gap: 8,
  },
  authorLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
  },
  follow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  caption: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  player: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playerHit: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 22,
    paddingBottom: 16,
    paddingTop: 4,
  },
  action: {
    alignItems: 'center',
    minWidth: 48,
  },
  actionLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  commentsTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  emptyComments: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  commentBubble: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  retry: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  shareSheet: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  shareTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  shareInput: {
    minHeight: 88,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
    textAlignVertical: 'top',
  },
});

export default SingleWatch;
