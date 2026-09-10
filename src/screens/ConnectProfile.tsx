import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, Platform, TouchableOpacity, Modal, RefreshControl, DeviceEventEmitter, Alert, ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { RootState } from '../store'
import { useTheme } from '../contexts/ThemeContext'
import { useSocket } from '../contexts/SocketContext'
import api, { connectAPI } from '../lib/api'
import PostItem from '../components/Post'
import { useNavigation, useRoute } from '@react-navigation/native'
import { hideTabBarForChat } from '../lib/chatScreenChrome'
import ProfileImage from '../components/ProfileImage'
import ImageWithSkeleton from '../components/ImageWithSkeleton'
import ProfileImageWithSkeleton from '../components/ProfileImageWithSkeleton'
import ProfileSkeleton, { ProfileConnectsSkeleton, ProfileMediaSkeleton } from '../components/skeleton/ProfileSkeleton'
import PostSkeleton from '../components/skeleton/PostSkeleton'
import { POST_UPDATED_EVENT } from '../utils/postEvents'
import ConnectCacheManager from '../utils/connectCacheManager'
import VerifiedName from '../components/VerifiedName'
import { ResizeMode, Video as ExpoVideo } from '../lib/avCompat'

function formatMonthYear(dateInput: any): string {
    try {
        const d = dateInput ? new Date(dateInput) : null
        if (!d || isNaN(d.getTime())) return 'Unknown'
        const month = d.toLocaleString('default', { month: 'long' })
        const year = d.getFullYear()
        return `${month} ${year}`
    } catch (_) {
        return 'Unknown'
    }
}

