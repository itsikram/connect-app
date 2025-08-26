import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
// import socket from '../../common/socket'; // Use socket.io-client for React Native
import api from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import UserPP from './UserPP';
// import UserPP from '../UserPP'; // You need to create a React Native version of this
// import PostComment from './PostComment'; // You need to create a React Native version of this

type RootStackParamList = {
  PostDetail: { postId: string };
};

const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';

interface PostProps {
  data: any;
}

const Post: React.FC<PostProps> = ({ data }) => {
  const post = data || {};
  const myProfile = useSelector((state: any) => state.profile);
  const myProfileId = myProfile?._id;
  const [totalReacts, setTotalReacts] = useState<number>(post.reacts?.length || 0);
  const [totalShares, setTotalShares] = useState<number>(post.shares?.length || 0);
  const [totalComments] = useState<number>(post.comments?.length || 0);
  const [reactType, setReactType] = useState<string | false>(false);
  const [isReacted, setIsReacted] = useState<boolean>(false);
  const [shareCap, setShareCap] = useState<string>('');
  const [placedReacts, setPlacedReacts] = useState<string[]>([]);
  const [isShareModal, setIsShareModal] = useState<boolean>(false);
  const [isPostOption, setIsPostOption] = useState<boolean>(false);
  const [showReactions, setShowReactions] = useState<boolean>(false);
  const [showCommentBox, setShowCommentBox] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [comments, setComments] = useState<any[]>(post.comments || []);
  const [type, setType] = useState<string>(post.type || 'post');

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors: themeColors, isDarkMode } = useTheme();
  const cardBg = themeColors.surface.primary;

  // Theme colors
  const textColor = themeColors.text.primary;
  const subTextColor = themeColors.text.secondary;
  const borderColor = themeColors.border.primary;
  const inputBg = themeColors.surface.secondary;
  const inputText = themeColors.text.primary;

  const reactionEmojiMap: Record<string, string> = {
    like: '👍',
    love: '❤️',
    haha: '😂',
    sad: '😢',
  };

  const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

  // Safety check for required post data
  if (!post._id || !post.author) {
    console.warn('Post component received invalid data:', post);
    return (
      <View style={[styles.postContainer, { backgroundColor: cardBg, borderColor }]}>
        <Text style={[styles.caption, { color: textColor }]}>
          Invalid post data
        </Text>
      </View>
    );
  }

  // ... socket logic can be added here if needed

  useEffect(() => {
    // Set placed reacts and isReacted
    let storedReacts: string[] = [];
    if (post.reacts && Array.isArray(post.reacts)) {
      post.reacts.forEach((react: any) => {
        if (react.profile) {
          if (!storedReacts.includes(react.type)) {
            storedReacts.push(react.type);
          }
          if (react.profile === myProfileId) {
            setReactType(react.type);
            setIsReacted(true);
          }
        }
      });
    }
    setPlacedReacts(storedReacts);
  }, [post.reacts, myProfileId]);

  // Like, Love, Haha, Sad, Remove React, Place React logic
  const removeReact = async () => {
    setTotalReacts(state => state - 1);
    setReactType(false);
    let res = await api.post('/react/removeReact', { id: post._id, postType: 'post', reactor: myProfileId });
    if (res.status === 200) {
      setIsReacted(false);
      return true;
    } else {
      setTotalReacts(state => state + 1);
    }
  };

  const placeReact = async (type: string) => {
    if (!isReacted) setTotalReacts(state => state + 1);
    setPlacedReacts([...placedReacts, type]);
    setReactType(type);
    let res = await api.post('/react/addReact', { id: post._id, postType: 'post', reactType: type });
    if (res.status === 200) {
      setIsReacted(true);
      return true;
    } else {
      setTotalReacts(post.reacts.length);
      setPlacedReacts([...placedReacts]);
      setReactType(false);
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

  // Handle comment button tap
  const handleCommentPress = () => {
    setShowCommentBox((prev) => !prev);
  };

  // Handle posting a comment
  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      const res = await api.post('/comment/addComment', {
        body: commentText,
        post: post._id,
        // attachment: '', // Add support for image/file attachment if needed
      });
      if (res.status === 200 && res.data) {
        setComments((prev) => [res.data, ...prev]);
        setCommentText('');
      }
    } catch (e) {
      console.log(e);
    }
  };

  // Render
  return (
    <View style={[styles.postContainer, { backgroundColor: cardBg, borderColor }]}> {/* Main card */}
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={postHeaderClick}>
          <UserPP image={post.author?.profilePic || default_pp_src} isActive={post.author?.isActive} size={40} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.authorName, { color: textColor }]}>
            {post.author?.fullName || 'Unknown User'}
            {post.feelings ? (
              <Text style={[styles.metaInline, { color: subTextColor }]}> is feeling {post.feelings}</Text>
            ) : null}
            {post.location ? (
              <Text style={[styles.metaInline, { color: subTextColor }]}>
                {post.feelings ? ' · ' : ' '}
                at {post.location}
              </Text>
            ) : null}
          </Text>
          <Text style={[styles.time, { color: subTextColor }]}>
            {post.createdAt ? moment(post.createdAt).fromNow() : 'Unknown time'}
          </Text>
        </View>
        <TouchableOpacity onPress={postOptionClick}>
          <Icon name="more-vert" size={24} color={subTextColor} />
        </TouchableOpacity>
        {/* Post option modal */}
        <Modal visible={isPostOption} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsPostOption(false)}>
            <View style={[styles.optionMenu, { backgroundColor: cardBg }]}> {/* Modal menu */}
              <TouchableOpacity>
                <Text style={{ color: textColor }}>Edit Post</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={{ color: textColor }}>Edit Audience</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text style={{ color: textColor }}>Report This Post</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      {/* Body */}
      <View style={styles.body}>
        <Text style={[styles.caption, { color: textColor }]}>{post.caption || 'No caption'}</Text>

        <View style={styles.attachmentContainer}>

          {post.photos && post.type === 'post' && (
            <Image
              source={{ uri: post.photos }}
              style={styles.postImage}
              onError={() => console.log('Failed to load post image')}
            />
          )}
          {post.photos && post.type === 'profilePic' && (
            <Image
              source={{ uri: post.photos }}
              style={styles.postProfilePic}
              onError={() => console.log('Failed to load profile picture')}
            />
          )}
        </View>

      </View>
      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.reactsRow}>
          <View style={styles.countsRow}>
            <View style={styles.reactsCountLeft}>
              <View style={styles.reactionIconsStack}>
                {placedReacts.slice(0, 3).map((t, idx) => (
                  <Text key={t} style={[styles.reactionSmallIcon, idx > 0 ? { marginLeft: -6 } : null]}>
                    {reactionEmojiMap[t] || '👍'}
                  </Text>
                ))}
              </View>
              <Text style={[styles.countText, { color: subTextColor }]}>{totalReacts} Reacts</Text>
            </View>
            <Text style={[styles.countText, { color: subTextColor }]}>{totalComments} Comments</Text>
            <Text style={[styles.countText, { color: subTextColor }]}>{totalShares} Shares</Text>
          </View>
        </View>
        <View style={styles.actionsRow}>
          {/* Like button with long press for reactions */}
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <TouchableOpacity
              onPress={handleLikePress}
              onLongPress={handleLikeLongPress}
              delayLongPress={200}
              style={styles.actionButton}
            >
              {reactType ? (
                <>
                  <Text style={styles.likeEmoji}>{reactionEmojiMap[reactType] || '👍'}</Text>
                  <Text style={[styles.actionLabel, { color: textColor }]}> {capitalize(reactType)}</Text>
                </>
              ) : (
                <>
                  <Icon name="thumb-up" size={28} color={themeColors.primary} />
                  <Text style={[styles.actionLabel, { color: textColor }]}> Like</Text>
                </>
              )}
            </TouchableOpacity>
            {showReactions && (
              <View style={[styles.reactionPopup, { backgroundColor: cardBg, borderColor }]}> {/* Reaction popup */}
                <TouchableOpacity onPress={() => handleSelectReaction('like')}>
                  <Text style={[reactType === 'like' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSelectReaction('love')}>
                  <Text style={[reactType === 'love' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>❤️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSelectReaction('haha')}>
                  <Text style={[reactType === 'haha' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>😂</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSelectReaction('sad')}>
                  <Text style={[reactType === 'sad' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>😢</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {/* Comment button toggles comment box */}
          <TouchableOpacity onPress={handleCommentPress} style={styles.actionButton}>
            <Icon name="comment" size={28} color={themeColors.primary} />
            <Text style={[styles.actionLabel, { color: textColor }]}> Comment</Text>
          </TouchableOpacity>
          {/* Share button opens share modal */}
          <TouchableOpacity onPress={() => setIsShareModal(true)} style={styles.actionButton}>
            <Icon name="share" size={28} color={themeColors.primary} />
            <Text style={[styles.actionLabel, { color: textColor }]}> Share</Text>
          </TouchableOpacity>
        </View>
        {/* Comment Box and Comments List */}
        {showCommentBox && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.commentBoxContainer, { backgroundColor: cardBg, borderTopColor: borderColor }]}
          >
            <View style={styles.commentInputRow}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: inputBg, color: inputText, borderColor }]}
                placeholder="Write a comment..."
                placeholderTextColor={isDarkMode ? subTextColor : subTextColor}
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity style={styles.commentPostBtn} onPress={handlePostComment}>
                <Text style={styles.commentPostBtnText}>Post</Text>
              </TouchableOpacity>
            </View>
            {/* Comments List */}
            <View style={styles.commentsList}>
              {comments.length === 0 ? (
                <Text style={[styles.noCommentsText, { color: subTextColor }]}>No comments yet.</Text>
              ) : (
                comments.map((c) => (
                  <View key={c._id || Math.random()} style={styles.commentItem}>
                    <Image
                      source={{ uri: c.author?.profilePic || default_pp_src }}
                      style={styles.commentProfilePic}
                      onError={() => console.log('Failed to load comment profile picture')}
                    />
                    <View style={[styles.commentBody, { backgroundColor: inputBg, borderColor }]}> {/* Comment body */}
                      <Text style={[styles.commentAuthor, { color: textColor }]}>
                        {c.author?.fullName ||
                          (c.author?.user
                            ? (
                              <Text>
                                {c.author.user.firstName || ''} {c.author.user.surname || ''}
                              </Text>
                            )
                            : (
                              <Text>Unknown</Text>
                            )
                          )}
                      </Text>
                      <Text style={[styles.commentText, { color: textColor }]}>
                        {c.text || c.body || 'No comment text'}
                      </Text>
                      {c.image || c.photo || c.attachment ? (
                        <Image
                          source={{ uri: c.image || c.photo || c.attachment }}
                          style={styles.commentAttachment}
                          onError={() => console.log('Failed to load comment attachment')}
                        />
                      ) : null}
                      <Text style={[styles.commentTime, { color: subTextColor }]}>
                        {c.createdAt ? moment(c.createdAt).fromNow() : 'Unknown time'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
      {/* Share Modal */}
      <Modal visible={isShareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.shareModal, { backgroundColor: cardBg }]}> {/* Share modal */}
            <Text style={{ color: textColor }}>Share Post</Text>
            <TextInput
              style={[styles.shareInput, { backgroundColor: inputBg, color: inputText, borderColor }]}
              placeholder="What's on your mind?"
              placeholderTextColor={isDarkMode ? subTextColor : subTextColor}
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
      {/* Comments */}
      {/* <PostComment ... /> */}
    </View>
  );
};

const styles = StyleSheet.create({
  postContainer: {
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 10,
    padding: 10,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 10,
  },
  authorName: {
    fontWeight: 'bold',
  },
  metaInline: {
    fontWeight: '400',
  },
  time: {
    color: '#888',
    fontSize: 12,
  },
  body: {
    marginTop: 10,
  },
  caption: {
    marginBottom: 10,
  },
  attachmentContainer: {
    marginTop: 10,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#eee',
    resizeMode: 'contain',
    alignSelf: 'center',
  },
  postProfilePic: {
    width: 250,
    height: 250,
    borderRadius: 175,
    borderWidth: 2,
    borderColor: '#eee',
    marginVertical: 10,
  },
  footer: {
    marginTop: 10,
  },
  reactsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionMenu: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
  },
  shareModal: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    width: '80%',
  },
  shareInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginVertical: 10,
    padding: 8,
  },
  reactionPopup: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 35,
    left: 0,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 8,
    elevation: 5,
    zIndex: 10,
  },
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    flex: 1,
    justifyContent: 'space-evenly',
  },
  reactsCountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    marginHorizontal: 6,
    color: '#555',
    fontSize: 13,
  },
  reactionIconsStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionSmallIcon: {
    fontSize: 16,
  },
  commentBoxContainer: {
    backgroundColor: '#f7f7f7',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 8,
  },
  commentInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
  },
  commentPostBtn: {
    backgroundColor: '#29b1a9', // Using the primary color directly
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  commentPostBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  commentsList: {
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  commentProfilePic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: '#eee',
  },
  commentBody: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  commentAuthor: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#222',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
    marginTop: 2,
  },
  commentTime: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  noCommentsText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 8,
  },
  actionLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reactionIcon: {
    fontSize: 32,
    marginHorizontal: 4,
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
});

export default Post;