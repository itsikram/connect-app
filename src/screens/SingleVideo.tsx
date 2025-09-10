import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    SafeAreaView,
    Dimensions,
    StatusBar,
    Modal,
    TextInput,
    ScrollView,
    RefreshControl,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import moment from 'moment';
import api from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import UserPP from '../components/UserPP';
import { RootState } from '../store';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

interface Video {
    _id: string;
    videoUrl?: string;
    caption?: string;
    photos?: string;
    type?: string;
    author?: {
        _id: string;
        username?: string;
        fullName?: string;
        profilePic?: string;
        isActive?: boolean;
    };
    user?: {
        _id: string;
        name?: string;
        username?: string;
        avatar?: string;
        profilePicture?: string;
        photo?: string;
    };
    likesCount?: number;
    commentsCount?: number;
    sharesCount?: number;
    createdAt: string;
    comments?: Array<{
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

interface Comment {
    _id: string;
    content: string;
    author: {
        _id: string;
        fullName: string;
        profilePic?: string;
    };
    createdAt: string;
}

const SingleVideo = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { videoId } = route.params as { videoId: string };
    
    const { colors: themeColors, isDarkMode } = useTheme();
    const { emit, on, off, isConnected } = useSocket();
    const myProfile = useSelector((state: RootState) => state.profile);
    
    const [video, setVideo] = useState<Video | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(true);
    const [isManuallyPaused, setIsManuallyPaused] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [comments, setComments] = useState<Comment[]>([]);
    const [loadingComments, setLoadingComments] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(0);
    const [commentsCount, setCommentsCount] = useState(0);
    const [sharesCount, setSharesCount] = useState(0);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);

