import React, { useState, useEffect, memo, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, StyleSheet, Modal, TextInput, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FAIcon from 'react-native-vector-icons/FontAwesome5';
import api from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import UserPP from './UserPP';
import config from '../lib/config';
import { useFeedTokens } from '../theme/feedTokens';
import {
  CurrentReactIcon,
  PlacedReactIcons,
  ReactPicker,
  getReactLabel,
  uniquePlacedReacts,
} from './post/ReactIcons';

const SCREEN_WIDTH = Dimensions.get('window').width;
const POST_IMAGE_MAX_HEIGHT = 620;
const SHOW_ACTION_LABELS = SCREEN_WIDTH > 420;

const sameId = (a: any, b: any) => String(a?._id || a || '') === String(b?._id || b || '');

const uniqueReactTypes = (reacts: any[] = []) => uniquePlacedReacts(reacts);

const commentHasMyReact = (comment: any, myId: any) => {
  const reacts = Array.isArray(comment?.reacts) ? comment.reacts : [];
  return reacts.some((r: any) => sameId(r, myId) || sameId(r?._id, myId));
};

const uniqueReactCount = (reacts: any[] = []) => {
  const seen = new Set<string>();
  reacts.forEach((react) => {
    const id = String(react?.profile?._id || react?.profile || '');
    if (id) seen.add(id);
  });
  return seen.size;
};

const isPopulatedComment = (comment: any) =>
  !!comment &&
  typeof comment === 'object' &&
  !Array.isArray(comment) &&
  Boolean(comment.body || comment.text || comment.author);

const normalizeComments = (list: any) =>
  (Array.isArray(list) ? list : []).filter(isPopulatedComment);

const commentAuthorName = (comment: any) =>
  comment?.author?.fullName ||
  comment?.author?.displayName ||
  [comment?.author?.user?.firstName, comment?.author?.user?.surname].filter(Boolean).join(' ').trim() ||
  'User';
// Local colorful SVGs drawn in code (no gradients/filters to ensure compatibility)
// import UserPP from '../UserPP'; // You need to create a React Native version of this
// import PostComment from './PostComment'; // You need to create a React Native version of this

type RootStackParamList = {
  PostDetail: { postId: string };
  SinglePost: { postId: string };
  SingleVideo: { videoId: string };
  FriendProfile: { friendId: string };
};

const default_pp_src = config?.DEFAULT_PROFILE_URL;

interface PostProps {
  data: any;
  onPostDeleted?: (postId: string) => void;
}

const Post: React.FC<PostProps> = ({ data, onPostDeleted }) => {
  const post = data || {};
  const myProfile = useSelector((state: any) => state.profile);
  const myProfileId = myProfile?._id;
  const [totalReacts, setTotalReacts] = useState<number>(uniqueReactCount(post.reacts));
  const [totalShares, setTotalShares] = useState<number>(post.shares?.length || 0);
  const [totalComments, setTotalComments] = useState<number>(
    Array.isArray(post.comments) ? post.comments.length : 0,
  );
  const [reactType, setReactType] = useState<string | false>(false);
  const [isReacted, setIsReacted] = useState<boolean>(false);
  const [shareCap, setShareCap] = useState<string>('');
  const [placedReacts, setPlacedReacts] = useState<string[]>(uniqueReactTypes(post.reacts));
  const [isShareModal, setIsShareModal] = useState<boolean>(false);
  const [isPostOption, setIsPostOption] = useState<boolean>(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [showReactions, setShowReactions] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [comments, setComments] = useState<any[]>(() => normalizeComments(post.comments));
  const [loadingComments, setLoadingComments] = useState<boolean>(false);
  const [type, setType] = useState<string>(post.type || 'post');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [isPostingComment, setIsPostingComment] = useState<boolean>(false);
  const [isPostingReply, setIsPostingReply] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [likingCommentId, setLikingCommentId] = useState<string | null>(null);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const [imageHeight, setImageHeight] = useState<number>(Math.min(POST_IMAGE_MAX_HEIGHT, SCREEN_WIDTH));

  const reactLockRef = useRef(false);
  const commentsFetchedRef = useRef<string | null>(null);
  const commentInputRef = useRef<TextInput>(null);

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors: themeColors, isDarkMode } = useTheme();
  const feed = useFeedTokens();
  const cardBg = feed.postBg;
  const textColor = feed.postText;
  const subTextColor = feed.postTextMuted;
  const borderColor = feed.postBorder;
  const inputBg = feed.inputBg;
  const inputText = feed.postText;
  const accentColor = feed.postAccent;

  const isAuth = post.author?._id === myProfileId;
  const postType = post.type || type || 'post';
  const commentBubbleBg = isDarkMode ? '#2a2a2a' : '#f1f3f4';
  const commentActionColor = isDarkMode ? '#a1a1aa' : '#5f6368';
  const commentTimeColor = '#8b93a1';

  const getAssetUrl = (path?: string): string => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    return `${config.SOCKET_BASE_URL}${path}`;
  };

  const isValidImageUrl = (url?: string | string[]): boolean => {
    if (!url) return false;
    const imageUrl = typeof url === 'string' ? url : url[0];
    if (!imageUrl || imageUrl.trim() === '' || imageUrl === 'null' || imageUrl === 'undefined') return false;
    // Check if it's a valid URL format
    const trimmedUrl = imageUrl.trim();
    return trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://') || (trimmedUrl.startsWith('/') && trimmedUrl.length > 1);
  };

  // Safety check for required post data
  if (!post._id || !post.author) {
    console.warn('Post component received invalid data:', post);
    return (
      <View style={[styles.postContainer, { backgroundColor: cardBg, borderColor, shadowOpacity: feed.shadowOpacity }]}>
        <Text style={[styles.caption, { color: textColor }]}>
          Invalid post data
        </Text>
      </View>
    );
  }

  // ... socket logic can be added here if needed

  useEffect(() => {
    const reacts = Array.isArray(post.reacts) ? post.reacts : [];
    setPlacedReacts(uniqueReactTypes(reacts));
    setTotalReacts(uniqueReactCount(reacts));
    const mine = reacts.find((react: any) => sameId(react?.profile, myProfileId));
    if (mine?.type) {
      setReactType(mine.type);
      setIsReacted(true);
    } else {
      setReactType(false);
      setIsReacted(false);
    }
  }, [post._id, post.reacts, myProfileId]);

  useEffect(() => {
    commentsFetchedRef.current = null;
    const next = normalizeComments(post.comments);
    setComments(next);
    setTotalComments(Array.isArray(post.comments) ? post.comments.length : next.length);
  }, [post._id]);

  useEffect(() => {
    const next = normalizeComments(post.comments);
    setTotalComments(Array.isArray(post.comments) ? post.comments.length : next.length);
    if (next.length > 0) {
      setComments(next);
      commentsFetchedRef.current = post._id;
    }
  }, [post._id, post.comments]);

  useEffect(() => {
    if (!post._id) return;
    if (commentsFetchedRef.current === post._id) return;

    const populated = normalizeComments(post.comments);
    if (populated.length > 0) {
      setComments(populated);
      commentsFetchedRef.current = post._id;
      return;
    }

    const expected = Array.isArray(post.comments) ? post.comments.length : 0;
    if (expected === 0) {
      commentsFetchedRef.current = post._id;
      return;
    }

    let cancelled = false;
    setLoadingComments(true);
    api
      .get('/post/single', { params: { postId: post._id } })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.comments || res.data?.post?.comments || [];
        setComments(normalizeComments(data));
        commentsFetchedRef.current = post._id;
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });

    return () => {
      cancelled = true;
    };
  }, [post._id, post.comments]);

  // Reset image load error when post changes
  useEffect(() => {
    setImageLoadError(false);
  }, [post._id, post.photos]);

  // Like, Love, Haha, Sad, Remove React, Place React logic
  const removeReact = async () => {
    if (reactLockRef.current) return;
    reactLockRef.current = true;
    const prevType = reactType;
    const prevCount = totalReacts;
    setTotalReacts((state) => Math.max(0, state - 1));
    setReactType(false);
    setIsReacted(false);
    try {
      const res = await api.post('/react/removeReact', { id: post._id, postType: 'post', reactor: myProfileId });
      if (res.status === 200 && Array.isArray(res.data?.reacts)) {
        setTotalReacts(uniqueReactCount(res.data.reacts));
        setPlacedReacts(uniqueReactTypes(res.data.reacts));
        return true;
      }
      if (res.status !== 200) {
        setTotalReacts(prevCount);
        setReactType(prevType);
        setIsReacted(!!prevType);
      }
    } catch (e) {
      setTotalReacts(prevCount);
      setReactType(prevType);
      setIsReacted(!!prevType);
    } finally {
      reactLockRef.current = false;
    }
  };

  const placeReact = async (type: string) => {
    if (reactLockRef.current) return;
    reactLockRef.current = true;
    const prevType = reactType;
    const prevCount = totalReacts;
    const alreadyReacted = isReacted;
    if (!alreadyReacted) setTotalReacts((state) => state + 1);
    setPlacedReacts((prev) => {
      const withoutPrev = prev.filter((item) => item !== prevType);
      return withoutPrev.includes(type) ? withoutPrev : [...withoutPrev, type];
    });
    setReactType(type);
    setIsReacted(true);
    try {
      const res = await api.post('/react/addReact', { id: post._id, postType: 'post', reactType: type });
      if (res.status === 200 && Array.isArray(res.data?.reacts)) {
        setTotalReacts(uniqueReactCount(res.data.reacts));
        setPlacedReacts(uniqueReactTypes(res.data.reacts));
        const mine = res.data.reacts.find((react: any) => sameId(react?.profile, myProfileId));
        if (mine?.type) setReactType(mine.type);
        return true;
      }
      setTotalReacts(prevCount);
      setReactType(prevType);
      setIsReacted(!!prevType);
    } catch (e) {
      setTotalReacts(prevCount);
      setReactType(prevType);
      setIsReacted(!!prevType);
    } finally {
      reactLockRef.current = false;
    }
  };

  // Like button handler for normal press
  const handleLikePress = () => {
    if (isReacted && reactType === 'like') {
      removeReact();
    } else {
      placeReact('like');
    }
  };

  // Long press handler to show reactions
  const handleLikeLongPress = () => {
    setShowReactions(true);
  };

  // Hide reactions when a reaction is selected or user taps elsewhere
  const handleSelectReaction = (type: string) => {
    setShowReactions(false);
    handleReact(type);
  };

  // Hide reactions when clicking outside
  const handleOutsidePress = () => {
    setShowReactions(false);
  };

  // Like button handler for each type
  const handleReact = (type: string) => {
    if (isReacted && reactType === type) {
      removeReact();
    } else {
      placeReact(type);
    }
  };

  // Share logic (already implemented)
  const onClickShareNow = async () => {
    let res = await api.post('post/share', { postId: post._id, caption: shareCap });
    if (res.status == 200) {
      setTotalShares(state => state + 1);
      // dispatch(addPost(res.data.post)); // Optionally update global state
      setIsShareModal(false);
    }
  };

  // Navigation to post details (for comments)
  const postHeaderClick = () => {
    navigation.navigate('PostDetail', { postId: post._id });
  };

  // Post option menu logic
  const postOptionClick = () => setIsPostOption(!isPostOption);

  // Handle post deletion
  const handleDeletePost = async () => {
    try {
      const res = await api.post(`/post/delete`, { postId: post._id, authorId: post.author._id });
      if (res.status === 200) {
        // Close the modals
        setIsPostOption(false);
        setShowDeleteConfirmation(false);
        // Notify parent component that post was deleted
        if (onPostDeleted) {
          onPostDeleted(post._id);
        }
        console.log('Post deleted successfully');
        // Optionally show success message or trigger refresh
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      // Optionally show error message
    }
  };

  // Show delete confirmation
  const showDeleteConfirm = () => {
    setIsPostOption(false);
    setShowDeleteConfirmation(true);
  };

  const handleHidePost = () => {
    if (isAuth) {
      showDeleteConfirm();
      return;
    }
    if (onPostDeleted) {
      onPostDeleted(post._id);
    }
  };

  const openSinglePost = () => {
    navigation.navigate('SinglePost', { postId: post._id });
  };

  // Handle comment button tap
  const handleCommentPress = () => {
    commentInputRef.current?.focus();
  };

  const handlePostImageLoad = (event: any) => {
    const source = event?.nativeEvent?.source;
    const width = source?.width;
    const height = source?.height;
    if (!width || !height) return;
    const scaled = (SCREEN_WIDTH / width) * height;
    setImageHeight(Math.min(POST_IMAGE_MAX_HEIGHT, Math.max(180, scaled)));
  };

  // Handle posting a comment
  const handlePostComment = async () => {
    if (!commentText.trim() || isPostingComment) return;
    setIsPostingComment(true);
    try {
      const res = await api.post('/comment/addComment', {
        body: commentText,
        post: post._id,
        // attachment: '', // Add support for image/file attachment if needed
      });
      if (res.status === 200 && res.data) {
        console.log('Comment response data:', res.data);
        // Ensure the comment has proper author information
        const newComment = {
          ...res.data,
          author: {
            fullName: myProfile?.fullName || 'You',
            profilePic: myProfile?.profilePic || default_pp_src,
            _id: myProfile?._id
          },
          text: res.data.text || res.data.body || commentText,
          createdAt: res.data.createdAt || new Date().toISOString()
        };
        console.log('Processed comment:', newComment);
        setComments((prev) => [newComment, ...normalizeComments(prev)]);
        setTotalComments((count) => count + 1);
        setCommentText('');
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsPostingComment(false);
    }
  };

  // Handle reply button press
  const handleReplyPress = (comment: any) => {
    setReplyingTo(comment);
    setReplyText('');
  };

  // Handle posting a reply
  const handlePostReply = async () => {
    if (!replyText.trim() || !replyingTo || isPostingReply || !myProfileId) return;
    setIsPostingReply(true);
    try {
      const res = await api.post('/comment/addReply', {
        replyMsg: replyText.trim(),
        authorId: myProfileId,
        commentId: replyingTo._id,
      });
      if (res.status === 200 && res.data?._id) {
        const newReply = {
          ...res.data,
          author: res.data.author || {
            fullName: myProfile?.fullName || 'You',
            profilePic: myProfile?.profilePic || default_pp_src,
            _id: myProfileId,
          },
          text: res.data.text || res.data.body || replyText.trim(),
          createdAt: res.data.createdAt || new Date().toISOString(),
        };

        setComments((prev) => prev.map((comment) => {
          if (sameId(comment._id, replyingTo._id)) {
            const existing = Array.isArray(comment.replies) ? comment.replies : [];
            if (existing.some((reply: any) => sameId(reply?._id, newReply._id))) {
              return comment;
            }
            return {
              ...comment,
              replies: [...existing, newReply],
            };
          }
          return comment;
        }));

        setReplyText('');
        setReplyingTo(null);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsPostingReply(false);
    }
  };

  const handleDeleteComment = (comment: any) => {
    if (!comment?._id || deletingId) return;
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(comment._id);
          try {
            const res = await api.post('/comment/deleteComment', {
              commentId: comment._id,
              postId: post._id,
            });
            if (res.status === 200) {
              setComments((prev) => prev.filter((item) => !sameId(item._id, comment._id)));
              setTotalComments((count) => Math.max(0, count - 1));
              if (sameId(replyingTo?._id, comment._id)) {
                cancelReply();
              }
            }
          } catch (e) {
            console.log(e);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleDeleteReply = (commentId: string, reply: any) => {
    if (!reply?._id || deletingId) return;
    Alert.alert('Delete reply', 'Delete this reply?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(reply._id);
          try {
            const res = await api.post('/comment/deleteReply', { replyId: reply._id });
            if (res.status === 200) {
              setComments((prev) => prev.map((comment) => {
                if (!sameId(comment._id, commentId)) return comment;
                return {
                  ...comment,
                  replies: (comment.replies || []).filter((item: any) => !sameId(item?._id, reply._id)),
                };
              }));
            }
          } catch (e) {
            console.log(e);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const handleCommentLike = async (comment: any) => {
    if (!comment?._id || !myProfileId || likingCommentId) return;
    const already = commentHasMyReact(comment, myProfileId);
    setLikingCommentId(comment._id);
    try {
      const endpoint = already ? '/comment/removeReact' : '/comment/addReact';
      const res = await api.post(endpoint, { commentId: comment._id, reactorId: myProfileId });
      if (res.status === 200) {
        const nextReacts = Array.isArray(res.data?.reacts)
          ? res.data.reacts
          : already
            ? (comment.reacts || []).filter((r: any) => !sameId(r, myProfileId) && !sameId(r?._id, myProfileId))
            : [...(comment.reacts || []), myProfileId];
        setComments((prev) =>
          prev.map((item) => (sameId(item._id, comment._id) ? { ...item, reacts: nextReacts } : item)),
        );
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLikingCommentId(null);
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyText('');
  };

  const renderCommentThread = (c: any, isReply = false, parentId?: string) => {
    const body = c.text || c.body || c.content || c.message || '';
    const liked = commentHasMyReact(c, myProfileId);
    const reactCount = Array.isArray(c.reacts) ? c.reacts.length : 0;
    const replies = Array.isArray(c.replies) ? c.replies.filter(isPopulatedComment) : [];
    const isMine = sameId(c.author, myProfileId);
    const menuOpen = commentMenuId === c._id;
    const attachment = c.image || c.photo || c.attachment;
    const isReplyingHere = !isReply && sameId(replyingTo?._id, c._id);

    return (
      <View key={c._id || Math.random()} style={[styles.fbCommentRow, isReply && styles.fbReplyRow]}>
        <UserPP
          image={c.author?.profilePic || default_pp_src}
          isActive={false}
          size={isReply ? 28 : 32}
        />
        <View style={styles.fbCommentInfo}>
          <View style={styles.fbCommentBox}>
            <View style={[styles.fbNameComment, { backgroundColor: commentBubbleBg }]}>
              <Text style={[styles.fbAuthorName, { color: textColor }]}>{commentAuthorName(c)}</Text>
              {!!body.trim() && (
                <Text style={[styles.fbCommentText, { color: textColor }]}>{body}</Text>
              )}
            </View>
            {isMine ? (
              <View style={styles.fbOptionsWrap}>
                <TouchableOpacity
                  onPress={() => setCommentMenuId(menuOpen ? null : c._id)}
                  hitSlop={8}
                  style={styles.fbOptionsBtn}
                >
                  <FAIcon name="ellipsis-h" size={12} color={commentActionColor} />
                </TouchableOpacity>
                {menuOpen ? (
                  <View style={[styles.fbOptionsMenu, { backgroundColor: cardBg, borderColor }]}>
                    <TouchableOpacity
                      onPress={() => {
                        setCommentMenuId(null);
                        if (isReply && parentId) handleDeleteReply(parentId, c);
                        else handleDeleteComment(c);
                      }}
                      disabled={deletingId === c._id}
                    >
                      <Text style={[styles.fbOptionsDanger, { color: themeColors.status?.error || '#FF4444' }]}>
                        {deletingId === c._id ? 'Deleting...' : isReply ? 'Delete Reply' : 'Delete Comment'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
          {attachment ? (
            <Image
              source={{ uri: attachment }}
              style={styles.commentAttachment}
              onError={() => console.log('Failed to load comment attachment')}
            />
          ) : null}
          <View style={styles.fbCommentReact}>
            {!isReply ? (
              <TouchableOpacity onPress={() => handleCommentLike(c)} disabled={likingCommentId === c._id}>
                <Text style={[styles.fbReactLink, { color: liked ? accentColor : commentActionColor }, liked && { fontWeight: '700' }]}>
                  {likingCommentId === c._id ? '…' : `Like${reactCount > 0 ? ` · ${reactCount}` : ''}`}
                </Text>
              </TouchableOpacity>
            ) : null}
            {!isReply ? (
              <TouchableOpacity onPress={() => handleReplyPress(c)}>
                <Text style={[styles.fbReactLink, { color: commentActionColor }]}>Reply</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.fbCommentTime, { color: commentTimeColor }]}>
              {c.createdAt ? moment(c.createdAt).fromNow() : ''}
            </Text>
            {!isReply && replies.length > 0 ? (
              <Text style={[styles.fbReplyCount, { color: commentActionColor }]}>
                · {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </Text>
            ) : null}
          </View>
          {isReplyingHere ? (
            <View style={styles.fbNewReply}>
              <View style={styles.fbReplyingToRow}>
                <Text style={[styles.fbReplyingToLabel, { color: subTextColor }]}>
                  Replying to <Text style={{ fontWeight: '700', color: textColor }}>{commentAuthorName(c)}</Text>
                </Text>
                <TouchableOpacity onPress={cancelReply} hitSlop={8}>
                  <Icon name="close" size={14} color={subTextColor} />
                </TouchableOpacity>
              </View>
              <View style={[styles.fbCommentField, { backgroundColor: inputBg, borderColor }]}>
                <TextInput
                  style={[styles.fbFieldText, { color: inputText }, isPostingReply ? { opacity: 0.6 } : null]}
                  placeholder={isPostingReply ? 'Posting reply...' : `Reply to ${commentAuthorName(c)}`}
                  placeholderTextColor={subTextColor}
                  value={replyText}
                  onChangeText={setReplyText}
                  editable={!isPostingReply}
                  returnKeyType="send"
                  onSubmitEditing={handlePostReply}
                />
                <TouchableOpacity onPress={handlePostReply} disabled={isPostingReply} style={styles.fbFieldSend}>
                  {isPostingReply ? (
                    <ActivityIndicator size="small" color={accentColor} />
                  ) : (
                    <FAIcon name="paper-plane" size={14} color={accentColor} solid={false} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
          {!isReply && replies.length > 0 ? (
            <View style={[styles.fbRepliesThread, { borderLeftColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]}>
              {replies.map((reply: any) => renderCommentThread(reply, true, c._id))}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  // Render
  return (
    <View style={[styles.postContainer, { backgroundColor: cardBg, borderColor, shadowOpacity: feed.shadowOpacity }]}>
      <View style={styles.header}>
        {postType === 'profilePic' && (
          <View style={[styles.reasonRow, { borderBottomColor: feed.postDivider }]}>
            <View style={[styles.reasonBadge, { backgroundColor: feed.postAccentSoft }]}>
              <Icon name="photo-camera" size={12} color={accentColor} />
              <Text style={[styles.reasonBadgeText, { color: textColor }]}>Updated profile picture</Text>
            </View>
          </View>
        )}
        <View style={styles.authorInfo}>
          <TouchableOpacity
            onPress={() => {
              if (post.author?._id && post.author._id !== myProfileId) {
                (navigation as any).navigate('FriendProfile', { friendId: post.author._id });
              }
            }}
          >
            <UserPP image={post.author?.profilePic || default_pp_src} isActive={post.author?.isActive} size={40} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <TouchableOpacity
              onPress={() => {
                if (post.author?._id && post.author._id !== myProfileId) {
                  (navigation as any).navigate('FriendProfile', { friendId: post.author._id });
                }
              }}
              style={styles.authorNameRow}
            >
              <Text style={[styles.authorName, { color: textColor }]} numberOfLines={2}>
                {post.author?.fullName || 'Unknown User'}
              </Text>
              {post.author?.isOfficial ? (
                <View style={[styles.officialBadge, { backgroundColor: feed.postAccentSoft }]}>
                  <Icon name="check" size={9} color="#7ce7ff" />
                </View>
              ) : null}
              {post.feelings ? (
                <Text style={[styles.feelingsLabel, { color: subTextColor }]}>
                  {' '}is feeling <Text style={[styles.feelingsValue, { color: textColor }]}>{post.feelings}</Text>
                </Text>
              ) : null}
              {post.location ? (
                <Text style={[styles.feelingsLabel, { color: subTextColor }]}>
                  {' '}at <Text style={[styles.feelingsValue, { color: textColor }]}>{post.location}</Text>
                </Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={openSinglePost} style={styles.timeContainer}>
              <Text style={[styles.time, { color: subTextColor }]}>
                {post.createdAt ? moment(post.createdAt).fromNow() : 'Unknown time'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={postOptionClick} style={styles.headerIconBtn} hitSlop={8}>
              <Icon name="more-horiz" size={22} color={subTextColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleHidePost} style={styles.headerIconBtn} hitSlop={8}>
              <Icon name="close" size={20} color={subTextColor} />
            </TouchableOpacity>
          </View>
        </View>
        <Modal visible={isPostOption} transparent animationType="slide">
          <TouchableOpacity
            style={styles.modalOverlay}
            onPress={() => setIsPostOption(false)}
            activeOpacity={1}
          >
            <View style={[styles.optionMenu, { backgroundColor: cardBg, borderColor }]}>
              <View style={styles.optionMenuHeader}>
                <View style={[styles.optionMenuHandle, { backgroundColor: borderColor }]} />
              </View>

              {post.author?._id === myProfileId && (
                <>
                  <TouchableOpacity
                    style={[styles.optionMenuItem, { borderBottomColor: borderColor }]}
                    onPress={() => {
                      setIsPostOption(false);
                    }}
                  >
                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.primary + '15' }]}>
                      <Icon name="edit" size={20} color={themeColors.primary} />
                    </View>
                    <View style={styles.optionMenuContent}>
                      <Text style={[styles.optionMenuTitle, { color: textColor }]}>Edit Post</Text>
                      <Text style={[styles.optionMenuSubtitle, { color: subTextColor }]}>Make changes to your post</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={subTextColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionMenuItem, { borderBottomColor: borderColor }]}
                    onPress={() => {
                      setIsPostOption(false);
                    }}
                  >
                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.primary + '15' }]}>
                      <Icon name="people" size={20} color={themeColors.primary} />
                    </View>
                    <View style={styles.optionMenuContent}>
                      <Text style={[styles.optionMenuTitle, { color: textColor }]}>Edit Audience</Text>
                      <Text style={[styles.optionMenuSubtitle, { color: subTextColor }]}>Change who can see this post</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={subTextColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionMenuItem, styles.optionMenuItemDanger]}
                    onPress={showDeleteConfirm}
                  >
                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.status.error + '15' }]}>
                      <Icon name="delete" size={20} color={themeColors.status.error} />
                    </View>
                    <View style={styles.optionMenuContent}>
                      <Text style={[styles.optionMenuTitle, { color: themeColors.status.error }]}>Delete Post</Text>
                      <Text style={[styles.optionMenuSubtitle, { color: themeColors.status.error + '80' }]}>Remove this post permanently</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={themeColors.status.error} />
                  </TouchableOpacity>
                </>
              )}

              {post.author?._id !== myProfileId && (
                <>
                  <TouchableOpacity
                    style={[styles.optionMenuItem, { borderBottomColor: borderColor }]}
                    onPress={() => {
                      setIsPostOption(false);
                    }}
                  >
                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.primary + '15' }]}>
                      <Icon name="bookmark" size={20} color={themeColors.primary} />
                    </View>
                    <View style={styles.optionMenuContent}>
                      <Text style={[styles.optionMenuTitle, { color: textColor }]}>Save Post</Text>
                      <Text style={[styles.optionMenuSubtitle, { color: subTextColor }]}>Add this to your saved items</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={subTextColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionMenuItem, { borderBottomColor: borderColor }]}
                    onPress={() => {
                      setIsPostOption(false);
                    }}
                  >
                    <View style={[styles.optionMenuIcon, { backgroundColor: '#FFA50015' }]}>
                      <Icon name="visibility-off" size={20} color="#FFA500" />
                    </View>
                    <View style={styles.optionMenuContent}>
                      <Text style={[styles.optionMenuTitle, { color: textColor }]}>Hide Post</Text>
                      <Text style={[styles.optionMenuSubtitle, { color: subTextColor }]}>See fewer posts like this</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={subTextColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.optionMenuItem, styles.optionMenuItemDanger]}
                    onPress={() => {
                      setIsPostOption(false);
                    }}
                  >
                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.status.error + '15' }]}>
                      <Icon name="flag" size={20} color={themeColors.status.error} />
                    </View>
                    <View style={styles.optionMenuContent}>
                      <Text style={[styles.optionMenuTitle, { color: themeColors.status.error }]}>Report Post</Text>
                      <Text style={[styles.optionMenuSubtitle, { color: themeColors.status.error + '80' }]}>Report inappropriate content</Text>
                    </View>
                    <Icon name="chevron-right" size={20} color={themeColors.status.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={showDeleteConfirmation} transparent animationType="fade">
          <TouchableOpacity
            style={[styles.modalOverlay, { justifyContent: 'center' }]}
            onPress={() => setShowDeleteConfirmation(false)}
            activeOpacity={1}
          >
            <View style={[styles.deleteConfirmModal, { backgroundColor: cardBg, borderColor }]}>
              <View style={styles.deleteConfirmHeader}>
                <View style={[styles.deleteConfirmIcon, { backgroundColor: themeColors.status.error + '15' }]}>
                  <Icon name="delete" size={28} color={themeColors.status.error} />
                </View>
                <Text style={[styles.deleteConfirmTitle, { color: textColor }]}>Delete Post</Text>
                <Text style={[styles.deleteConfirmMessage, { color: subTextColor }]}>
                  Are you sure you want to delete this post? This action cannot be undone and the post will be permanently removed.
                </Text>
              </View>

              <View style={styles.deleteConfirmButtons}>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, styles.cancelBtn, { borderColor }]}
                  onPress={() => setShowDeleteConfirmation(false)}
                >
                  <Text style={[styles.deleteConfirmBtnText, { color: textColor }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.deleteConfirmBtn, styles.deleteBtn]}
                  onPress={handleDeletePost}
                >
                  <Icon name="delete" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={[styles.deleteConfirmBtnText, { color: '#fff' }]}>Delete Post</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      <View style={styles.body}>
        {post.caption ? (
          <TouchableOpacity onPress={openSinglePost} activeOpacity={0.85}>
            <Text style={[styles.caption, { color: textColor }]}>{post.caption}</Text>
          </TouchableOpacity>
        ) : null}

        {isValidImageUrl(post.photos) && !imageLoadError && (
          <TouchableOpacity
            onPress={openSinglePost}
            activeOpacity={0.92}
            style={[
              styles.attachmentContainer,
              { backgroundColor: feed.mediaBg },
              postType === 'profilePic' && styles.attachmentProfilePic,
            ]}
          >
            <Image
              source={{ uri: getAssetUrl(typeof post.photos === 'string' ? post.photos : post.photos[0]) }}
              style={postType === 'profilePic' ? [styles.postProfilePic, { borderColor: feed.postBorder }] : [styles.postImage, { height: imageHeight, backgroundColor: feed.mediaBg }]}
              resizeMode="cover"
              onError={() => {
                setImageLoadError(true);
              }}
              onLoad={handlePostImageLoad}
              onLoadStart={() => setImageLoadError(false)}
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.footer}>
        {showReactions ? (
          <Pressable style={styles.reactDismiss} onPress={handleOutsidePress} />
        ) : null}
        <View style={[styles.countsRow, { borderBottomColor: feed.postDivider }]}>
          <TouchableOpacity style={styles.reactsCountLeft} onPress={openSinglePost} activeOpacity={0.7}>
            <PlacedReactIcons placedReacts={placedReacts} />
            <Text style={[styles.countText, { color: subTextColor }]}>
              {post.reacts ? totalReacts : ''} {totalReacts > 1 ? 'Reacts' : 'React'}
            </Text>
          </TouchableOpacity>
          <View style={styles.countsRight}>
            <TouchableOpacity style={styles.countItem} onPress={openSinglePost} activeOpacity={0.7}>
              <Text style={[styles.countText, { color: subTextColor }]}>{post.comments ? totalComments : ''}</Text>
              <FAIcon name="comment" size={13} color={subTextColor} solid={false} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.countItem} onPress={openSinglePost} activeOpacity={0.7}>
              <Text style={[styles.countText, { color: subTextColor }]}>{post.shares ? totalShares : ''}</Text>
              <FAIcon name="share" size={13} color={subTextColor} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={[styles.actionBar, { borderBottomColor: feed.postDivider }]}>
          <View style={styles.reactButtonsWrap}>
            <TouchableOpacity
              onPress={handleLikePress}
              onLongPress={handleLikeLongPress}
              delayLongPress={450}
              style={[
                styles.actionButton,
                styles.actionBarItemFill,
                reactType ? { backgroundColor: feed.postHover } : null,
              ]}
            >
              <View style={styles.reactLikeInner}>
                <View style={styles.reactIconSlot}>
                  <CurrentReactIcon reactType={reactType} size={18} />
                </View>
                {SHOW_ACTION_LABELS ? (
                  <Text style={[styles.actionLabel, { color: reactType ? accentColor : subTextColor }]}>
                    {getReactLabel(reactType)}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
            {showReactions ? (
              <View style={styles.reactionPopupWrapper} pointerEvents="box-none">
                <ReactPicker
                  reactType={reactType}
                  onSelect={handleSelectReaction}
                  backgroundColor={cardBg}
                  borderColor={borderColor}
                />
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={handleCommentPress} style={[styles.actionButton, styles.actionBarItem]}>
            <FAIcon name="comment" size={16} color={subTextColor} solid={false} />
            {SHOW_ACTION_LABELS ? (
              <Text style={[styles.actionLabel, { color: subTextColor }]}>Comment</Text>
            ) : null}
          </TouchableOpacity>
          {!isAuth ? (
            <TouchableOpacity onPress={() => setIsShareModal(true)} style={[styles.actionButton, styles.actionBarItem]}>
              <FAIcon name="share" size={16} color={subTextColor} solid={false} />
              {SHOW_ACTION_LABELS ? (
                <Text style={[styles.actionLabel, { color: subTextColor }]}>Share</Text>
              ) : null}
            </TouchableOpacity>
          ) : (
            <View style={[styles.actionBarItem, { width: '33%' }]} />
          )}
        </View>
        <View style={styles.commentsList}>
          {loadingComments ? (
            <Text style={[styles.noCommentsText, { color: subTextColor }]}>Loading comments…</Text>
          ) : comments.length === 0 ? (
            <Text style={[styles.noCommentsText, { color: subTextColor }]}>No comments yet</Text>
          ) : (
            comments.map((c) => renderCommentThread(c))
          )}
          {totalComments > 3 ? (
            <TouchableOpacity onPress={openSinglePost} style={styles.moreCommentsBtn}>
              <Text style={[styles.moreCommentsText, { color: accentColor }]}>View more comments</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.commentBoxContainer}>
          <View style={styles.commentInputRow}>
            <UserPP image={myProfile?.profilePic || default_pp_src} isActive={false} size={34} />
            <View style={[styles.fbCommentField, styles.fbComposerField, { backgroundColor: inputBg, borderColor }]}>
              <TextInput
                ref={commentInputRef}
                style={[styles.fbFieldText, { color: inputText }, isPostingComment ? { opacity: 0.6 } : null]}
                placeholder={isPostingComment ? 'Posting comment...' : 'Write a public comment…'}
                placeholderTextColor={subTextColor}
                value={commentText}
                onChangeText={setCommentText}
                editable={!isPostingComment}
                returnKeyType="send"
                onSubmitEditing={handlePostComment}
              />
              <TouchableOpacity
                style={styles.fbFieldSend}
                onPress={handlePostComment}
                disabled={isPostingComment}
              >
                {isPostingComment ? (
                  <ActivityIndicator size="small" color={accentColor} />
                ) : (
                  <FAIcon name="paper-plane" size={15} color={accentColor} solid={false} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      <Modal visible={isShareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.shareModal, { backgroundColor: cardBg }]}>
            <Text style={{ color: textColor }}>Share Post</Text>
            <TextInput
              style={[styles.shareInput, { backgroundColor: inputBg, color: inputText, borderColor }]}
              placeholder="What's on your mind?"
              placeholderTextColor={subTextColor}
              value={shareCap}
              onChangeText={setShareCap}
            />
            <TouchableOpacity onPress={onClickShareNow}>
              <Text style={{ color: themeColors.primary }}>Share Now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsShareModal(false)}>
              <Text style={{ color: subTextColor }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  postContainer: {
    marginHorizontal: 0,
    marginBottom: 10,
    borderRadius: 12,
    padding: 0,
    borderWidth: 1,
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    paddingTop: 10,
    paddingHorizontal: 5,
    paddingBottom: 10,
  },
  reasonRow: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  reasonBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  reasonBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  profilePic: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
    minWidth: 0,
  },
  authorNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  authorName: {
    fontWeight: '600',
    fontSize: 14.4,
    lineHeight: 19,
  },
  officialBadge: {
    marginLeft: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feelingsLabel: {
    fontSize: 13,
    fontWeight: '400',
  },
  feelingsValue: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  metaInline: {
    fontWeight: '400',
  },
  time: {
    fontSize: 12,
  },
  timeContainer: {
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingTop: 0,
  },
  caption: {
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 12,
    fontSize: 15,
    lineHeight: 21.5,
  },
  attachmentContainer: {
    width: '100%',
  },
  attachmentProfilePic: {
    backgroundColor: 'transparent',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
  postImage: {
    width: '100%',
    maxHeight: POST_IMAGE_MAX_HEIGHT,
  },
  postProfilePic: {
    width: Math.min(280, SCREEN_WIDTH - 24),
    height: Math.min(280, SCREEN_WIDTH - 24),
    maxWidth: '100%',
    borderRadius: Math.min(140, (SCREEN_WIDTH - 24) / 2),
    borderWidth: 2,
    borderColor: 'transparent',
    marginVertical: 4,
  },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    overflow: 'visible',
    position: 'relative',
  },

  reactText: {
    fontWeight: 'bold',
    color: '#007bff',
  },
  selectedReact: {
    fontWeight: 'bold',
    color: '#ff0000', // Example color for selected reaction
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    gap: 5
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    overflow: 'visible',
    gap: 4,
  },
  actionBarItem: {
    flex: 1,
    width: '33%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  reactButtonsWrap: {
    flex: 1,
    width: '33%',
    position: 'relative',
    zIndex: 20,
    overflow: 'visible',
  },
  actionBarItemFill: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  reactLikeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactIconSlot: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactDismiss: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionMenu: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 0,
    width: '100%',
    maxHeight: '70%',
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  optionMenuHeader: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 20,
  },
  optionMenuHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    borderColor: '#F1F3F4',
  },
  optionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F3F4',
    backgroundColor: 'transparent',
  },
  optionMenuItemDanger: {
    borderBottomWidth: 0,
  },
  optionMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionMenuContent: {
    flex: 1,
    justifyContent: 'center',
  },
  optionMenuTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 2,
  },
  optionMenuSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
    opacity: 0.8,
  },
  shareModal: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  shareInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    marginVertical: 10,
    padding: 8,
  },
  reactionPopup: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 8,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#F1F3F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  reactionOverlayModal: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 60,
  },
  reactionPopupWrapper: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    zIndex: 40,
    marginBottom: 4,
  },
  reactionCaret: {
    width: 16,
    height: 16,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
    marginTop: -8,
    backgroundColor: '#FFFFFF',
    borderColor: '#F1F3F4',
  },
  reactionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    minHeight: 40,
  },
  countsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactsCountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  countText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reactionIconsStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionSmallIcon: {
    fontSize: 16,
  },
  commentBoxContainer: {
    paddingTop: 10,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentInput: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    fontSize: 14.5,
    borderWidth: 1,
  },
  commentPostBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentPostBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  commentProfilePic: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 1,
  },
  commentBody: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F3F4',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  commentTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  noCommentsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  actionLabel: {
    fontSize: SHOW_ACTION_LABELS ? 14.4 : 13.1,
    fontWeight: '600',
    marginLeft: 5,
  },
  actionEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    minHeight: 36,
  },
  reactionIcon: {
    width: 28,
    height: 28,
    marginHorizontal: 0,
    resizeMode: 'contain',
  },
  likeEmoji: {
    fontSize: 22,
    marginRight: 4,
  },
  commentAttachment: {
    width: 120,
    height: 120,
    borderRadius: 8,
    marginTop: 6,
    backgroundColor: '#eee',
  },
  // Delete confirmation modal styles
  deleteConfirmModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '85%',
    maxWidth: 380,
    paddingBottom: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  deleteConfirmHeader: {
    alignItems: 'center',
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  deleteConfirmIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deleteConfirmTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  deleteConfirmMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    opacity: 0.8,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
  },
  deleteConfirmBtn: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#F1F3F4',
  },
  deleteBtn: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF4444',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteConfirmBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Comment reply styles
  commentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  commentMeta: {
    flex: 1,
  },
  commentActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  replyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  repliesContainer: {
    marginLeft: 48,
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(41, 177, 169, 0.2)',
  },
  replyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingLeft: 12,
  },
  replyProfilePic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
    borderWidth: 1,
  },
  replyBody: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  replyAuthor: {
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 4,
  },
  replyText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  replyTime: {
    fontSize: 11,
    fontWeight: '500',
  },
  replyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Reply input styles
  replyInputContainer: {
    borderTopWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  replyInputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  replyingToText: {
    fontSize: 13,
    fontWeight: '500',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  cancelReplyBtn: {
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  replyPostBtn: {
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  replyPostBtnText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  inlineStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  inlineStatusText: {
    fontSize: 12,
  },
  viewPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 8,
    gap: 8,
  },
  viewPostButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentsList: {
    paddingVertical: 8,
  },
  moreCommentsBtn: {
    marginLeft: 40,
    paddingVertical: 6,
  },
  moreCommentsText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fbCommentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  fbReplyRow: {
    marginBottom: 8,
  },
  fbCommentInfo: {
    flex: 1,
    minWidth: 0,
  },
  fbCommentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    maxWidth: '100%',
  },
  fbNameComment: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    maxWidth: '100%',
  },
  fbAuthorName: {
    fontWeight: '600',
    fontSize: 13,
    marginBottom: 2,
    lineHeight: 17,
  },
  fbCommentText: {
    fontSize: 15,
    lineHeight: 20,
  },
  fbOptionsWrap: {
    marginLeft: 4,
    position: 'relative',
  },
  fbOptionsBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbOptionsMenu: {
    position: 'absolute',
    top: 24,
    right: 0,
    zIndex: 8,
    minWidth: 150,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  fbOptionsDanger: {
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 6,
  },
  fbCommentReact: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  fbReactLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  fbCommentTime: {
    fontSize: 11,
    fontWeight: '400',
  },
  fbReplyCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  fbRepliesThread: {
    marginTop: 8,
    paddingLeft: 10,
    borderLeftWidth: 2,
    gap: 8,
  },
  fbNewReply: {
    marginTop: 8,
  },
  fbReplyingToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  fbReplyingToLabel: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  fbCommentField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    borderRadius: 22,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
  },
  fbComposerField: {
    flex: 1,
  },
  fbFieldText: {
    flex: 1,
    fontSize: 14.5,
    minHeight: 38,
    paddingVertical: 8,
  },
  fbFieldSend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(Post);