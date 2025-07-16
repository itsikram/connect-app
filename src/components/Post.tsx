import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
// import socket from '../../common/socket'; // Use socket.io-client for React Native
import api from '../lib/api';
// import UserPP from '../UserPP'; // You need to create a React Native version of this
// import PostComment from './PostComment'; // You need to create a React Native version of this

const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';

interface PostProps {
  data: any;
}

const Post: React.FC<PostProps> = ({ data }) => {
  const post = data || {};
  const myProfile = useSelector((state: any) => state.profile);
  const myProfileId = myProfile._id;
  const [totalReacts, setTotalReacts] = useState<number>(post.reacts.length);
  const [totalShares, setTotalShares] = useState<number>(post.shares.length);
  const [totalComments] = useState<number>(post.comments.length);
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

  const navigation = useNavigation();

  // ... socket logic can be added here if needed

  useEffect(() => {
    // Set placed reacts and isReacted
    let storedReacts: string[] = [];
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
    // Mock API call
    const newComment = {
      _id: Date.now().toString(),
      author: { fullName: myProfile.fullName, profilePic: myProfile.profilePic },
      text: commentText,
      createdAt: new Date().toISOString(),
    };
    // In real app, send to backend and get response
    setComments((prev) => [newComment, ...prev]);
    setCommentText('');
  };

  // Render
  return (
    <View style={styles.postContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={postHeaderClick}>
          <Image
            source={{ uri: post.author.profilePic || default_pp_src }}
            style={styles.profilePic}
          />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.authorName}>{post.author.fullName}</Text>
          <Text style={styles.time}>{moment(post.createdAt).fromNow()}</Text>
        </View>
        <TouchableOpacity onPress={postOptionClick}>
          <Icon name="more-vert" size={24} />
        </TouchableOpacity>
        {/* Post option modal */}
        <Modal visible={isPostOption} transparent animationType="fade">
          <TouchableOpacity style={styles.modalOverlay} onPress={() => setIsPostOption(false)}>
            <View style={styles.optionMenu}>
              <TouchableOpacity>
                <Text>Edit Post</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text>Edit Audience</Text>
              </TouchableOpacity>
              <TouchableOpacity>
                <Text>Report This Post</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      {/* Body */}
      <View style={styles.body}>
        <Text style={styles.caption}>{post.caption}</Text>
        {post.photos && (
          <Image
            source={{ uri: post.photos }}
            style={styles.postImage}
          />
        )}
      </View>
      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.reactsRow}>
          <View style={styles.countsRow}>
            <Text style={styles.countText}>{totalReacts} Reacts</Text>
            <Text style={styles.countText}>{totalComments} Comments</Text>
            <Text style={styles.countText}>{totalShares} Shares</Text>
          </View>
        </View>
        <View style={styles.actionsRow}>
          {/* Like button with long press for reactions */}
          <View style={{ alignItems: 'center' }}>
            <TouchableOpacity
              onPress={handleLikePress}
              onLongPress={handleLikeLongPress}
              delayLongPress={200}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <Icon name="thumb-up" size={20} color={reactType === 'like' ? '#007bff' : '#888'} />
              <Text style={[styles.actionLabel, reactType === 'like' ? styles.selectedReact : styles.reactText]}> Like</Text>
            </TouchableOpacity>
            {showReactions && (
              <View style={styles.reactionPopup}>
                <TouchableOpacity onPress={() => handleSelectReaction('like')}>
                  <Text style={reactType === 'like' ? styles.selectedReact : styles.reactText}>👍</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSelectReaction('love')}>
                  <Text style={reactType === 'love' ? styles.selectedReact : styles.reactText}>❤️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSelectReaction('haha')}>
                  <Text style={reactType === 'haha' ? styles.selectedReact : styles.reactText}>😂</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleSelectReaction('sad')}>
                  <Text style={reactType === 'sad' ? styles.selectedReact : styles.reactText}>😢</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {/* Comment button toggles comment box */}
          <TouchableOpacity onPress={handleCommentPress} style={{ alignItems: 'center' }}>
            <Icon name="comment" size={20} />
            <Text>Comment</Text>
          </TouchableOpacity>
          {/* Share button opens share modal */}
          <TouchableOpacity onPress={() => setIsShareModal(true)} style={{ alignItems: 'center' }}>
            <Icon name="share" size={20} />
            <Text>Share</Text>
          </TouchableOpacity>
        </View>
        {/* Comment Box and Comments List */}
        {showCommentBox && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.commentBoxContainer}
          >
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
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
                <Text style={styles.noCommentsText}>No comments yet.</Text>
              ) : (
                comments.map((c) => (
                  <View key={c._id} style={styles.commentItem}>
                    <Image source={{ uri: c.author.profilePic || default_pp_src }} style={styles.commentProfilePic} />
                    <View style={styles.commentBody}>
                      <Text style={styles.commentAuthor}>{c.author.fullName}</Text>
                      <Text style={styles.commentText}>{c.text}</Text>
                      <Text style={styles.commentTime}>{moment(c.createdAt).fromNow()}</Text>
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
          <View style={styles.shareModal}>
            <Text>Share Post</Text>
            <TextInput
              style={styles.shareInput}
              placeholder="What's on your mind?"
              value={shareCap}
              onChangeText={setShareCap}
            />
            <TouchableOpacity onPress={onClickShareNow}>
              <Text>Share Now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsShareModal(false)}>
              <Text>Cancel</Text>
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
  },
  authorName: {
    fontWeight: 'bold',
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
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#eee',
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
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 8,
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
  countText: {
    marginHorizontal: 6,
    color: '#555',
    fontSize: 13,
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
    backgroundColor: '#007bff',
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
});

export default Post;