    // Lazy require for react-native-video
    let VideoComp: any = null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        VideoComp = require('react-native-video').default;
    } catch (_) {
        VideoComp = null;
    }

    const fetchVideo = useCallback(async () => {
        try {
            setError(null);
            const response = await api.get(`/watch/${videoId}`);
            if (response.status === 200) {
                const videoData = response.data.watch || response.data;
                setVideo(videoData);
                setComments(videoData.comments || []);
                setCommentsCount(videoData.commentsCount || videoData.comments?.length || 0);
                setLikesCount(videoData.likesCount || 0);
                setSharesCount(videoData.sharesCount || 0);
                
                // Check if user has liked
                if (videoData.isLiked) {
                    setIsLiked(true);
                }
            }
        } catch (err: any) {
            console.error('Error fetching video:', err);
            setError(err?.response?.data?.message || 'Failed to load video');
        } finally {
            setLoading(false);
        }
    }, [videoId]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchVideo();
        setRefreshing(false);
    }, [fetchVideo]);

    useEffect(() => {
        fetchVideo();
    }, [fetchVideo]);

    // Pause video when screen loses focus
    useFocusEffect(
        useCallback(() => {
            setIsPlaying(true);
            return () => {
                setIsPlaying(false);
            };
        }, [])
    );

    // Socket events for real-time updates
    useEffect(() => {
        if (!isConnected || !video) return;

        const handleNewComment = (data: any) => {
            if (data.videoId === video._id) {
                setComments(prev => [...prev, data.comment]);
                setCommentsCount(prev => prev + 1);
            }
        };

        const handleNewLike = (data: any) => {
            if (data.videoId === video._id) {
                setLikesCount(prev => prev + 1);
                if (data.profileId === myProfile?._id) {
                    setIsLiked(true);
                }
            }
        };

        const handleRemoveLike = (data: any) => {
            if (data.videoId === video._id) {
                setLikesCount(prev => Math.max(0, prev - 1));
                if (data.profileId === myProfile?._id) {
                    setIsLiked(false);
                }
            }
        };

        on('newVideoComment', handleNewComment);
        on('newVideoLike', handleNewLike);
        on('removeVideoLike', handleRemoveLike);

        return () => {
            off('newVideoComment', handleNewComment);
            off('newVideoLike', handleNewLike);
            off('removeVideoLike', handleRemoveLike);
        };
    }, [isConnected, video, myProfile?._id, on, off]);

    const handleLike = async () => {
        if (!video || !myProfile?._id) return;

        try {
            if (isLiked) {
                await api.delete(`/watch/${video._id}/like`);
                setLikesCount(prev => Math.max(0, prev - 1));
                setIsLiked(false);
                emit('removeVideoLike', { videoId: video._id, profileId: myProfile._id });
            } else {
                await api.post(`/watch/${video._id}/like`);
                setLikesCount(prev => prev + 1);
                setIsLiked(true);
                emit('newVideoLike', { videoId: video._id, profileId: myProfile._id });
            }
        } catch (err) {
            console.error('Error handling like:', err);
            Alert.alert('Error', 'Failed to update like');
        }
    };

    const handleComment = async () => {
        if (!commentText.trim() || !video || !myProfile?._id) return;

        try {
            const response = await api.post(`/watch/${video._id}/comment`, {
                content: commentText.trim(),
            });

            if (response.status === 200 || response.status === 201) {
                const newComment = response.data.comment || response.data;
                setComments(prev => [...prev, newComment]);
                setCommentsCount(prev => prev + 1);
                setCommentText('');
                emit('newVideoComment', { videoId: video._id, comment: newComment });
            }
        } catch (err) {
            console.error('Error adding comment:', err);
            Alert.alert('Error', 'Failed to add comment');
        }
    };

    const handleShare = async () => {
        if (!video || !myProfile?._id) return;

        try {
            await api.post(`/watch/${video._id}/share`);
            setSharesCount(prev => prev + 1);
            setShowShareModal(true);
        } catch (err) {
            console.error('Error sharing video:', err);
            Alert.alert('Error', 'Failed to share video');
        }
    };

    const handleFollow = async () => {
        if (!video?.author?._id || !myProfile?._id) return;

        try {
            if (isFollowing) {
                await api.delete(`/user/${video.author._id}/follow`);
                setIsFollowing(false);
            } else {
                await api.post(`/user/${video.author._id}/follow`);
                setIsFollowing(true);
            }
        } catch (err) {
            console.error('Error handling follow:', err);
            Alert.alert('Error', 'Failed to update follow status');
        }
    };

    const togglePlayPause = () => {
        setIsManuallyPaused(!isManuallyPaused);
    };

    const renderVideoPlayer = () => {
        if (!VideoComp) {
            return (
                <View style={{
                    height: SCREEN_HEIGHT,
                    width: SCREEN_WIDTH,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#000',
                }}>
                    <Text style={{ color: '#fff', fontSize: 16, textAlign: 'center' }}>
                        Video player not available
                    </Text>
                    <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center', marginTop: 8, opacity: 0.7 }}>
                        Install react-native-video to enable playback
                    </Text>
                </View>
            );
        }

        const sourceUri = video?.videoUrl || video?.photos;
        if (!sourceUri) {
            return (
                <View style={{
                    height: SCREEN_HEIGHT,
                    width: SCREEN_WIDTH,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: '#000',
                }}>
                    <Text style={{ color: '#fff', fontSize: 16 }}>
                        Video not available
                    </Text>
                </View>
            );
        }

        return (
            <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH, backgroundColor: '#000' }}>
                <VideoComp
                    source={{ uri: sourceUri }}
                    style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }}
                    resizeMode="contain"
                    paused={!isPlaying || isManuallyPaused}
                    playInBackground
                    playWhenInactive
                    ignoreSilentSwitch="ignore"
                    repeat
                    muted={false}
                    useTextureView
                    onError={(err: any) => {
                        console.log('Video error', err);
                    }}
                />
                
                {/* Play/Pause Overlay */}
                <TouchableOpacity
                    onPress={togglePlayPause}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 10,
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    {isManuallyPaused && (
                        <View style={{
                            width: 80,
                            height: 80,
                            borderRadius: 40,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Icon name="play" size={40} color="#fff" />
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderCommentsModal = () => (
        <Modal
            visible={showComments}
            animationType="slide"
            onRequestClose={() => setShowComments(false)}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: themeColors.border.primary,
                }}>
                    <TouchableOpacity
                        onPress={() => setShowComments(false)}
                        style={{ marginRight: 16 }}
                    >
                        <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
                    </TouchableOpacity>
                    <Text style={{ color: themeColors.text.primary, fontSize: 18, fontWeight: '600' }}>
                        Comments ({commentsCount})
                    </Text>
                </View>

                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={{ padding: 16 }}
                >
                    {comments.map(comment => (
                        <View key={comment._id} style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            marginBottom: 16,
                        }}>
                            <UserPP
                                image={comment.author.profilePic}
                                size={32}
                                isActive={false}
                            />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ color: themeColors.text.primary, fontWeight: '600', fontSize: 14 }}>
                                        {comment.author.fullName}
                                    </Text>
                                    <Text style={{ color: themeColors.text.secondary, fontSize: 12, marginLeft: 8 }}>
                                        {moment(comment.createdAt).fromNow()}
                                    </Text>
                                </View>
                                <Text style={{ color: themeColors.text.primary, fontSize: 14, lineHeight: 20 }}>
                                    {comment.content}
                                </Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>

                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
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
                            placeholder="Add a comment..."
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
            </SafeAreaView>
        </Modal>
    );

    const renderShareModal = () => (
        <Modal
            visible={showShareModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowShareModal(false)}
        >
            <TouchableOpacity
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowShareModal(false)}
            >
                <View style={{
                    backgroundColor: themeColors.surface.primary,
                    borderRadius: 20,
                    padding: 20,
                    width: SCREEN_WIDTH * 0.8,
                }}>
                    <Text style={{ color: themeColors.text.primary, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 20 }}>
                        Share Video
                    </Text>
                    <View style={{ gap: 12 }}>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                backgroundColor: themeColors.gray[100],
                                borderRadius: 12,
                            }}
                        >
                            <Icon name="copy" size={24} color={themeColors.primary} />
                            <Text style={{ color: themeColors.text.primary, marginLeft: 12, fontSize: 16 }}>
                                Copy Link
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                backgroundColor: themeColors.gray[100],
                                borderRadius: 12,
                            }}
                        >
                            <Icon name="share-social" size={24} color={themeColors.primary} />
                            <Text style={{ color: themeColors.text.primary, marginLeft: 12, fontSize: 16 }}>
                                Share to Social Media
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                                backgroundColor: themeColors.gray[100],
                                borderRadius: 12,
                            }}
                        >
                            <Icon name="mail" size={24} color={themeColors.primary} />
                            <Text style={{ color: themeColors.text.primary, marginLeft: 12, fontSize: 16 }}>
                                Share via Email
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );

    if (loading || !myProfile) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={{ color: '#fff', marginTop: 16 }}>
                        {!myProfile ? 'Loading user profile...' : 'Loading video...'}
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !video) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <Icon name="alert-circle" size={48} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 18, marginTop: 16, textAlign: 'center' }}>
                        {error || 'Video not found'}
                    </Text>
                    <TouchableOpacity
                        onPress={fetchVideo}
                        style={{
                            backgroundColor: themeColors.primary,
                            paddingHorizontal: 20,
                            paddingVertical: 10,
                            borderRadius: 20,
                            marginTop: 16,
                        }}
                    >
                        <Text style={{ color: '#fff', fontWeight: '600' }}>
                            Try Again
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const authorName = video?.author?.fullName || video?.user?.name || video?.author?.username || video?.user?.username || 'Unknown';
    const authorAvatar = video?.author?.profilePic || video?.user?.avatar || video?.user?.profilePicture || video?.user?.photo || '';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            
            {/* Video Player */}
            {renderVideoPlayer()}

            {/* Header */}
            <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingTop: 16,
                paddingBottom: 8,
            }}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginRight: 16,
                    }}
                >
                    <Icon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 }}>
                    Video
                </Text>
            </View>

            {/* Right Side Actions */}
            <View style={{
                position: 'absolute',
                right: 12,
                bottom: 100,
                alignItems: 'center',
                gap: 20,
            }}>
                <TouchableOpacity
                    onPress={handleLike}
                    style={{ alignItems: 'center' }}
                >
                    <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 4,
                    }}>
                        <Icon 
                            name={isLiked ? "heart" : "heart-outline"} 
                            size={28} 
                            color={isLiked ? "#ff3040" : "#fff"} 
                        />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                        {likesCount > 0 ? likesCount : ''}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setShowComments(true)}
                    style={{ alignItems: 'center' }}
                >
                    <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 4,
                    }}>
                        <Icon name="chatbubble-outline" size={26} color="#fff" />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                        {commentsCount > 0 ? commentsCount : ''}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleShare}
                    style={{ alignItems: 'center' }}
                >
                    <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        marginBottom: 4,
                    }}>
                        <Icon name="share-outline" size={26} color="#fff" />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                        {sharesCount > 0 ? sharesCount : ''}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity style={{ alignItems: 'center' }}>
                    <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}>
                        <Icon name="ellipsis-vertical" size={24} color="#fff" />
                    </View>
                </TouchableOpacity>
            </View>

            {/* Bottom Info */}
            <View style={{
                position: 'absolute',
                left: 12,
                right: 80,
                bottom: 20,
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    {authorAvatar ? (
                        <UserPP size={40} image={authorAvatar} isActive={video?.author?.isActive} />
                    ) : (
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 10,
                        }}>
                            <Icon name="person" size={22} color="#fff" />
                        </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
                            {authorName}
                        </Text>
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>
                            {moment(video.createdAt).fromNow()}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={handleFollow}
                        style={{
                            paddingHorizontal: 16,
                            paddingVertical: 6,
                            borderRadius: 16,
                            backgroundColor: isFollowing ? 'rgba(255,255,255,0.2)' : '#ff3040',
                        }}
                    >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
                            {isFollowing ? 'Following' : 'Follow'}
                        </Text>
                    </TouchableOpacity>
                </View>
                
                {video.caption && (
                    <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20 }}>
                        {video.caption}
                    </Text>
                )}
            </View>

            {/* Comments Modal */}
            {renderCommentsModal()}

            {/* Share Modal */}
            {renderShareModal()}
        </SafeAreaView>
    );
};

export default SingleVideo;

