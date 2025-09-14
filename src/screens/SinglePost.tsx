import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    ActivityIndicator,
    Alert,
    RefreshControl,
    SafeAreaView,
    Dimensions,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RootStackParamList = {
    PostDetail: { postId: string };
    SinglePost: { postId: string };
    SingleVideo: { videoId: string };
    FriendProfile: { friendId: string };
    EditPost: { postId: string };
};
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';
import moment from 'moment';
import api from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import UserPP from '../components/UserPP';
import { RootState } from '../store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Post {
    _id: string;
    caption: string;
    photos?: string | string[];
    type?: string;
    feelings?: string;
    location?: string;
    author: {
        _id: string;
        fullName: string;
        profilePic?: string;
        isActive?: boolean;
    };
    reacts?: Array<{
        profile: string;
        type: string;
    }>;
    comments?: Array<{
        _id: string;
        content: string;
        author: {
            _id: string;
            fullName: string;
            profilePic?: string;
        };
        createdAt: string;
        replies?: Array<{
            _id: string;
            content: string;
            author: {
                _id: string;
                fullName: string;
                profilePic?: string;
            };
            createdAt: string;
        }>;
    }>;
    shares?: Array<{
        profile: string;
    }>;
    createdAt: string;
    updatedAt: string;
}

interface Comment {
    _id: string;
    content: string;
    author: {
        _id: string;
        fullName: string;
        profilePic?: string;
    };
    createdAt: string;
    replies?: Array<{
        _id: string;
        content: string;
        author: {
            _id: string;
            fullName: string;
            profilePic?: string;
        };
        createdAt: string;
    }>;
}

