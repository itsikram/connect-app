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
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
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
    content: string;
    photos?: string[];
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
    const navigation = useNavigation();
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

    const reactionEmojiMap: Record<string, string> = {
        like: '👍',
        love: '❤️',
        haha: '😂',
        sad: '😢',
        angry: '😠',
        wow: '😮',
    };

    const fetchPost = useCallback(async () => {
        try {
            setError(null);
            const response = await api.get(`/post/${postId}`);
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
            await api.post(`/post/${post._id}/share`);
            setTotalShares(prev => prev + 1);
            Alert.alert('Success', 'Post shared successfully');
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

    const renderReactionButton = () => (
        <TouchableOpacity
            onPress={() => setShowReactions(!showReactions)}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: isReacted ? themeColors.primary + '20' : themeColors.gray[100],
                borderRadius: 20,
                marginRight: 8,
            }}
        >
            <Text style={{ fontSize: 16, marginRight: 4 }}>
                {isReacted && reactType ? reactionEmojiMap[reactType] : '👍'}
            </Text>
            <Text style={{ color: themeColors.text.primary, fontWeight: '500' }}>
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
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowReactions(false)}
            >
                <View style={{
                    backgroundColor: themeColors.surface.primary,
                    borderRadius: 20,
                    padding: 20,
                    flexDirection: 'row',
                    gap: 16,
                }}>
                    {Object.entries(reactionEmojiMap).map(([type, emoji]) => (
                        <TouchableOpacity
                            key={type}
                            onPress={() => handleReaction(type)}
                            style={{
                                padding: 12,
                                borderRadius: 20,
                                backgroundColor: reactType === type ? themeColors.primary + '20' : 'transparent',
                            }}
                        >
                            <Text style={{ fontSize: 24 }}>{emoji}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </TouchableOpacity>
        </Modal>
    );

    const renderComment = (comment: Comment, isReply = false) => (
        <View key={comment._id} style={{
            marginLeft: isReply ? 20 : 0,
            marginBottom: 12,
            paddingBottom: 12,
            borderBottomWidth: isReply ? 0 : 1,
            borderBottomColor: themeColors.border.primary,
        }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <UserPP
                    image={comment.author?.profilePic || ''}
                    size={32}
                    isActive={false}
                />
                <View style={{ flex: 1, marginLeft: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ color: themeColors.text.primary, fontWeight: '600', fontSize: 14 }}>
                            {comment.author?.fullName || 'Unknown User'}
                        </Text>
                        <Text style={{ color: themeColors.text.secondary, fontSize: 12, marginLeft: 8 }}>
                            {moment(comment.createdAt).fromNow()}
                        </Text>
                    </View>
                    <Text style={{ color: themeColors.text.primary, fontSize: 14, lineHeight: 20 }}>
                        {comment.content}
                    </Text>
                    {!isReply && (
                        <TouchableOpacity
                            onPress={() => setReplyingTo(comment)}
                            style={{ marginTop: 4 }}
                        >
                            <Text style={{ color: themeColors.primary, fontSize: 12 }}>
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
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                    <Text style={{ color: themeColors.text.primary, marginTop: 16 }}>
                        {!myProfile ? 'Loading user profile...' : 'Loading post...'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !post) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Icon name="error" size={48} color={themeColors.status.error} />
                    <Text style={{ color: themeColors.text.primary, fontSize: 18, marginTop: 16, textAlign: 'center' }}>
                        {error || 'Post not found'}
                    </Text>
                    <TouchableOpacity
                        onPress={fetchPost}
                        style={{
                            backgroundColor: themeColors.primary,
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 20,
                            marginTop: 16,
                        }}
                    >
                        <Text style={{ color: themeColors.text.inverse, fontWeight: '600' }}>
                            Try Again
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
            {/* Header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.border.primary,
                backgroundColor: themeColors.surface.header,
            }}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ marginRight: 16 }}
                >
                    <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
                </TouchableOpacity>
                <Text style={{ color: themeColors.text.primary, fontSize: 18, fontWeight: '600' }}>
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
            >
                {/* Post Content */}
                <View style={{
                    backgroundColor: themeColors.surface.primary,
                    marginBottom: 8,
                    paddingVertical: 16,
                }}>
                    {/* Author Info */}
                    <View style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        marginBottom: 12,
                    }}>
                        <UserPP
                            image={post.author?.profilePic || ''}
                            size={40}
                            isActive={post.author?.isActive || false}
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: themeColors.text.primary, fontWeight: '600', fontSize: 16 }}>
                                {post.author?.fullName || 'Unknown User'}
                            </Text>
                            <Text style={{ color: themeColors.text.secondary, fontSize: 12 }}>
                                {moment(post.createdAt).format('MMM DD, YYYY • hh:mm A')}
                            </Text>
                        </View>
                        <TouchableOpacity>
                            <Icon name="more-vert" size={24} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    {/* Post Content */}
                    {post.content && (
                        <Text style={{
                            color: themeColors.text.primary,
                            fontSize: 16,
                            lineHeight: 24,
                            paddingHorizontal: 16,
                            marginBottom: 12,
                        }}>
                            {post.content}
                        </Text>
                    )}

                    {/* Photos */}
                    {post.photos && post.photos.length > 0 && (
                        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                            {post.photos.length === 1 ? (
                                <TouchableOpacity onPress={() => openImageModal(post.photos![0])}>
                                    <Image
                                        source={{ uri: post.photos[0] }}
                                        style={{
                                            width: '100%',
                                            height: 300,
                                            borderRadius: 8,
                                        }}
                                        resizeMode="cover"
                                    />
                                </TouchableOpacity>
                            ) : (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                                    {post.photos.slice(0, 4).map((photo, index) => (
                                        <TouchableOpacity
                                            key={index}
                                            onPress={() => openImageModal(photo)}
                                            style={{
                                                width: post.photos!.length === 2 ? '48%' : '32%',
                                                height: 120,
                                            }}
                                        >
                                            <Image
                                                source={{ uri: photo }}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    borderRadius: 8,
                                                }}
                                                resizeMode="cover"
                                            />
                                            {index === 3 && post.photos!.length > 4 && (
                                                <View style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    backgroundColor: 'rgba(0,0,0,0.5)',
                                                    borderRadius: 8,
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                }}>
                                                    <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                                                        +{post.photos!.length - 4}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </View>
                    )}

                    {/* Stats */}
                    <View style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderTopColor: themeColors.border.primary,
                    }}>
                        <Text style={{ color: themeColors.text.secondary, fontSize: 14 }}>
                            {totalReacts > 0 && `${totalReacts} reactions`}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <Text style={{ color: themeColors.text.secondary, fontSize: 14 }}>
                                {totalComments} comments
                            </Text>
                            <Text style={{ color: themeColors.text.secondary, fontSize: 14 }}>
                                {totalShares} shares
                            </Text>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View style={{
                        flexDirection: 'row',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderTopColor: themeColors.border.primary,
                    }}>
                        {renderReactionButton()}
                        <TouchableOpacity
                            onPress={() => setShowComments(!showComments)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                backgroundColor: themeColors.gray[100],
                                borderRadius: 20,
                                marginRight: 8,
                            }}
                        >
                            <Icon name="comment" size={16} color={themeColors.text.primary} />
                            <Text style={{ color: themeColors.text.primary, marginLeft: 4 }}>
                                Comment
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleShare}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                backgroundColor: themeColors.gray[100],
                                borderRadius: 20,
                            }}
                        >
                            <Icon name="share" size={16} color={themeColors.text.primary} />
                            <Text style={{ color: themeColors.text.primary, marginLeft: 4 }}>
                                Share
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Comments Section */}
                {showComments && (
                    <View style={{
                        backgroundColor: themeColors.surface.primary,
                        paddingVertical: 16,
                    }}>
                        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
                            <Text style={{ color: themeColors.text.primary, fontSize: 18, fontWeight: '600' }}>
                                Comments ({totalComments})
                            </Text>
                        </View>

                        {/* Comments List */}
                        {comments.map(comment => renderComment(comment))}

                        {/* Comment Input */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingTop: 16,
                            borderTopWidth: 1,
                            borderTopColor: themeColors.border.primary,
                        }}>
                            <UserPP
                                image={myProfile?.profilePic || ''}
                                size={32}
                                isActive={false}
                            />
                            <View style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginLeft: 12,
                                backgroundColor: themeColors.gray[100],
                                borderRadius: 20,
                                paddingHorizontal: 12,
                            }}>
                                <TextInput
                                    value={commentText}
                                    onChangeText={setCommentText}
                                    placeholder="Write a comment..."
                                    placeholderTextColor={themeColors.text.secondary}
                                    style={{
                                        flex: 1,
                                        color: themeColors.text.primary,
                                        fontSize: 14,
                                        paddingVertical: 8,
                                    }}
                                    multiline
                                />
                                <TouchableOpacity
                                    onPress={handleComment}
                                    disabled={!commentText.trim()}
                                    style={{
                                        padding: 8,
                                        opacity: commentText.trim() ? 1 : 0.5,
                                    }}
                                >
                                    <Icon name="send" size={20} color={themeColors.primary} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Reply Input */}
                        {replyingTo && (
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: 16,
                                paddingTop: 12,
                                backgroundColor: themeColors.gray[50],
                            }}>
                                <UserPP
                                    image={myProfile?.profilePic || ''}
                                    size={28}
                                    isActive={false}
                                />
                                <View style={{
                                    flex: 1,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginLeft: 12,
                                    backgroundColor: themeColors.gray[100],
                                    borderRadius: 16,
                                    paddingHorizontal: 12,
                                }}>
                                    <TextInput
                                        value={replyText}
                                        onChangeText={setReplyText}
                                        placeholder={`Reply to ${replyingTo.author.fullName}...`}
                                        placeholderTextColor={themeColors.text.secondary}
                                        style={{
                                            flex: 1,
                                            color: themeColors.text.primary,
                                            fontSize: 14,
                                            paddingVertical: 6,
                                        }}
                                        multiline
                                    />
                                    <TouchableOpacity
                                        onPress={handleReply}
                                        disabled={!replyText.trim()}
                                        style={{
                                            padding: 6,
                                            opacity: replyText.trim() ? 1 : 0.5,
                                        }}
                                    >
                                        <Icon name="send" size={18} color={themeColors.primary} />
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setReplyingTo(null)}
                                    style={{ marginLeft: 8 }}
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
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <TouchableOpacity
                        onPress={closeImageModal}
                        style={{
                            position: 'absolute',
                            top: 50,
                            right: 20,
                            zIndex: 1000,
                        }}
                    >
                        <Icon name="close" size={30} color="white" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: selectedImage }}
                        style={{
                            width: SCREEN_WIDTH * 0.9,
                            height: SCREEN_WIDTH * 0.9,
                        }}
                        resizeMode="contain"
                    />
                </View>
            </Modal>

            {/* Reactions Modal */}
            {renderReactionsModal()}
        </SafeAreaView>
    );
};

export default SinglePost;
