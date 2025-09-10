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
  SinglePost: { postId: string };
  SingleVideo: { videoId: string };
  FriendProfile: { friendId: string };
};

const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';

interface PostProps {
  data: any;
  onPostDeleted?: (postId: string) => void;
}

const Post: React.FC<PostProps> = ({ data, onPostDeleted }) => {
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
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  const [showReactions, setShowReactions] = useState<boolean>(false);
  const [showCommentBox, setShowCommentBox] = useState<boolean>(false);
  const [commentText, setCommentText] = useState<string>('');
  const [comments, setComments] = useState<any[]>(post.comments || []);
  const [type, setType] = useState<string>(post.type || 'post');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [replyText, setReplyText] = useState<string>('');
  const [showReplyBox, setShowReplyBox] = useState<boolean>(false);

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
        setComments((prev) => [newComment, ...prev]);
        setCommentText('');
      }
    } catch (e) {
      console.log(e);
    }
  };

  // Handle reply button press
  const handleReplyPress = (comment: any) => {
    setReplyingTo(comment);
    setShowReplyBox(true);
    setReplyText('');
  };

  // Handle posting a reply
  const handlePostReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    try {
      const res = await api.post('/comment/addReply', {
        body: replyText,
        post: post._id,
        parentComment: replyingTo._id,
        // attachment: '', // Add support for image/file attachment if needed
      });
      if (res.status === 200 && res.data) {
        console.log('Reply response data:', res.data);
        // Ensure the reply has proper author information
        const newReply = {
          ...res.data,
          author: {
            fullName: myProfile?.fullName || 'You',
            profilePic: myProfile?.profilePic || default_pp_src,
            _id: myProfile?._id
          },
          text: res.data.text || res.data.body || replyText,
          createdAt: res.data.createdAt || new Date().toISOString(),
          isReply: true,
          parentCommentId: replyingTo._id
        };
        console.log('Processed reply:', newReply);
        
        // Add reply to the parent comment
        setComments((prev) => prev.map(comment => {
          if (comment._id === replyingTo._id) {
            return {
              ...comment,
              replies: [...(comment.replies || []), newReply]
            };
          }
          return comment;
        }));
        
        setReplyText('');
        setShowReplyBox(false);
        setReplyingTo(null);
      }
    } catch (e) {
      console.log(e);
    }
  };

  // Cancel reply
  const cancelReply = () => {
    setReplyingTo(null);
    setShowReplyBox(false);
    setReplyText('');
  };

  // Render
  return (
    <View style={[styles.postContainer, { backgroundColor: cardBg, borderColor }]}> 
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (post.author?._id && post.author._id !== myProfileId) {
            (navigation as any).navigate('FriendProfile', { friendId: post.author._id });
          }
        }}>
          <UserPP image={post.author?.profilePic || default_pp_src} isActive={post.author?.isActive} size={40} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <TouchableOpacity onPress={() => {
            if (post.author?._id && post.author._id !== myProfileId) {
              (navigation as any).navigate('FriendProfile', { friendId: post.author._id });
            }
          }}>
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
          </TouchableOpacity>
          <TouchableOpacity onPress={postHeaderClick} style={styles.timeContainer}>
            <Text style={[styles.time, { color: subTextColor }]}>
              {post.createdAt ? moment(post.createdAt).fromNow() : 'Unknown time'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={postOptionClick}>
          <Icon name="more-vert" size={24} color={subTextColor} />
        </TouchableOpacity>
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
        <Text style={[styles.caption, { color: textColor }]}>{post.caption || 'No caption'}</Text>
        
        {/* Navigation to SinglePost */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('SinglePost', { postId: post._id })}
          style={[styles.viewPostButton, { backgroundColor: themeColors.primary + '15', borderColor: themeColors.primary }]}
        >
          <Icon name="open-in-new" size={16} color={themeColors.primary} />
          <Text style={[styles.viewPostButtonText, { color: themeColors.primary }]}>
            View Full Post
          </Text>
        </TouchableOpacity>

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
      <View style={styles.footer}>
        <View style={[styles.countsRow, { borderTopColor: borderColor }]}>
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
          <View style={styles.countsRight}>
            <View style={styles.countItem}>
              <Icon name="chat-bubble-outline" size={16} color={subTextColor} />
              <Text style={[styles.countText, { color: subTextColor }]}>{totalComments}</Text>
            </View>
            <View style={styles.countItem}>
              <Icon name="share" size={16} color={subTextColor} />
              <Text style={[styles.countText, { color: subTextColor }]}>{totalShares}</Text>
            </View>
          </View>
        </View>
        <View style={[styles.actionBar, { backgroundColor: themeColors.surface.secondary, borderColor }]}>
          <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, position: 'relative' }}>
            <TouchableOpacity
              onPress={handleLikePress}
              onLongPress={handleLikeLongPress}
              delayLongPress={200}
              style={[styles.actionButton, styles.actionBarItem, isReacted ? { backgroundColor: themeColors.primary + '15' } : null]}
            >
              {reactType ? (
                <>
                  <Text style={styles.likeEmoji}>{reactionEmojiMap[reactType] || '👍'}</Text>
                  <Text style={[styles.actionLabel, { color: themeColors.primary }]}> {capitalize(reactType)}</Text>
                </>
              ) : (
                <>
                  <Icon name="thumb-up-off-alt" size={20} color={subTextColor} />
                  <Text style={[styles.actionLabel, { color: textColor }]}> Like</Text>
                </>
              )}
            </TouchableOpacity>
            {showReactions && (
              <View style={styles.reactionPopupWrapper} pointerEvents="box-none">
                <View style={[styles.reactionPopup, { backgroundColor: cardBg, borderColor }]}> 
                  <TouchableOpacity onPress={() => handleSelectReaction('like')} style={styles.reactionButton} activeOpacity={0.7}>
                    <Text style={[reactType === 'like' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>👍</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectReaction('love')} style={styles.reactionButton} activeOpacity={0.7}>
                    <Text style={[reactType === 'love' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>❤️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectReaction('haha')} style={styles.reactionButton} activeOpacity={0.7}>
                    <Text style={[reactType === 'haha' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>😂</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSelectReaction('sad')} style={styles.reactionButton} activeOpacity={0.7}>
                    <Text style={[reactType === 'sad' ? styles.selectedReact : styles.reactText, styles.reactionIcon]}>😢</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.reactionCaret, { backgroundColor: cardBg, borderColor }]} />
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleCommentPress} style={[styles.actionButton, styles.actionBarItem] }>
            <Icon name="comment" size={20} color={subTextColor} />
            <Text style={[styles.actionLabel, { color: textColor }]}> Comment</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsShareModal(true)} style={[styles.actionButton, styles.actionBarItem] }>
            <Icon name="share" size={20} color={subTextColor} />
            <Text style={[styles.actionLabel, { color: textColor }]}> Share</Text>
          </TouchableOpacity>
        </View>
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
                     <View style={[styles.commentBody, { backgroundColor: inputBg, borderColor }]}> 
                       <Text style={[styles.commentAuthor, { color: textColor }]}>
                         {c.author?.fullName || 
                          c.author?.firstName || 
                          c.author?.name ||
                          (c.author?.user
                            ? (
                              <Text>
                                {c.author.user.firstName || ''} {c.author.user.surname || ''}
                              </Text>
                            )
                            : 'Unknown User'
                          )}
                       </Text>
                       <Text style={[styles.commentText, { color: textColor }]}>
                         {c.text || c.body || c.content || c.message || 'No comment text'}
                       </Text>
                       {c.image || c.photo || c.attachment ? (
                         <Image
                           source={{ uri: c.image || c.photo || c.attachment }}
                           style={styles.commentAttachment}
                           onError={() => console.log('Failed to load comment attachment')}
                         />
                       ) : null}
                                               <View style={styles.commentActions}>
                          <View style={styles.commentMeta}>
                            <Text style={[styles.commentTime, { color: subTextColor }]}>
                              {c.createdAt ? moment(c.createdAt).fromNow() : 'Unknown time'}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => handleReplyPress(c)} style={styles.replyButton}>
                            <Text style={styles.replyButtonText}>Reply</Text>
                          </TouchableOpacity>
                        </View>
                     </View>
                     
                     {c.replies && c.replies.length > 0 && (
                       <View style={styles.repliesContainer}>
                         {c.replies.map((reply: any) => (
                           <View key={reply._id || Math.random()} style={styles.replyItem}>
                             <Image
                               source={{ uri: reply.author?.profilePic || default_pp_src }}
                               style={styles.replyProfilePic}
                               onError={() => console.log('Failed to load reply profile picture')}
                             />
                             <View style={[styles.replyBody, { backgroundColor: inputBg, borderColor }]}>
                               <Text style={[styles.replyAuthor, { color: textColor }]}>
                                 {reply.author?.fullName || 
                                  reply.author?.firstName || 
                                  reply.author?.name ||
                                  (reply.author?.user
                                    ? (
                                      <Text>
                                        {reply.author.user.firstName || ''} {reply.author.user.surname || ''}
                                      </Text>
                                    )
                                    : 'Unknown User'
                                  )}
                               </Text>
                               <Text style={[styles.replyText, { color: textColor }]}>
                                 {reply.text || reply.body || reply.content || reply.message || 'No reply text'}
                               </Text>
                               <Text style={[styles.replyTime, { color: subTextColor }]}>
                                 {reply.createdAt ? moment(reply.createdAt).fromNow() : 'Unknown time'}
                               </Text>
                             </View>
                           </View>
                         ))}
                       </View>
                     )}
                   </View>
                 ))
              )}
                         </View>
             
             {showReplyBox && replyingTo && (
               <View style={styles.replyInputContainer}>
                 <View style={styles.replyInputHeader}>
                   <Text style={[styles.replyingToText, { color: subTextColor }]}>
                     Replying to {replyingTo.author?.fullName || replyingTo.author?.firstName || 'Unknown'}
                   </Text>
                   <TouchableOpacity onPress={cancelReply} style={styles.cancelReplyBtn}>
                     <Icon name="close" size={16} color={subTextColor} />
                   </TouchableOpacity>
                 </View>
                 <View style={styles.replyInputRow}>
                   <TextInput
                     style={[styles.replyInput, { backgroundColor: inputBg, color: inputText, borderColor }]}
                     placeholder="Write a reply..."
                     placeholderTextColor={isDarkMode ? subTextColor : subTextColor}
                     value={replyText}
                     onChangeText={setReplyText}
                   />
                   <TouchableOpacity style={styles.replyPostBtn} onPress={handlePostReply}>
                     <Text style={styles.replyPostBtnText}>Reply</Text>
                   </TouchableOpacity>
                 </View>
               </View>
             )}
           </KeyboardAvoidingView>
         )}
       </View>
      <Modal visible={isShareModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.shareModal, { backgroundColor: cardBg }]}> 
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
  timeContainer: {
    marginTop: 2,
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
    marginTop: 6,
    borderColor: '#eee',
    borderRadius: 12,
    overflow: 'visible'
  },
  actionBarItem: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 5,
    marginVertical: 6,
    paddingHorizontal: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionMenu: {
    backgroundColor: '#fff',
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
    backgroundColor: '#E5E5E5',
  },
  optionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
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
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 6,
    elevation: 8,
    zIndex: 20,
    borderWidth: 1,
    borderColor: '#e6e6e6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  reactionPopupWrapper: {
    position: 'absolute',
    bottom: 42,
    left: '50%',
    transform: [{ translateX: -100 }],
    zIndex: 40,
    alignItems: 'center',
  },
  reactionCaret: {
    width: 16,
    height: 16,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
    marginTop: -8,
    backgroundColor: '#fff',
    borderColor: '#e6e6e6',
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  countsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  countItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  commentPostBtn: {
    backgroundColor: '#29b1a9',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#29b1a9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  commentBody: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  commentAuthor: {
    fontWeight: '600',
    fontSize: 14,
    color: '#2c3e50',
    marginBottom: 6,
  },
  commentText: {
    fontSize: 14,
    color: '#34495e',
    lineHeight: 20,
    marginBottom: 8,
  },
  commentTime: {
    fontSize: 12,
    color: '#95a5a6',
    fontWeight: '500',
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
  actionEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reactionIcon: {
    fontSize: 28,
    marginHorizontal: 0,
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
    backgroundColor: '#fff',
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
    borderColor: '#E5E5E5',
  },
  deleteBtn: {
    backgroundColor: '#FF4444',
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
  replyButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(41, 177, 169, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(41, 177, 169, 0.3)',
  },
  replyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#29b1a9',
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
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  replyBody: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  replyAuthor: {
    fontWeight: '600',
    fontSize: 13,
    color: '#2c3e50',
    marginBottom: 4,
  },
  replyText: {
    fontSize: 13,
    color: '#34495e',
    lineHeight: 18,
    marginBottom: 6,
  },
  replyTime: {
    fontSize: 11,
    color: '#95a5a6',
    fontWeight: '500',
  },
  // Reply input styles
  replyInputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    padding: 16,
    backgroundColor: '#fafafa',
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
    color: '#7f8c8d',
    backgroundColor: 'rgba(41, 177, 169, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(41, 177, 169, 0.2)',
  },
  cancelReplyBtn: {
    padding: 6,
    backgroundColor: '#ecf0f1',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d5dbdb',
  },
  replyInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  replyInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  replyPostBtn: {
    backgroundColor: '#29b1a9',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#29b1a9',
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
});

export default Post;