const ProfileVideoCard = ({
    video,
    profileId,
    onDeleted,
    onOpen,
}: {
    video: any;
    profileId?: string;
    onDeleted: (watchId: string) => void;
    onOpen: () => void;
}) => {
    const { colors: themeColors } = useTheme();
    const sourceUri = video?.videoUrl || video?.photos;
    const authorId = String(video?.author?._id || video?.author || '');
    const canDelete = Boolean(profileId && authorId === String(profileId));

    const handleDelete = () => {
        if (!profileId) return;
        Alert.alert('Delete video', 'Are you sure you want to delete this video?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const response = await api.post('/watch/delete', {
                            watchId: video._id,
                            authorId: profileId,
                        });
                        if (response.status === 200) onDeleted(video._id);
                    } catch (error: any) {
                        Alert.alert(
                            'Error',
                            error?.response?.data?.message || 'Failed to delete video',
                        );
                    }
                },
            },
        ]);
    };

    return (
        <View style={[
            styles.profileVideoCard,
            {
                backgroundColor: themeColors.surface.secondary,
                borderColor: themeColors.border.secondary,
            },
        ]}>
            <TouchableOpacity activeOpacity={0.9} onPress={onOpen} style={styles.profileVideoPreview}>
                {sourceUri ? (
                    <ExpoVideo
                        source={{ uri: sourceUri }}
                        style={styles.profileVideo}
                        resizeMode={ResizeMode.CONTAIN}
                        useNativeControls
                        isLooping
                    />
                ) : (
                    <View style={[styles.profileVideoUnavailable, { backgroundColor: themeColors.gray[200] }]}>
                        <Icon name="videocam-off" size={32} color={themeColors.text.secondary} />
                        <Text style={{ color: themeColors.text.secondary }}>Video unavailable</Text>
                    </View>
                )}
            </TouchableOpacity>
            <View style={styles.profileVideoFooter}>
                <Text
                    style={[styles.profileVideoCaption, { color: themeColors.text.primary }]}
                    numberOfLines={2}
                >
                    {video?.caption || 'Video'}
                </Text>
                {canDelete && (
                    <TouchableOpacity onPress={handleDelete} hitSlop={10}>
                        <Icon name="delete-outline" size={22} color={themeColors.status.error} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
};

type TabKey = 'Posts' | 'About' | 'Connects' | 'Images' | 'Videos'

interface ConnectProfileRouteParams {
    connectId: string;
    connectData?: any;
}

const ConnectProfile = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { connectId, connectData: initialConnectData } = route.params as ConnectProfileRouteParams;
    const { colors: themeColors } = useTheme();
    
    const myProfile = useSelector((state: RootState) => state.profile)
    const [activeTab, setActiveTab] = React.useState<TabKey>('About')
    const { width } = useWindowDimensions()

    const isSmall = width < 380
    const avatarSize = isSmall ? 120 : 170
    const coverHeight = isSmall ? 240 : 280
    const infoOverlap = -Math.round(avatarSize / 3)

    const [connectData, setConnectData] = React.useState<any>(initialConnectData || {})
    const [isLoading, setIsLoading] = React.useState<boolean>(!initialConnectData)
    const [isConnect, setIsConnect] = React.useState<boolean>(false)
    const [connectStatus, setConnectStatus] = React.useState<'none' | 'incoming' | 'outgoing' | 'connects'>('none')
    const { on, off } = useSocket();
    const [refreshing, setRefreshing] = React.useState<boolean>(false)
    const [connectActionLoading, setConnectActionLoading] = React.useState<string | null>(null)
    const [messageLoading, setMessageLoading] = React.useState(false)

    const connectsCount = Array.isArray(connectData?.connects ?? connectData?.friends)
        ? (connectData.connects ?? connectData.friends).length
        : 0
    const followersCount = connectData?.followersCount ?? connectData?.followers?.length ?? 0
    const followingCount = connectData?.followingCount ?? connectData?.following?.length ?? 0

    const [posts, setPosts] = React.useState<any[]>([])
    const [postsLoading, setPostsLoading] = React.useState<boolean>(false)
    const [images, setImages] = React.useState<string[]>([])
    const [imagesLoading, setImagesLoading] = React.useState<boolean>(true)
    const [imageViewerOpen, setImageViewerOpen] = React.useState(false)
    const [imageViewerIndex, setImageViewerIndex] = React.useState(0)
    const [connects, setConnects] = React.useState<any[]>([])
    const [connectsLoading, setConnectsLoading] = React.useState<boolean>(false)
    const [videos, setVideos] = React.useState<any[]>([])
    const [videosLoading, setVideosLoading] = React.useState<boolean>(false)
    const [showFullBio, setShowFullBio] = React.useState<boolean>(false)
    const fetchRequestRef = React.useRef(0);

    const fetchConnectData = React.useCallback(async () => {
        if (!connectId) return;
        const requestId = ++fetchRequestRef.current;
        
        setIsLoading(true);
        setPostsLoading(true);
        setConnectsLoading(true);
        setVideosLoading(true);
        setPosts([]);
        setConnects([]);
        setVideos([]);
        
        try {
            const [profileRes, postsRes, connectsRes, videosRes] = await Promise.all([
                api.get('/profile', { params: { profileId: connectId } }),
                api.get('/post/myPosts', { params: { profile: connectId } }),
                api.get('/connects/getConnects', { params: { profile: connectId } }),
                api.get('/watch/profileWatch', { params: { profile: connectId, pageNumber: 1 } })
            ]);
            if (requestId !== fetchRequestRef.current) return;
            
            if (profileRes.status === 200) {
                setConnectData(profileRes.data);
                // Check if this connect is in my connects list
                const myConnects = myProfile?.connects ?? myProfile?.friends;
                if (myConnects) {
                    const isInConnectsList = myConnects.some((f: any) =>
                        String(f?._id || f) === String(connectId),
                    );
                    setIsConnect(isInConnectsList);
                    if (isInConnectsList) setConnectStatus('connects');
                }
            }
            
            if (postsRes.status === 200) {
                setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
            }
            
            if (connectsRes.status === 200) {
                const arr = Array.isArray(connectsRes.data) ? connectsRes.data : [];
                setConnects(arr.length ? arr : []);
            }
            
            if (videosRes.status === 200) {
                const data = videosRes.data.watchs || videosRes.data || [];
                const targetId = String(connectId);
                setVideos(
                    Array.isArray(data)
                        ? data.filter(
                            (video: any) =>
                                String(video?.author?._id || video?.author || '') === targetId,
                        )
                        : [],
                );
            }
        } catch (err) {
            if (requestId !== fetchRequestRef.current) return;
            console.error('Error fetching connect data:', err);
            setPosts([]);
            setConnects([]);
            setVideos([]);
        } finally {
            if (requestId !== fetchRequestRef.current) return;
            setIsLoading(false);
            setPostsLoading(false);
            setConnectsLoading(false);
            setVideosLoading(false);
        }
    }, [connectId, myProfile?.connects, myProfile?.friends]);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await fetchConnectData();
        setRefreshing(false);
    }, [fetchConnectData]);

    const handlePostDeleted = (postId: string) => {
        setPosts((prev: any[]) => prev.filter(post => post._id !== postId));
    };

    const handlePostUpdated = React.useCallback((updatedPost: any) => {
        if (!updatedPost?._id) return;
        setPosts((prev: any[]) =>
            prev.map((post) => (post?._id === updatedPost._id ? { ...post, ...updatedPost } : post)),
        );
    }, []);

    const renderPosts = () => (
        <View style={{ gap: 10 }}>
            {postsLoading && <PostSkeleton count={2} />}
            {!postsLoading && posts.length === 0 && (
                <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                    <Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No posts yet.</Text>
                </View>
            )}
            {!postsLoading && posts.map((post: any) => (
                <PostItem
                    key={post._id}
                    data={post}
                    onPostDeleted={handlePostDeleted}
                    onPostUpdated={handlePostUpdated}
                />
            ))}
        </View>
    );

    React.useEffect(() => {
        const sub = DeviceEventEmitter.addListener(POST_UPDATED_EVENT, handlePostUpdated);
        return () => sub.remove();
    }, [handlePostUpdated]);

    // Fetch connect profile data
    React.useEffect(() => {
        let isMounted = true;
        
        if (isMounted) {
            fetchConnectData();
        }
        
        return () => {
            isMounted = false;
        };
    }, [fetchConnectData]);

    // Check connect request status
    React.useEffect(() => {
        let isMounted = true;
        
        if (!connectId || !myProfile?._id) return;
        
        const updateStatus = async () => {
            try {
                const [incomingRes, profileRes] = await Promise.all([
                    connectAPI.getConnectRequest(myProfile._id),
                    api.get('/profile', { params: { profileId: connectId } }),
                ]);
                if (!isMounted) return;
                const incoming = Array.isArray(incomingRes.data) &&
                    incomingRes.data.some((req: any) => String(req?._id) === String(connectId));
                const targetProfile = profileRes.data;
                const outgoing = Array.isArray(targetProfile?.connectReqs) &&
                    targetProfile.connectReqs.some((id: any) => String(id?._id || id) === String(myProfile._id));
                const myConnects = myProfile.connects ?? myProfile.friends;
                const isInConnectsList = Array.isArray(myConnects) &&
                    myConnects.some((f: any) => String(f?._id || f) === String(connectId));
                setIsConnect(isInConnectsList);
                setConnectStatus(isInConnectsList ? 'connects' : incoming ? 'incoming' : outgoing ? 'outgoing' : 'none');
            } catch (error) {
                console.error('Error checking connect request status:', error);
            }
        };
        updateStatus();
            
        return () => {
            isMounted = false;
        };
    }, [connectId, myProfile?._id]);

    React.useEffect(() => {
        const handleRelationshipUpdate = (data: any) => {
            if (
                String(data?.targetId) !== String(connectId) &&
                String(data?.actorId) !== String(connectId)
            ) return;
            if (data.status === 'connects') {
                setIsConnect(true);
                setConnectStatus('connects');
            } else if (data.status === 'incoming') {
                setConnectStatus(String(data.actorId) === String(myProfile?._id) ? 'outgoing' : 'incoming');
            } else if (data.status === 'none') {
                setIsConnect(false);
                setConnectStatus('none');
            }
        };
        on('connectRelationshipUpdate', handleRelationshipUpdate);
        return () => off('connectRelationshipUpdate', handleRelationshipUpdate);
    }, [connectId, myProfile?._id, on, off]);

    // Fetch images directly from profile endpoint
    React.useEffect(() => {
        if (!connectId) return
        
        let isMounted = true;
        
        const fetchImages = async () => {
            setImagesLoading(true);
            try {
                const res = await api.get('/profile/getImages', { params: { profileId: connectId } });
                if (isMounted && res.status === 200 && Array.isArray(res.data)) {
                    const imgs = res.data
                        .filter((p: any) => p?.photos)
                        .map((p: any) => p.photos);
                    setImages(imgs);
                } else if (isMounted) {
                    // Fallback to posts if no direct images endpoint
                    const derived = posts.filter((p: any) => p?.photos).map((p: any) => p.photos);
                    setImages(derived);
                }
            } catch (error) {
                if (isMounted) {
                    // Fallback to posts if API fails
                    const derived = posts.filter((p: any) => p?.photos).map((p: any) => p.photos);
                    setImages(derived);
                }
            } finally {
                if (isMounted) setImagesLoading(false);
            }
        };
        
        fetchImages();
        
        return () => {
            isMounted = false;
        };
    }, [connectId, posts.length]); // Only depend on posts.length, not the entire posts array

    const handleSendConnectRequest = async () => {
        if (!connectId || !myProfile?._id) return;
        if (connectActionLoading) return;
        setConnectActionLoading('send');
        
        try {
            await connectAPI.sendConnectRequest(connectId);
            setConnectStatus('outgoing');
            await ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', connectId);
        } catch (error) {
            console.error('Error sending connect request:', error);
        } finally {
            setConnectActionLoading(null);
        }
    };

    const handleAcceptConnectRequest = async () => {
        if (!connectId || !myProfile?._id) return;
        if (connectActionLoading) return;
        setConnectActionLoading('accept');
        
        try {
            await connectAPI.acceptConnectRequest(connectId);
            setConnectStatus('connects');
            setIsConnect(true);
            await Promise.all([
                ConnectCacheManager.removeProfile(myProfile._id, 'requests', connectId),
                ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', connectId),
            ]);
        } catch (error) {
            console.error('Error accepting connect request:', error);
        } finally {
            setConnectActionLoading(null);
        }
    };

    const handleCancelConnectRequest = async () => {
        if (!connectId || !myProfile?._id) return;
        if (connectActionLoading) return;
        setConnectActionLoading('cancel');
        try {
            await connectAPI.cancelConnectRequest(connectId);
            setConnectStatus('none');
            await ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', connectId);
        } catch (error) {
            console.error('Error cancelling connect request:', error);
        } finally {
            setConnectActionLoading(null);
        }
    };

    const handleDisconnect = async () => {
        if (!connectId || !myProfile?._id) return;
        if (connectActionLoading) return;
        setConnectActionLoading('disconnect');
        
        try {
            await connectAPI.disconnect(connectId);
            setConnectStatus('none');
            setIsConnect(false);
            await ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', connectId);
        } catch (error) {
            console.error('Error disconnecting:', error);
        } finally {
            setConnectActionLoading(null);
        }
    };

    const getConnectButton = () => {
        switch (connectStatus) {
            case 'connects':
                return (
                    <Pressable style={[styles.button, styles.removeButton]} onPress={handleDisconnect} disabled={Boolean(connectActionLoading)}>
                        {connectActionLoading === 'disconnect' ? <ActivityIndicator size="small" color={themeColors.text.inverse} /> : <><Icon name="person-remove" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Disconnect</Text></>}
                    </Pressable>
                );
            case 'incoming':
                return (
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleAcceptConnectRequest} disabled={Boolean(connectActionLoading)}>
                        {connectActionLoading === 'accept' ? <ActivityIndicator size="small" color={themeColors.text.inverse} /> : <><Icon name="check" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Accept Request</Text></>}
                    </Pressable>
                );
            case 'outgoing':
                return (
                    <Pressable style={[styles.button, styles.removeButton]} onPress={handleCancelConnectRequest} disabled={Boolean(connectActionLoading)}>
                        {connectActionLoading === 'cancel' ? <ActivityIndicator size="small" color={themeColors.text.inverse} /> : <><Icon name="cancel" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Cancel Request</Text></>}
                    </Pressable>
                );
            default:
                return (
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSendConnectRequest} disabled={Boolean(connectActionLoading)}>
                        {connectActionLoading === 'send' ? <ActivityIndicator size="small" color={themeColors.text.inverse} /> : <><Icon name="person-add" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Add Connect</Text></>}
                    </Pressable>
                );
        }
    };

    const tabs: { key: TabKey; label: string; count?: number; render: () => React.ReactNode }[] = [
        {
            key: 'About',
            label: 'About',
            render: () => (
                <>
                    <View style={[styles.detailsCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary, marginBottom: 10 }]}>

                    {connectData?.bio && (
                        <View style={styles.detailsItem}>
                            <Icon name="info" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{connectData.bio}</Text>
                            </Text>
                        </View>
                    )}


                    {Array.isArray(connectData?.workPlaces) && connectData.workPlaces.map((wp: any, idx: number) => (
                        <View key={`wp-${idx}`} style={styles.detailsItem}>
                            <Icon name="work" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                <Text>{wp?.designation ? `${wp.designation} at ` : ''}</Text>
                                <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{wp?.name || 'Unknown workplace'}</Text>
                            </Text>
                        </View>
                    ))}


                    {Array.isArray(connectData?.schools) && connectData.schools.map((sc: any, idx: number) => (
                        <View key={`sc-${idx}`} style={styles.detailsItem}>
                            <Icon name="school" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                Studied at <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{sc?.name || 'Unknown school'}</Text>
                                {sc?.degree ? <Text style={[styles.detailsMuted, { color: themeColors.text.tertiary }]}> ({sc.degree})</Text> : null}
                            </Text>
                        </View>
                    ))}


                    {!!connectData?.presentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="home" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                Lives in <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{connectData.presentAddress}</Text>
                            </Text>
                        </View>
                    )}


                    {!!connectData?.permanentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="public" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                From <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{connectData.permanentAddress}</Text>
                            </Text>
                        </View>
                    )}


                    <View style={styles.detailsItem}>
                        <Icon name="schedule" size={20} color={themeColors.text.secondary} />
                        <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                            Joined <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{formatMonthYear(connectData?.user?.createdAt || connectData?.createdAt)}</Text>
                        </Text>
                    </View>
                    </View>
                    {renderPosts()}
                </>
            )
        },
        {
            key: 'Posts',
            label: 'Posts',
            count: posts.length || undefined,
            render: renderPosts
        },
        {
            key: 'Connects',
            label: 'Connects',
            count: (connects.length || connectsCount) || undefined,
            render: () => (
                <View style={{ gap: 10 }}>
                    {connectsLoading && (
                        <ProfileConnectsSkeleton count={4} />
                    )}
                    {!connectsLoading && connects.length === 0 && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No connects found.</Text></View>
                    )}
                    {!connectsLoading && connects.length > 0 && (
                        <View style={styles.connectsGrid}>
                            {connects.map((f: any) => {
                                const userName = f.fullName || (f.user ? `${f.user.firstName || ''} ${f.user.surname || ''}`.trim() : f.username) || 'Unknown'
                                const pp = f.profilePic || (f.user && f.user.profilePic)
                                return (
                                    <TouchableOpacity 
                                        key={f._id || userName} 
                                        style={[styles.connectItem, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}
                                        onPress={() => {
                                            (navigation as any).navigate('Message', {
                                                screen: 'ConnectProfile',
                                                params: { connectId: f._id, connectData: f }
                                            });
                                        }}
                                    >
                                        <View style={[styles.connectAvatarWrap, { backgroundColor: themeColors.surface.secondary }]}>
                                            {pp ? (
                                                <ProfileImage uri={pp} pixelSize={120} style={styles.connectAvatar} />
                                            ) : (
                                                <View style={[styles.connectAvatar, { backgroundColor: themeColors.gray[400] }]} />
                                            )}
                                        </View>
                                        <Text style={[styles.connectName, { color: themeColors.text.primary }]} numberOfLines={1}>{userName}</Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    )}
                </View>
            )
        },
        {
            key: 'Images',
            label: 'Images',
            count: images.length || undefined,
            render: () => (
                <View>
                    {imagesLoading ? (
                        <ProfileMediaSkeleton count={2} />
                    ) : images.length === 0 ? (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No images found.</Text></View>
                    ) : (
                        <View>
                            {images.map((uri, idx) => (
                                <TouchableOpacity key={uri + idx} onPress={() => { setImageViewerIndex(idx); setImageViewerOpen(true); }}>
                                    <View style={[styles.mediaCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                                        <Image source={{ uri }} style={styles.mediaImage} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Modal visible={imageViewerOpen} transparent animationType="fade" onRequestClose={() => setImageViewerOpen(false)}>
                        <View style={styles.viewerOverlay}>
                            <TouchableOpacity style={styles.viewerClose} onPress={() => setImageViewerOpen(false)}>
                                <Icon name="close" size={24} color={themeColors.text.secondary} />
                            </TouchableOpacity>
                            <View style={styles.viewerContent}>
                                <TouchableOpacity style={styles.viewerNavLeft} onPress={() => setImageViewerIndex(i => Math.max(0, i - 1))}>
                                    <Icon name="chevron-left" size={28} color={themeColors.text.secondary} />
                                </TouchableOpacity>
                                <Image source={{ uri: images[imageViewerIndex] }} style={styles.mediaImage} />
                                <TouchableOpacity style={styles.viewerNavRight} onPress={() => setImageViewerIndex(i => Math.min(images.length - 1, i + 1))}>
                                    <Icon name="chevron-right" size={28} color={themeColors.text.secondary} />
                                </TouchableOpacity>
                            </View>
                            <Text style={[styles.viewerCounter, { color: themeColors.text.primary }]}>{imageViewerIndex + 1} / {images.length}</Text>
                        </View>
                    </Modal>
                </View>
            )
        },
        {
            key: 'Videos',
            label: 'Videos',
            count: videos.length || undefined,
            render: () => (
                <View>
                    {videosLoading && (
                        <ProfileMediaSkeleton count={2} />
                    )}
                    {!videosLoading && videos.length === 0 && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No videos found.</Text></View>
                    )}
                    {!videosLoading && videos.length > 0 && (
                        <View>
                            {videos.map((video: any) => (
                                <ProfileVideoCard
                                    key={video._id}
                                    video={video}
                                    profileId={myProfile?._id}
                                    onOpen={() => (navigation as any).navigate('SingleWatch', { watchId: video._id })}
                                    onDeleted={watchId => setVideos(prev => prev.filter(item => item._id !== watchId))}
                                />
                            ))}
                        </View>
                    )}
                </View>
            )
        }
    ]

    if (isLoading) {
        return <ProfileSkeleton showBackHeader />;
    }

    return (
        <ScrollView 
            style={[styles.container, { backgroundColor: themeColors.background.primary }]} 
            contentContainerStyle={styles.contentContainer}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[themeColors.primary]}
                    tintColor={themeColors.primary}
                />
            }
        >

            <View style={[styles.header, { backgroundColor: themeColors.surface.header, borderBottomColor: themeColors.border.secondary }]}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={24} color={themeColors.text.primary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: themeColors.text.primary }]}>Profile</Text>

            </View>
            

            
            <View style={[styles.profileHeader, { backgroundColor: themeColors.surface.header }]}>
                <View style={[styles.coverContainer, { backgroundColor: themeColors.gray[200] }]}>
                    {connectData?.coverPic ? (
                        <ImageWithSkeleton source={{ uri: connectData.coverPic }} style={[styles.cover, { height: coverHeight }]} />
                    ) : (
                        <View style={[styles.cover, styles.coverPlaceholder, { height: coverHeight, backgroundColor: themeColors.gray[200] }]} />
                    )}
                </View>

                <View style={[styles.profileInfoContainer, { marginTop: infoOverlap, borderBottomColor: themeColors.border.secondary }]} pointerEvents="box-none">
                    <View style={[styles.profilePicSection, { height: avatarSize, width: avatarSize }]}>
                        <View style={[
                            styles.avatarWrapper,
                            { height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2, borderColor: themeColors.gray[400], backgroundColor: themeColors.surface.secondary },
                            connectData?.hasStory ? styles.avatarWithStory : undefined
                        ]}>
                            {connectData?.profilePic ? (
                                <ProfileImageWithSkeleton uri={connectData.profilePic} pixelSize={400} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.gray[300] }]} />
                            )}
                        </View>
                    </View>

                    <View style={styles.profileInfo}>
                        <View style={styles.profileNameBlock}>
                        <VerifiedName
                            name={connectData?.fullName || 'Connect Profile'}
                            verified={connectData?.isVerified}
                            verifiedColor={themeColors.primary}
                            textStyle={[styles.fullName, isSmall ? { fontSize: 20 } : null, { color: themeColors.text.primary }]}
                            numberOfLines={2}
                        />
                            {connectsCount > 0 ? (
                                <Text style={[styles.connectsCount, { color: themeColors.text.secondary }]}>{connectsCount} connects</Text>
                            ) : null}
                            <View style={styles.followStats}>
                                <Text style={[styles.connectsCount, styles.followStat, { color: themeColors.text.secondary }]}>
                                    {followersCount} followers
                                </Text>
                                <Text style={[styles.connectsCount, styles.followStat, { color: themeColors.text.secondary }]}>
                                    {followingCount} following
                                </Text>
                            </View>
                        </View>


                        <View style={[styles.bioSection, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                            {connectData?.bio ? (
                                <>
                                    <Text style={[styles.bioText, { color: themeColors.text.primary }]} numberOfLines={showFullBio ? undefined : 3}>
                                        {connectData.bio}
                                    </Text>
                                    {connectData.bio.length > 100 && (
                                        <TouchableOpacity 
                                            style={[styles.bioToggleButton, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}
                                            onPress={() => setShowFullBio(!showFullBio)}
                                        >
                                            <Text style={[styles.bioToggleText, { color: themeColors.text.secondary }]}>
                                                {showFullBio ? 'Show Less' : 'Show More'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            ) : (
                                <Text style={[styles.bioPlaceholder, { color: themeColors.text.tertiary }]}>
                                    No bio added yet
                                </Text>
                            )}
                        </View>

                        <View style={styles.profileButtons}>
                            {getConnectButton()}
                            <Pressable style={[styles.button, styles.secondaryButton, { backgroundColor: themeColors.surface.secondary }]} onPress={() => {
                                setMessageLoading(true);
                                hideTabBarForChat(navigation as any);
                                (navigation as any).navigate('Message', { 
                                    screen: 'SingleMessage',
                                    params: { connect: connectData }
                                });
                            }} disabled={messageLoading}>
                                {messageLoading ? <ActivityIndicator size="small" color={themeColors.text.secondary} /> : <><Icon name="message" size={18} color={themeColors.text.secondary} />
                                <Text style={[styles.buttonText, { color: themeColors.text.secondary }]}>Message</Text></>}
                            </Pressable>
                        </View>
                    </View>
                </View>

                <View style={styles.tabRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabNavigator}>
                        {tabs.map(({ key, label, count }) => (
                            <Pressable key={key} onPress={() => setActiveTab(key)} style={[styles.tabItem, activeTab === key && [styles.activeTabItem, { backgroundColor: themeColors.surface.secondary }]]}>
                                <View style={styles.tabLabelRow}>
                                    <Text style={[styles.tabText, { color: themeColors.text.primary }, activeTab === key && styles.activeTabText]}>{label}</Text>
                                    {typeof count === 'number' && count > 0 && (
                                        <View style={[styles.countBadge, { backgroundColor: themeColors.surface.secondary }]}>
                                            <Text style={[styles.countBadgeText, { color: themeColors.text.secondary }]}>{count}</Text>
                                        </View>
                                    )}
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                    <View style={[styles.optionsMenu, { backgroundColor: themeColors.surface.secondary }]}><Icon name="more-horiz" size={22} color={themeColors.text.secondary} /></View>
                </View>
            </View>

            <View style={styles.profileContentContainer}>
                {tabs.find(t => t.key === activeTab)?.render()}
            </View>
        </ScrollView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingBottom: 104,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    backButton: {
        padding: 8,
        marginRight: 12,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
    },

    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    profileHeader: {
        marginBottom: 15,
    },
    coverContainer: {
        width: '100%',
        overflow: 'hidden',
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        position: 'relative',
    },
    cover: {
        width: '100%',
        height: 220,
    },
    coverPlaceholder: {
        // backgroundColor will be set dynamically
    },
    profileInfoContainer: {
        width: '94%',
        alignSelf: 'center',
        borderBottomWidth: 1,
        paddingBottom: 20,
        flexDirection: 'column',
        alignItems: 'center',
    },
    profilePicSection: {
        position: 'relative',
        height: 190,
        width: 170,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarWrapper: {
        height: 170,
        width: 170,
        borderRadius: 85,
        overflow: 'hidden',
        borderWidth: 3.5,
        marginBottom: 20,
    },
    avatarWithStory: {
        borderColor: '#5D93EB',
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        flex: 1,
    },
    profileInfo: {
        marginLeft: -20,
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    profileNameBlock: {
        flexDirection: 'column',
        marginTop: 10,
    },
    fullName: {
        fontWeight: 'bold',
        fontSize: 22,
        textTransform: 'capitalize',
    },
    connectsCount: {
        marginTop: 4,
        textAlign: 'center',
    },
    followStats: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 4,
    },
    followStat: {
        marginHorizontal: 6,
    },
    profileButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: 10
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 6,
        marginLeft: 6,
    },
    primaryButton: {
        backgroundColor: '#29b1a9', // This will be overridden dynamically
    },
    secondaryButton: {
        // backgroundColor will be set dynamically
    },
    removeButton: {
        backgroundColor: '#E74C3C',
    },
    buttonText: {
        marginLeft: 6,
        fontWeight: '600',
    },
    tabNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 8,
        paddingTop: 2,
    },
    tabRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
    },
    tabItem: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginRight: 6,
        borderRadius: 6,
    },
    tabLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activeTabItem: {
        borderRadius: 10,
    },
    tabText: {
        // color will be set dynamically
    },
    activeTabText: {
        fontWeight: '700',
    },
    countBadge: {
        marginLeft: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countBadgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    optionsMenu: {
        marginLeft: 'auto',
        padding: 8,
        borderRadius: 6,
    },
    profileContentContainer: {
        padding: 8,
        gap: 0,
    },
    placeholderCard: {
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        // backgroundColor and borderColor will be set dynamically
    },
    detailsCard: {
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        gap: 12,
        // backgroundColor and borderColor will be set dynamically
    },
    detailsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    detailsText: {
        flexShrink: 1,
        // color will be set dynamically
    },
    detailsStrong: {
        fontWeight: '700',
        // color will be set dynamically
    },
    detailsMuted: {
        // color will be set dynamically
    },
    connectsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    connectItem: {
        width: '48%',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        alignItems: 'center',
        // backgroundColor and borderColor will be set dynamically
    },
    connectAvatarWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        marginBottom: 8,
        // backgroundColor will be set dynamically
    },
    connectAvatar: {
        width: '100%',
        height: '100%',
    },
    connectName: {
        fontWeight: '600',
        // color will be set dynamically
    },
    mediaCard: {
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
        // backgroundColor and borderColor will be set dynamically
    },
    mediaImage: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#000',
    },
    profileVideoCard: {
        borderRadius: 10,
        borderWidth: 1,
        marginBottom: 12,
        overflow: 'hidden',
    },
    profileVideoPreview: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
    },
    profileVideo: {
        width: '100%',
        height: '100%',
    },
    profileVideoUnavailable: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    profileVideoFooter: {
        minHeight: 52,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    profileVideoCaption: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
    viewerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 12,
    },
    viewerClose: {
        position: 'absolute',
        top: 30,
        right: 20,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
    },
    viewerContent: {
        width: '100%',
        height: '70%',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    viewerNavLeft: {
        padding: 10,
    },
    viewerNavRight: {
        padding: 10,
    },
    viewerImage: {
        width: '80%',
        height: '100%',
        resizeMode: 'contain',
    },
    viewerCounter: {
        position: 'absolute',
        bottom: 20,
        // color will be set dynamically
    },
    playBadge: {
        position: 'absolute',
        right: 6,
        bottom: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
        borderRadius: 12,
        padding: 2,
    },
    placeholderText: {
        // color will be set dynamically
    },
    bioSection: {
        marginTop: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        width: '100%',
        alignSelf: 'center',
        minHeight: 60,
    },
    bioText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        // color will be set dynamically
    },
    bioPlaceholder: {
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
        // color will be set dynamically
    },
    bioToggleButton: {
        marginTop: 8,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
        borderWidth: 1,
    },
    bioToggleText: {
        fontSize: 12,
        fontWeight: '600',
        // color will be set dynamically
    },
})

export default ConnectProfile;
