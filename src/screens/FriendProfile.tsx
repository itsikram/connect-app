import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Platform, TouchableOpacity, Modal, RefreshControl } from 'react-native'
import { useSelector } from 'react-redux'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { RootState } from '../store'
import { useTheme } from '../contexts/ThemeContext'
import api, { friendAPI } from '../lib/api'
import PostItem from '../components/Post'
import { useNavigation, useRoute } from '@react-navigation/native'

function formatMonthYear(dateInput: any): string {
    try {
        const d = dateInput ? new Date(dateInput) : null
        if (!d || isNaN(d as unknown as number)) return 'Unknown'
        const month = d.toLocaleString('default', { month: 'long' })
        const year = d.getFullYear()
        return `${month} ${year}`
    } catch (_) {
        return 'Unknown'
    }
}

type TabKey = 'Posts' | 'About' | 'Friends' | 'Images' | 'Videos'

interface FriendProfileRouteParams {
    friendId: string;
    friendData?: any;
}

const FriendProfile = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { friendId, friendData: initialFriendData } = route.params as FriendProfileRouteParams;
    const { colors: themeColors } = useTheme();
    
    const myProfile = useSelector((state: RootState) => state.profile)
    const [activeTab, setActiveTab] = React.useState<TabKey>('About')
    const { width } = useWindowDimensions()

    const isSmall = width < 380
    const avatarSize = isSmall ? 120 : 170
    const coverHeight = isSmall ? 240 : 280
    const infoOverlap = -Math.round(avatarSize / 3)

    const [friendData, setFriendData] = React.useState<any>(initialFriendData || {})
    const [isLoading, setIsLoading] = React.useState<boolean>(!initialFriendData)
    const [isFriend, setIsFriend] = React.useState<boolean>(false)
    const [friendStatus, setFriendStatus] = React.useState<'none' | 'pending' | 'friends'>('none')
    const [refreshing, setRefreshing] = React.useState<boolean>(false)

    const friendsCount = Array.isArray(friendData?.friends) ? friendData.friends.length : 0

    const [posts, setPosts] = React.useState<any[]>([])
    const [postsLoading, setPostsLoading] = React.useState<boolean>(false)
    const [images, setImages] = React.useState<string[]>([])
    const [imageViewerOpen, setImageViewerOpen] = React.useState(false)
    const [imageViewerIndex, setImageViewerIndex] = React.useState(0)
    const [friends, setFriends] = React.useState<any[]>([])
    const [friendsLoading, setFriendsLoading] = React.useState<boolean>(false)
    const [videos, setVideos] = React.useState<any[]>([])
    const [videosLoading, setVideosLoading] = React.useState<boolean>(false)
    const [showFullBio, setShowFullBio] = React.useState<boolean>(false)

    const fetchFriendData = React.useCallback(async () => {
        if (!friendId) return;
        
        setIsLoading(true);
        setPostsLoading(true);
        setFriendsLoading(true);
        setVideosLoading(true);
        
        try {
            const [profileRes, postsRes, friendsRes, videosRes] = await Promise.all([
                api.get('/profile', { params: { profileId: friendId } }),
                api.get('/post/myPosts', { params: { profile: friendId } }),
                api.get('/friend/getFriends', { params: { profile: friendId } }),
                api.get('/watch/profileWatch', { params: { profile: friendId, pageNumber: 1 } })
            ]);
            
            if (profileRes.status === 200) {
                setFriendData(profileRes.data);
                // Check if this friend is in my friends list
                if (myProfile?.friends) {
                    const isInFriendsList = myProfile.friends.some((f: any) => f._id === friendId);
                    setIsFriend(isInFriendsList);
                    setFriendStatus(isInFriendsList ? 'friends' : 'none');
                }
            }
            
            if (postsRes.status === 200) {
                setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
            }
            
            if (friendsRes.status === 200) {
                const arr = Array.isArray(friendsRes.data) ? friendsRes.data : [];
                setFriends(arr.length ? arr : []);
            }
            
            if (videosRes.status === 200) {
                const data = videosRes.data.watchs || videosRes.data || [];
                setVideos(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Error fetching friend data:', err);
        } finally {
            setIsLoading(false);
            setPostsLoading(false);
            setFriendsLoading(false);
            setVideosLoading(false);
        }
    }, [friendId, myProfile?.friends]);

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await fetchFriendData();
        setRefreshing(false);
    }, [fetchFriendData]);

    const handlePostDeleted = (postId: string) => {
        setPosts((prev: any[]) => prev.filter(post => post._id !== postId));
    };

    // Fetch friend profile data
    React.useEffect(() => {
        let isMounted = true;
        
        if (isMounted) {
            fetchFriendData();
        }
        
        return () => {
            isMounted = false;
        };
    }, [fetchFriendData]);

    // Check friend request status
    React.useEffect(() => {
        let isMounted = true;
        
        if (!friendId || !myProfile?._id) return;
        
        // Check if there's a pending friend request
        friendAPI.getFriendRequest(myProfile._id)
            .then(res => {
                if (isMounted && res.status === 200 && Array.isArray(res.data)) {
                    const hasPendingRequest = res.data.some((req: any) => req._id === friendId);
                    if (hasPendingRequest) {
                        setFriendStatus('pending');
                    }
                }
            })
            .catch(() => {});
            
        return () => {
            isMounted = false;
        };
    }, [friendId, myProfile?._id]);

    // Fetch images directly from profile endpoint
    React.useEffect(() => {
        if (!friendId) return
        
        let isMounted = true;
        
        const fetchImages = async () => {
            try {
                const res = await api.get('/profile/getImages', { params: { profileId: friendId } });
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
            }
        };
        
        fetchImages();
        
        return () => {
            isMounted = false;
        };
    }, [friendId, posts.length]); // Only depend on posts.length, not the entire posts array

    const handleSendFriendRequest = async () => {
        if (!friendId || !myProfile?._id) return;
        
        try {
            await friendAPI.sendFriendRequest(friendId);
            setFriendStatus('pending');
        } catch (error) {
            console.error('Error sending friend request:', error);
        }
    };

    const handleAcceptFriendRequest = async () => {
        if (!friendId || !myProfile?._id) return;
        
        try {
            await friendAPI.acceptFriendRequest(friendId);
            setFriendStatus('friends');
            setIsFriend(true);
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    };

    const handleRemoveFriend = async () => {
        if (!friendId || !myProfile?._id) return;
        
        try {
            await friendAPI.removeFriend(friendId);
            setFriendStatus('none');
            setIsFriend(false);
        } catch (error) {
            console.error('Error removing friend:', error);
        }
    };

    const getFriendButton = () => {
        switch (friendStatus) {
            case 'friends':
                return (
                    <Pressable style={[styles.button, styles.removeButton]} onPress={handleRemoveFriend}>
                        <Icon name="person-remove" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Remove Friend</Text>
                    </Pressable>
                );
            case 'pending':
                return (
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleAcceptFriendRequest}>
                        <Icon name="check" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Accept Request</Text>
                    </Pressable>
                );
            default:
                return (
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSendFriendRequest}>
                        <Icon name="person-add" size={18} color={themeColors.text.inverse} />
                        <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Add Friend</Text>
                    </Pressable>
                );
        }
    };

    const tabs: { key: TabKey; label: string; count?: number; render: () => React.ReactNode }[] = [
        {
            key: 'About',
            label: 'About',
            render: () => (
                <View style={[styles.detailsCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                    {/* Bio */}
                    {friendData?.bio && (
                        <View style={styles.detailsItem}>
                            <Icon name="info" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{friendData.bio}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Workplaces */}
                    {Array.isArray(friendData?.workPlaces) && friendData.workPlaces.map((wp: any, idx: number) => (
                        <View key={`wp-${idx}`} style={styles.detailsItem}>
                            <Icon name="work" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                {wp?.designation ? `${wp.designation} at ` : ''}
                                <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{wp?.name || 'Unknown workplace'}</Text>
                            </Text>
                        </View>
                    ))}

                    {/* Schools */}
                    {Array.isArray(friendData?.schools) && friendData.schools.map((sc: any, idx: number) => (
                        <View key={`sc-${idx}`} style={styles.detailsItem}>
                            <Icon name="school" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                Studied at <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{sc?.name || 'Unknown school'}</Text>
                                {sc?.degree ? <Text style={[styles.detailsMuted, { color: themeColors.text.tertiary }]}> ({sc.degree})</Text> : null}
                            </Text>
                        </View>
                    ))}

                    {/* Present address */}
                    {!!friendData?.presentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="home" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                Lives in <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{friendData.presentAddress}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Permanent address */}
                    {!!friendData?.permanentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="public" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                From <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{friendData.permanentAddress}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Joined */}
                    <View style={styles.detailsItem}>
                        <Icon name="schedule" size={20} color={themeColors.text.secondary} />
                        <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                            Joined <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{formatMonthYear(friendData?.user?.createdAt || friendData?.createdAt)}</Text>
                        </Text>
                    </View>
                </View>
            )
        },
        {
            key: 'Posts',
            label: 'Posts',
            count: posts.length || undefined,
            render: () => (
                <View style={{ gap: 10 }}>
                    {postsLoading && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>Loading posts...</Text></View>
                    )}
                    {!postsLoading && posts.length === 0 && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No posts yet.</Text></View>
                    )}
                    {!postsLoading && posts.map((p: any) => (
                        <PostItem key={p._id} data={p} onPostDeleted={handlePostDeleted} />
                    ))}
                </View>
            )
        },
        {
            key: 'Friends',
            label: 'Friends',
            count: (friends.length || friendsCount) || undefined,
            render: () => (
                <View style={{ gap: 10 }}>
                    {friendsLoading && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>Loading friends...</Text></View>
                    )}
                    {!friendsLoading && friends.length === 0 && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No friends found.</Text></View>
                    )}
                    {!friendsLoading && friends.length > 0 && (
                        <View style={styles.friendsGrid}>
                            {friends.map((f: any) => {
                                const userName = f.fullName || (f.user ? `${f.user.firstName || ''} ${f.user.surname || ''}`.trim() : f.username) || 'Unknown'
                                const pp = f.profilePic || (f.user && f.user.profilePic)
                                return (
                                    <TouchableOpacity 
                                        key={f._id || userName} 
                                        style={[styles.friendItem, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}
                                        onPress={() => {
                                            (navigation as any).navigate('Message', {
                                                screen: 'FriendProfile',
                                                params: { friendId: f._id, friendData: f }
                                            });
                                        }}
                                    >
                                        <View style={[styles.friendAvatarWrap, { backgroundColor: themeColors.surface.secondary }]}>
                                            {pp ? (
                                                <Image source={{ uri: pp }} style={styles.friendAvatar} />
                                            ) : (
                                                <View style={[styles.friendAvatar, { backgroundColor: themeColors.gray[400] }]} />
                                            )}
                                        </View>
                                        <Text style={[styles.friendName, { color: themeColors.text.primary }]} numberOfLines={1}>{userName}</Text>
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
                    {images.length === 0 ? (
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
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>Loading videos...</Text></View>
                    )}
                    {!videosLoading && videos.length === 0 && (
                        <View style={[styles.placeholderCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}><Text style={[styles.placeholderText, { color: themeColors.text.primary }]}>No videos found.</Text></View>
                    )}
                    {!videosLoading && videos.length > 0 && (
                        <View>
                            {videos.map((v: any) => {
                                const thumb = v.thumbnail || v.photos || v.videoUrl
                                return (
                                    <View key={v._id} style={[styles.mediaCard, { position: 'relative', backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                                        <Image source={{ uri: thumb }} style={styles.mediaImage} />
                                        <View style={[styles.playBadge, { right: 12, bottom: 12 }]}><Icon name="play-arrow" size={22} color={themeColors.text.secondary} /></View>
                                    </View>
                                )
                            })}
                        </View>
                    )}
                </View>
            )
        }
    ]

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: themeColors.background.primary }]}>
                <ActivityIndicator size="large" color={themeColors.primary} />
                <Text style={[styles.loadingText, { color: themeColors.text.primary }]}>Loading profile...</Text>
            </View>
        );
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
            {/* Header */}
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
                    {friendData?.coverPic ? (
                        <Image source={{ uri: friendData.coverPic }} style={[styles.cover, { height: coverHeight }]} />
                    ) : (
                        <View style={[styles.cover, styles.coverPlaceholder, { height: coverHeight, backgroundColor: themeColors.gray[200] }]} />
                    )}
                </View>

                <View style={[styles.profileInfoContainer, { marginTop: infoOverlap, borderBottomColor: themeColors.border.secondary }]} pointerEvents="box-none">
                    <View style={[styles.profilePicSection, { height: avatarSize, width: avatarSize }]}>
                        <View style={[
                            styles.avatarWrapper,
                            { height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2, borderColor: themeColors.gray[400], backgroundColor: themeColors.surface.secondary },
                            friendData?.hasStory ? styles.avatarWithStory : undefined
                        ]}>
                            {friendData?.profilePic ? (
                                <Image source={{ uri: friendData.profilePic }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.gray[300] }]} />
                            )}
                        </View>
                    </View>

                    <View style={styles.profileInfo}>
                        <View style={styles.profileNameBlock}>
                            <Text style={[styles.fullName, isSmall ? { fontSize: 20 } : null, { color: themeColors.text.primary }]} numberOfLines={2}>
                                {friendData?.fullName || 'Friend Profile'}
                            </Text>
                            {friendsCount > 0 ? (
                                <Text style={[styles.friendsCount, { color: themeColors.text.secondary }]}>{friendsCount} friends</Text>
                            ) : null}
                        </View>

                        {/* Bio Section */}
                        <View style={[styles.bioSection, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                            {friendData?.bio ? (
                                <>
                                    <Text style={[styles.bioText, { color: themeColors.text.primary }]} numberOfLines={showFullBio ? undefined : 3}>
                                        {friendData.bio}
                                    </Text>
                                    {friendData.bio.length > 100 && (
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
                            {getFriendButton()}
                            <Pressable style={[styles.button, styles.secondaryButton, { backgroundColor: themeColors.surface.secondary }]} onPress={() => {
                                // Navigate to message screen
                                (navigation as any).navigate('Message', { 
                                    screen: 'SingleMessage',
                                    params: { friend: friendData }
                                });
                            }}>
                                <Icon name="message" size={18} color={themeColors.text.secondary} />
                                <Text style={[styles.buttonText, { color: themeColors.text.secondary }]}>Message</Text>
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
        paddingBottom: 24,
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
    },
    fullName: {
        fontWeight: 'bold',
        fontSize: 22,
        textTransform: 'capitalize',
    },
    friendsCount: {
        marginTop: 4,
        textAlign: 'center',
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
        padding: 16,
        gap: 10,
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
    friendsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    friendItem: {
        width: '48%',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        alignItems: 'center',
        // backgroundColor and borderColor will be set dynamically
    },
    friendAvatarWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        marginBottom: 8,
        // backgroundColor will be set dynamically
    },
    friendAvatar: {
        width: '100%',
        height: '100%',
    },
    friendName: {
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

export default FriendProfile;