const SinglePost = () => {
    const route = useRoute();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { postId } = route.params as { postId: string };
    
    const { colors: themeColors, isDarkMode } = useTheme();
    const { emit, on, off, isConnected } = useSocket();
    const myProfile = useSelector((state: RootState) => state.profile);
    
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
    const [replyText, setReplyText] = useState('');
    const [showReactions, setShowReactions] = useState(false);
    const [isReacted, setIsReacted] = useState(false);
    const [reactType, setReactType] = useState<string | false>(false);
    const [totalReacts, setTotalReacts] = useState(0);
    const [totalComments, setTotalComments] = useState(0);
    const [totalShares, setTotalShares] = useState(0);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [showFullContent, setShowFullContent] = useState(false);
    const [isPostOption, setIsPostOption] = useState(false);
    const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

    const reactionEmojiMap: Record<string, string> = {
        like: '👍',
        love: '❤️',
        haha: '😂',
        sad: '😢',
        angry: '😠',
        wow: '😮',
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: themeColors.background.primary,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border.primary,
            backgroundColor: themeColors.surface.header,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        headerTitle: {
            color: themeColors.text.primary,
            fontSize: 20,
            fontWeight: '700',
            marginLeft: 16,
        },
        backButton: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: themeColors.gray[100],
        },
        postContainer: {
            backgroundColor: themeColors.surface.primary,
            marginBottom: 12,
            borderRadius: 0,
        },
        authorSection: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
        },
        authorInfo: {
            flex: 1,
            marginLeft: 12,
        },
        authorName: {
            color: themeColors.text.primary,
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 2,
        },
        metaInline: {
            fontWeight: '400',
        },
        postTime: {
            color: themeColors.text.secondary,
            fontSize: 13,
        },
        moreButton: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: themeColors.gray[100],
        },
        contentSection: {
            paddingHorizontal: 20,
            paddingBottom: 16,
        },
        postContent: {
            color: themeColors.text.primary,
            fontSize: 16,
            lineHeight: 24,
            marginBottom: 12,
        },
        readMoreButton: {
            color: themeColors.primary,
            fontSize: 14,
            fontWeight: '600',
            marginTop: 4,
        },
        imageContainer: {
            marginBottom: 12,
        },
        singleImage: {
            width: '100%',
            height: 300,
            borderRadius: 12,
        },
        multiImageContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 4,
        },
        multiImage: {
            borderRadius: 8,
        },
        imageOverlay: {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
        },
        overlayText: {
            color: 'white',
            fontSize: 18,
            fontWeight: 'bold',
        },
        statsSection: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: themeColors.border.primary,
        },
        statsLeft: {
            flexDirection: 'row',
            alignItems: 'center',
        },
        reactionStats: {
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: 16,
        },
        reactionEmojiSmall: {
            fontSize: 16,
            marginRight: 4,
        },
        statsText: {
            color: themeColors.text.secondary,
            fontSize: 14,
            fontWeight: '500',
        },
        statsRight: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 16,
        },
        actionButtons: {
            flexDirection: 'row',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: themeColors.border.primary,
        },
        actionButton: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            marginHorizontal: 4,
        },
        actionButtonActive: {
            backgroundColor: themeColors.primary + '15',
        },
        actionButtonText: {
            color: themeColors.text.primary,
            fontSize: 14,
            fontWeight: '600',
            marginLeft: 8,
        },
        actionButtonTextActive: {
            color: themeColors.primary,
        },
        commentsSection: {
            backgroundColor: themeColors.surface.primary,
            borderTopWidth: 1,
            borderTopColor: themeColors.border.primary,
        },
        commentsHeader: {
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border.primary,
        },
        commentsTitle: {
            color: themeColors.text.primary,
            fontSize: 18,
            fontWeight: '700',
        },
        commentItem: {
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border.primary,
        },
        commentHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
        },
        commentAuthor: {
            color: themeColors.text.primary,
            fontSize: 14,
            fontWeight: '600',
            marginRight: 8,
        },
        commentTime: {
            color: themeColors.text.secondary,
            fontSize: 12,
        },
        commentContent: {
            color: themeColors.text.primary,
            fontSize: 14,
            lineHeight: 20,
            marginBottom: 8,
        },
        replyButton: {
            alignSelf: 'flex-start',
        },
        replyButtonText: {
            color: themeColors.primary,
            fontSize: 12,
            fontWeight: '600',
        },
        commentInput: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderTopWidth: 1,
            borderTopColor: themeColors.border.primary,
        },
        inputContainer: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 12,
            backgroundColor: themeColors.gray[100],
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 8,
        },
        textInput: {
            flex: 1,
            color: themeColors.text.primary,
            fontSize: 14,
            maxHeight: 100,
        },
        sendButton: {
            padding: 8,
            marginLeft: 8,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: themeColors.background.primary,
        },
        loadingText: {
            color: themeColors.text.primary,
            marginTop: 16,
            fontSize: 16,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: themeColors.background.primary,
            padding: 20,
        },
        errorText: {
            color: themeColors.text.primary,
            fontSize: 18,
            textAlign: 'center',
            marginTop: 16,
            marginBottom: 20,
        },
        retryButton: {
            backgroundColor: themeColors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 24,
        },
        retryButtonText: {
            color: themeColors.text.inverse,
            fontWeight: '600',
            fontSize: 16,
        },
        imageModal: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        closeButton: {
            position: 'absolute',
            top: 50,
            right: 20,
            zIndex: 1000,
            backgroundColor: 'rgba(0,0,0,0.5)',
            borderRadius: 20,
            padding: 8,
        },
        modalImage: {
            width: SCREEN_WIDTH * 0.95,
            height: SCREEN_WIDTH * 0.95,
            borderRadius: 12,
        },
        reactionsModal: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        reactionsContainer: {
            backgroundColor: themeColors.surface.primary,
            borderRadius: 24,
            padding: 20,
            flexDirection: 'row',
            gap: 16,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
        },
        reactionButton: {
            padding: 12,
            borderRadius: 20,
            backgroundColor: 'transparent',
        },
        reactionButtonActive: {
            backgroundColor: themeColors.primary + '20',
        },
        reactionEmoji: {
            fontSize: 28,
        },
        // Image styles matching Post component
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
        // Option menu styles
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
    });

    const fetchPost = useCallback(async () => {
        try {
            setError(null);
            const response = await api.get(`/post/single?postId=${postId}`);
            console.log('posts data', response.data);
            if (response.status === 200) {
                const postData = response.data.post || response.data;
                setPost(postData);
                setComments(postData.comments || []);
                setTotalComments(postData.comments?.length || 0);
                setTotalReacts(postData.reacts?.length || 0);
                setTotalShares(postData.shares?.length || 0);
                
                // Check if user has reacted
                if (postData.reacts && myProfile?._id) {
                    const userReact = postData.reacts.find((react: any) => react.profile === myProfile._id);
                    if (userReact) {
                        setIsReacted(true);
                        setReactType(userReact.type);
                    }
                }
            }
        } catch (err: any) {
            console.error('Error fetching post:', err);
            setError(err?.response?.data?.message || 'Failed to load post');
        } finally {
            setLoading(false);
        }
    }, [postId, myProfile?._id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchPost();
        setRefreshing(false);
    }, [fetchPost]);

    useEffect(() => {
        fetchPost();
    }, [fetchPost]);

    // Socket events for real-time updates
    useEffect(() => {
        if (!isConnected || !post) return;

        const handleNewComment = (data: any) => {
            if (data.postId === post._id) {
                setComments(prev => [...prev, data.comment]);
                setTotalComments(prev => prev + 1);
            }
        };

        const handleNewReaction = (data: any) => {
            if (data.postId === post._id) {
                setTotalReacts(prev => prev + 1);
                if (data.profileId === myProfile?._id) {
                    setIsReacted(true);
                    setReactType(data.type);
                }
            }
        };

        const handleRemoveReaction = (data: any) => {
            if (data.postId === post._id) {
                setTotalReacts(prev => Math.max(0, prev - 1));
                if (data.profileId === myProfile?._id) {
                    setIsReacted(false);
                    setReactType(false);
                }
            }
        };

        on('newComment', handleNewComment);
        on('newReaction', handleNewReaction);
        on('removeReaction', handleRemoveReaction);

        return () => {
            off('newComment', handleNewComment);
            off('newReaction', handleNewReaction);
            off('removeReaction', handleRemoveReaction);
        };
    }, [isConnected, post, myProfile?._id, on, off]);

    const handleReaction = async (type: string) => {
        if (!post || !myProfile?._id) return;

        try {
            if (isReacted && reactType === type) {
                // Remove reaction
                await api.delete(`/post/${post._id}/react`);
                setTotalReacts(prev => Math.max(0, prev - 1));
                setIsReacted(false);
                setReactType(false);
                emit('removeReaction', { postId: post._id, profileId: myProfile._id, type });
            } else {
                // Add or change reaction
                await api.post(`/post/${post._id}/react`, { type });
                if (!isReacted) {
                    setTotalReacts(prev => prev + 1);
                }
                setIsReacted(true);
                setReactType(type);
                emit('newReaction', { postId: post._id, profileId: myProfile._id, type });
            }
        } catch (err) {
            console.error('Error handling reaction:', err);
            Alert.alert('Error', 'Failed to update reaction');
        }
        setShowReactions(false);
    };

    const handleComment = async () => {
        if (!commentText.trim() || !post || !myProfile?._id) return;

        try {
            const response = await api.post(`/post/${post._id}/comment`, {
                content: commentText.trim(),
            });

            if (response.status === 200 || response.status === 201) {
                const newComment = response.data.comment || response.data;
                setComments(prev => [...prev, newComment]);
                setTotalComments(prev => prev + 1);
                setCommentText('');
                emit('newComment', { postId: post._id, comment: newComment });
            }
        } catch (err) {
            console.error('Error adding comment:', err);
            Alert.alert('Error', 'Failed to add comment');
        }
    };

    const handleReply = async () => {
        if (!replyText.trim() || !replyingTo || !post || !myProfile?._id) return;

        try {
            const response = await api.post(`/post/${post._id}/comment/${replyingTo._id}/reply`, {
                content: replyText.trim(),
            });

            if (response.status === 200 || response.status === 201) {
                const newReply = response.data.reply || response.data;
                setComments(prev => 
                    prev.map(comment => 
                        comment._id === replyingTo._id 
                            ? { ...comment, replies: [...(comment.replies || []), newReply] }
                            : comment
                    )
                );
                setReplyText('');
                setReplyingTo(null);
            }
        } catch (err) {
            console.error('Error adding reply:', err);
            Alert.alert('Error', 'Failed to add reply');
        }
    };

    const handleShare = async () => {
        if (!post || !myProfile?._id) return;

        try {
            return Alert.alert('Success', 'Post shared successfully');

            await api.post(`/post/share`);
            setTotalShares(prev => prev + 1);
        } catch (err) {
            console.error('Error sharing post:', err);
            Alert.alert('Error', 'Failed to share post');
        }
    };

    const openImageModal = (imageUrl: string) => {
        setSelectedImage(imageUrl);
        setShowImageModal(true);
    };

    const closeImageModal = () => {
        setShowImageModal(false);
        setSelectedImage('');
    };

    // Post option functions
    const postOptionClick = () => setIsPostOption(!isPostOption);

    const showDeleteConfirm = () => {
        setIsPostOption(false);
        setShowDeleteConfirmation(true);
    };

    const handleDeletePost = async () => {
        if (!post) return;
        try {
            const res = await api.post(`/post/delete`, { postId: post._id, authorId: post.author._id });
            if (res.status === 200) {
                // Close the modals
                setIsPostOption(false);
                setShowDeleteConfirmation(false);
                // Navigate back since post is deleted
                navigation.goBack();
                console.log('Post deleted successfully');
            }
        } catch (error) {
            console.error('Error deleting post:', error);
            Alert.alert('Error', 'Failed to delete post');
        }
    };

    const renderReactionButton = () => (
        <TouchableOpacity
            onPress={() => setShowReactions(!showReactions)}
            style={[
                styles.actionButton,
                isReacted && styles.actionButtonActive,
            ]}
        >
            <Text style={styles.reactionEmoji}>
                {isReacted && reactType ? reactionEmojiMap[reactType] : '👍'}
            </Text>
            <Text style={[
                styles.actionButtonText,
                isReacted && styles.actionButtonTextActive,
            ]}>
                {totalReacts > 0 ? totalReacts : 'Like'}
            </Text>
        </TouchableOpacity>
    );

    const renderReactionsModal = () => (
        <Modal
            visible={showReactions}
            transparent
            animationType="fade"
            onRequestClose={() => setShowReactions(false)}
        >
            <TouchableOpacity
                style={styles.reactionsModal}
                onPress={() => setShowReactions(false)}
            >
                <View style={styles.reactionsContainer}>
                    {Object.entries(reactionEmojiMap).map(([type, emoji]) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => handleReaction(type)}
                            style={[
                                styles.reactionButton,
                                reactType === type && styles.reactionButtonActive,
                            ]}
                        >
                            <Text style={styles.reactionEmoji}>{emoji}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );

    const renderComment = (comment: Comment, isReply = false) => (
        <View key={comment._id} style={[
            styles.commentItem,
            isReply && { marginLeft: 20, backgroundColor: themeColors.gray[50] }
        ]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <UserPP
                    image={comment.author?.profilePic || ''}
                    size={isReply ? 28 : 32}
                    isActive={false}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>
                            {comment.author?.fullName || 'Unknown User'}
                        </Text>
                        <Text style={styles.commentTime}>
                            {moment(comment.createdAt).fromNow()}
                        </Text>
                    </View>
                    <Text style={styles.commentContent}>
                        {comment.content}
                    </Text>
                    {!isReply && (
                        <TouchableOpacity
                            onPress={() => setReplyingTo(comment)}
                            style={styles.replyButton}
                        >
                            <Text style={styles.replyButtonText}>
                                Reply
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            
            {/* Render replies */}
            {comment.replies?.map(reply => renderComment(reply, true))}
        </View>
    );

    if (loading || !myProfile) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar 
                    barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
                    backgroundColor={themeColors.surface.header} 
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                    <Text style={styles.loadingText}>
                        {!myProfile ? 'Loading user profile...' : 'Loading post...'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !post) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar 
                    barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
                    backgroundColor={themeColors.surface.header} 
                />
                <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={64} color={themeColors.status.error} />
                    <Text style={styles.errorText}>
                        {error || 'Post not found'}
                    </Text>
                    <TouchableOpacity
                        onPress={fetchPost}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>
                            Try Again
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar 
                barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
                backgroundColor={themeColors.surface.header} 
            />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    Post
                </Text>
            </View>

            <ScrollView
                style={{ flex: 1 }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[themeColors.primary]}
                        tintColor={themeColors.primary}
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* Post Content */}
                <View style={styles.postContainer}>
                    {/* Author Info */}
                    <View style={styles.authorSection}>
                        <UserPP
                            image={post.author?.profilePic || ''}
                            size={44}
                            isActive={post.author?.isActive || false}
                        />
                        <View style={styles.authorInfo}>
                            <Text style={styles.authorName}>
                                {post.author?.fullName || 'Unknown User'}
                                {post.feelings ? (
                                    <Text style={{ fontWeight: '400', color: themeColors.text.secondary }}> is feeling {post.feelings}</Text>
                                ) : null}
                                {post.location ? (
                                    <Text style={{ fontWeight: '400', color: themeColors.text.secondary }}>
                                        {post.feelings ? ' · ' : ' '}
                                        at {post.location}
                                    </Text>
                                ) : null}
                            </Text>
                            <Text style={styles.postTime}>
                                {moment(post.createdAt).format('MMM DD, YYYY • hh:mm A')}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={postOptionClick} style={styles.moreButton}>
                            <Icon name="more-vert" size={24} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Post Content */}
                    {post?.caption && (
                        <View style={styles.contentSection}>
                            <Text style={styles.postContent}>
                                {showFullContent || post.caption.length <= 200 
                                    ? post.caption 
                                    : post.caption.substring(0, 200) + '...'
                                }
                            </Text>
                            {post.caption.length > 200 && (
                                <TouchableOpacity onPress={() => setShowFullContent(!showFullContent)}>
                                    <Text style={styles.readMoreButton}>
                                        {showFullContent ? 'Show less' : 'Read more'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Photos - Display exactly like Post component */}
                    {post.photos && (
                        <View style={styles.attachmentContainer}>
                            {(post.type === 'post' || !post.type) && post.photos && (
                                <TouchableOpacity onPress={() => openImageModal(typeof post.photos === 'string' ? post.photos : (post.photos as string[])[0])}>
                                    <Image
                                        source={{ uri: typeof post.photos === 'string' ? post.photos : (post.photos as string[])[0] }}
                                        style={styles.postImage}
                                        onError={() => console.log('Failed to load post image')}
                                    />
                                </TouchableOpacity>
                            )}
                            {post.type === 'profilePic' && post.photos && (
                                <TouchableOpacity onPress={() => openImageModal(typeof post.photos === 'string' ? post.photos : (post.photos as string[])[0])}>
                                    <Image
                                        source={{ uri: typeof post.photos === 'string' ? post.photos : (post.photos as string[])[0] }}
                                        style={styles.postProfilePic}
                                        onError={() => console.log('Failed to load profile picture')}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Stats */}
                    <View style={styles.statsSection}>
                        <View style={styles.statsLeft}>
                            {totalReacts > 0 && (
                                <View style={styles.reactionStats}>
                                    <Text style={styles.reactionEmojiSmall}>
                                        {isReacted && reactType ? reactionEmojiMap[reactType] : '👍'}
                                    </Text>
                                    <Text style={styles.statsText}>
                                        {totalReacts} {totalReacts === 1 ? 'reaction' : 'reactions'}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.statsRight}>
                            <Text style={styles.statsText}>
                                {totalComments} {totalComments === 1 ? 'comment' : 'comments'}
                            </Text>
                            <Text style={styles.statsText}>
                                {totalShares} {totalShares === 1 ? 'share' : 'shares'}
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionButtons}>
                        {renderReactionButton()}
                        <TouchableOpacity
                            onPress={() => setShowComments(!showComments)}
                            style={[
                                styles.actionButton,
                                showComments && styles.actionButtonActive,
                            ]}
                        >
                            <Icon name="comment" size={18} color={showComments ? themeColors.primary : themeColors.text.primary} />
                            <Text style={[
                                styles.actionButtonText,
                                showComments && styles.actionButtonTextActive,
                            ]}>
                                Comment
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleShare}
                            style={styles.actionButton}
                        >
                            <Icon name="share" size={18} color={themeColors.text.primary} />
                            <Text style={styles.actionButtonText}>
                                Share
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Comments Section */}
                {showComments && (
                    <View style={styles.commentsSection}>
                        <View style={styles.commentsHeader}>
                            <Text style={styles.commentsTitle}>
                                Comments ({totalComments})
                            </Text>
                        </View>

                        {/* Comments List */}
                        {comments.length > 0 ? (
                            comments.map(comment => renderComment(comment))
                        ) : (
                            <View style={{ padding: 20, alignItems: 'center' }}>
                                <Icon name="comment" size={48} color={themeColors.text.secondary} />
                                <Text style={{ color: themeColors.text.secondary, marginTop: 8, fontSize: 16 }}>
                                    No comments yet
                                </Text>
                                <Text style={{ color: themeColors.text.secondary, fontSize: 14, textAlign: 'center', marginTop: 4 }}>
                                    Be the first to comment on this post
                                </Text>
                            </View>
                        )}

                        {/* Comment Input */}
                        <View style={styles.commentInput}>
                            <UserPP
                                image={myProfile?.profilePic || ''}
                                size={36}
                                isActive={false}
                            />
                            <View style={styles.inputContainer}>
                                <TextInput
                                    value={commentText}
                                    onChangeText={setCommentText}
                                    placeholder="Write a comment..."
                                    placeholderTextColor={themeColors.text.secondary}
                                    style={styles.textInput}
                                    multiline
                                />
                                <TouchableOpacity
                                    onPress={handleComment}
                                    disabled={!commentText.trim()}
                                    style={[
                                        styles.sendButton,
                                        { opacity: commentText.trim() ? 1 : 0.5 }
                                    ]}
                                >
                                    <Icon name="send" size={20} color={themeColors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Reply Input */}
                        {replyingTo && (
                            <View style={[
                                styles.commentInput,
                                { backgroundColor: themeColors.gray[50] }
                            ]}>
                                <UserPP
                                    image={myProfile?.profilePic || ''}
                                    size={32}
                                    isActive={false}
                                />
                                <View style={[
                                    styles.inputContainer,
                                    { borderRadius: 20 }
                                ]}>
                                    <TextInput
                                        value={replyText}
                                        onChangeText={setReplyText}
                                        placeholder={`Reply to ${replyingTo.author.fullName}...`}
                                        placeholderTextColor={themeColors.text.secondary}
                                        style={styles.textInput}
                                        multiline
                                    />
                                    <TouchableOpacity
                                        onPress={handleReply}
                                        disabled={!replyText.trim()}
                                        style={[
                                            styles.sendButton,
                                            { opacity: replyText.trim() ? 1 : 0.5 }
                                        ]}
                                    >
                                        <Icon name="send" size={18} color={themeColors.primary} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setReplyingTo(null)}
                                    style={{ marginLeft: 8, padding: 8 }}
                                >
                                    <Icon name="close" size={20} color={themeColors.text.secondary} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>

            {/* Image Modal */}
            <Modal
                visible={showImageModal}
                transparent
                animationType="fade"
                onRequestClose={closeImageModal}
            >
                <View style={styles.imageModal}>
                    <TouchableOpacity
                        onPress={closeImageModal}
                        style={styles.closeButton}
                    >
                        <Icon name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: selectedImage }}
                        style={styles.modalImage}
                        resizeMode="contain"
                    />
                </View>
            </Modal>

            {/* Reactions Modal */}
            {renderReactionsModal()}

            {/* Post Options Modal */}
            <Modal visible={isPostOption} transparent animationType="slide">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    onPress={() => setIsPostOption(false)}
                    activeOpacity={1}
                >
                    <View style={[styles.optionMenu, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.border.primary }]}> 
                        <View style={styles.optionMenuHeader}>
                            <View style={[styles.optionMenuHandle, { backgroundColor: themeColors.border.primary }]} />
                        </View>
                        
                        {post.author?._id === myProfile?._id && (
                            <>
                                <TouchableOpacity 
                                    style={[styles.optionMenuItem, { borderBottomColor: themeColors.border.primary }]}
                                    onPress={() => {
                                        setIsPostOption(false);
                                        navigation.navigate('EditPost', { postId: post._id });
                                    }}
                                >
                                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.primary + '15' }]}>
                                        <Icon name="edit" size={20} color={themeColors.primary} />
                                    </View>
                                    <View style={styles.optionMenuContent}>
                                        <Text style={[styles.optionMenuTitle, { color: themeColors.text.primary }]}>Edit Post</Text>
                                        <Text style={[styles.optionMenuSubtitle, { color: themeColors.text.secondary }]}>Make changes to your post</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={themeColors.text.secondary} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.optionMenuItem, { borderBottomColor: themeColors.border.primary }]}
                                    onPress={() => {
                                        setIsPostOption(false);
                                    }}
                                >
                                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.primary + '15' }]}>
                                        <Icon name="people" size={20} color={themeColors.primary} />
                                    </View>
                                    <View style={styles.optionMenuContent}>
                                        <Text style={[styles.optionMenuTitle, { color: themeColors.text.primary }]}>Edit Audience</Text>
                                        <Text style={[styles.optionMenuSubtitle, { color: themeColors.text.secondary }]}>Change who can see this post</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={themeColors.text.secondary} />
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
                        
                        {post.author?._id !== myProfile?._id && (
                            <>
                                <TouchableOpacity 
                                    style={[styles.optionMenuItem, { borderBottomColor: themeColors.border.primary }]}
                                    onPress={() => {
                                        setIsPostOption(false);
                                    }}
                                >
                                    <View style={[styles.optionMenuIcon, { backgroundColor: themeColors.primary + '15' }]}>
                                        <Icon name="bookmark" size={20} color={themeColors.primary} />
                                    </View>
                                    <View style={styles.optionMenuContent}>
                                        <Text style={[styles.optionMenuTitle, { color: themeColors.text.primary }]}>Save Post</Text>
                                        <Text style={[styles.optionMenuSubtitle, { color: themeColors.text.secondary }]}>Add this to your saved items</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={themeColors.text.secondary} />
                                </TouchableOpacity>
                                
                                <TouchableOpacity 
                                    style={[styles.optionMenuItem, { borderBottomColor: themeColors.border.primary }]}
                                    onPress={() => {
                                        setIsPostOption(false);
                                    }}
                                >
                                    <View style={[styles.optionMenuIcon, { backgroundColor: '#FFA50015' }]}>
                                        <Icon name="visibility-off" size={20} color="#FFA500" />
                                    </View>
                                    <View style={styles.optionMenuContent}>
                                        <Text style={[styles.optionMenuTitle, { color: themeColors.text.primary }]}>Hide Post</Text>
                                        <Text style={[styles.optionMenuSubtitle, { color: themeColors.text.secondary }]}>See fewer posts like this</Text>
                                    </View>
                                    <Icon name="chevron-right" size={20} color={themeColors.text.secondary} />
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
            
            {/* Delete Confirmation Modal */}
            <Modal visible={showDeleteConfirmation} transparent animationType="fade">
                <TouchableOpacity 
                    style={[styles.modalOverlay, { justifyContent: 'center' }]} 
                    onPress={() => setShowDeleteConfirmation(false)}
                    activeOpacity={1}
                >
                    <View style={[styles.deleteConfirmModal, { backgroundColor: themeColors.surface.primary, borderColor: themeColors.border.primary }]}>
                        <View style={styles.deleteConfirmHeader}>
                            <View style={[styles.deleteConfirmIcon, { backgroundColor: themeColors.status.error + '15' }]}>
                                <Icon name="delete" size={28} color={themeColors.status.error} />
                            </View>
                            <Text style={[styles.deleteConfirmTitle, { color: themeColors.text.primary }]}>Delete Post</Text>
                            <Text style={[styles.deleteConfirmMessage, { color: themeColors.text.secondary }]}>
                                Are you sure you want to delete this post? This action cannot be undone and the post will be permanently removed.
                            </Text>
                        </View>
                        
                        <View style={styles.deleteConfirmButtons}>
                            <TouchableOpacity 
                                style={[styles.deleteConfirmBtn, styles.cancelBtn, { borderColor: themeColors.border.primary }]} 
                                onPress={() => setShowDeleteConfirmation(false)}
                            >
                                <Text style={[styles.deleteConfirmBtnText, { color: themeColors.text.primary }]}>Cancel</Text>
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
        </SafeAreaView>
    );
};

export default SinglePost;
