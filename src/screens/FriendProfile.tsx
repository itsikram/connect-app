import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Platform, TouchableOpacity, Modal } from 'react-native'
import { useSelector } from 'react-redux'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { RootState } from '../store'
import { colors } from '../theme/colors'
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

    // Fetch friend profile data
    React.useEffect(() => {
        if (!friendId) return;
        
        setIsLoading(true);
        api.get('/profile', { params: { profileId: friendId } })
            .then(res => {
                if (res.status === 200) {
                    setFriendData(res.data);
                    // Check if this friend is in my friends list
                    if (myProfile?.friends) {
                        const isInFriendsList = myProfile.friends.some((f: any) => f._id === friendId);
                        setIsFriend(isInFriendsList);
                        setFriendStatus(isInFriendsList ? 'friends' : 'none');
                    }
                }
            })
            .catch(err => {
                console.error('Error fetching friend profile:', err);
            })
            .finally(() => setIsLoading(false));
    }, [friendId, myProfile?.friends]);

    // Check friend request status
    React.useEffect(() => {
        if (!friendId || !myProfile?._id) return;
        
        // Check if there's a pending friend request
        friendAPI.getFriendRequest(myProfile._id)
            .then(res => {
                if (res.status === 200 && Array.isArray(res.data)) {
                    const hasPendingRequest = res.data.some((req: any) => req._id === friendId);
                    if (hasPendingRequest) {
                        setFriendStatus('pending');
                    }
                }
            })
            .catch(() => {});
    }, [friendId, myProfile?._id]);

    React.useEffect(() => {
        if (!friendId) return;

        // Posts (for Posts and Images tabs)
        setPostsLoading(true)
        api.get('/post/myPosts', { params: { profile: friendId } }).then(res => {
            if (res.status === 200) {
                setPosts(Array.isArray(res.data) ? res.data : [])
            }
        }).catch(() => {}).finally(() => setPostsLoading(false))

        // Friends
        setFriendsLoading(true)
        api.get('/friend/getFriends', { params: { profile: friendId } }).then(res => {
            if (res.status === 200) {
                const arr = Array.isArray(res.data) ? res.data : []
                setFriends(arr.length ? arr : (Array.isArray(friendData?.friends) ? friendData.friends : []))
            }
        }).catch(() => {
            setFriends(Array.isArray(friendData?.friends) ? friendData.friends : [])
        }).finally(() => setFriendsLoading(false))

        // Videos (profile watch list)
        setVideosLoading(true)
        api.get('/watch/profileWatch', { params: { profile: friendId, pageNumber: 1 } }).then(res => {
            if (res.status === 200) {
                const data = res.data.watchs || res.data || []
                setVideos(Array.isArray(data) ? data : [])
            }
        }).catch(() => {}).finally(() => setVideosLoading(false))
    }, [friendId, friendData?.friends])

    // Fetch images directly from profile endpoint
    React.useEffect(() => {
        if (!friendId) return
        api.get('/profile/getImages', { params: { profileId: friendId } }).then(res => {
            if (res.status === 200 && Array.isArray(res.data)) {
                const imgs = res.data
                    .filter((p: any) => p?.photos)
                    .map((p: any) => p.photos)
                setImages(imgs)
                return
            }
            const derived = posts.filter((p: any) => p?.photos).map((p: any) => p.photos)
            setImages(derived)
        }).catch(() => {
            const derived = posts.filter((p: any) => p?.photos).map((p: any) => p.photos)
            setImages(derived)
        })
    }, [friendId, posts])

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
                        <Icon name="person-remove" size={18} color={colors.text.light} />
                        <Text style={styles.buttonText}>Remove Friend</Text>
                    </Pressable>
                );
            case 'pending':
                return (
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleAcceptFriendRequest}>
                        <Icon name="check" size={18} color={colors.text.light} />
                        <Text style={styles.buttonText}>Accept Request</Text>
                    </Pressable>
                );
            default:
                return (
                    <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSendFriendRequest}>
                        <Icon name="person-add" size={18} color={colors.text.light} />
                        <Text style={styles.buttonText}>Add Friend</Text>
                    </Pressable>
                );
        }
    };

    const tabs: { key: TabKey; label: string; count?: number; render: () => React.ReactNode }[] = [
        {
            key: 'About',
            label: 'About',
            render: () => (
                <View style={styles.detailsCard}>
                    {/* Bio */}
                    {friendData?.bio && (
                        <View style={styles.detailsItem}>
                            <Icon name="info" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                <Text style={styles.detailsStrong}>{friendData.bio}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Workplaces */}
                    {Array.isArray(friendData?.workPlaces) && friendData.workPlaces.map((wp: any, idx: number) => (
                        <View key={`wp-${idx}`} style={styles.detailsItem}>
                            <Icon name="work" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                {wp?.designation ? `${wp.designation} at ` : ''}
                                <Text style={styles.detailsStrong}>{wp?.name || 'Unknown workplace'}</Text>
                            </Text>
                        </View>
                    ))}

                    {/* Schools */}
                    {Array.isArray(friendData?.schools) && friendData.schools.map((sc: any, idx: number) => (
                        <View key={`sc-${idx}`} style={styles.detailsItem}>
                            <Icon name="school" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                Studied at <Text style={styles.detailsStrong}>{sc?.name || 'Unknown school'}</Text>
                                {sc?.degree ? <Text style={styles.detailsMuted}> ({sc.degree})</Text> : null}
                            </Text>
                        </View>
                    ))}

                    {/* Present address */}
                    {!!friendData?.presentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="home" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                Lives in <Text style={styles.detailsStrong}>{friendData.presentAddress}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Permanent address */}
                    {!!friendData?.permanentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="public" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                From <Text style={styles.detailsStrong}>{friendData.permanentAddress}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Joined */}
                    <View style={styles.detailsItem}>
                        <Icon name="schedule" size={20} color={colors.text.light} />
                        <Text style={styles.detailsText}>
                            Joined <Text style={styles.detailsStrong}>{formatMonthYear(friendData?.user?.createdAt || friendData?.createdAt)}</Text>
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
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>Loading posts...</Text></View>
                    )}
                    {!postsLoading && posts.length === 0 && (
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>No posts yet.</Text></View>
                    )}
                    {!postsLoading && posts.map((p: any) => (
                        <PostItem key={p._id} data={p} />
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
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>Loading friends...</Text></View>
                    )}
                    {!friendsLoading && friends.length === 0 && (
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>No friends found.</Text></View>
                    )}
                    {!friendsLoading && friends.length > 0 && (
                        <View style={styles.friendsGrid}>
                            {friends.map((f: any) => {
                                const userName = f.fullName || (f.user ? `${f.user.firstName || ''} ${f.user.surname || ''}`.trim() : f.username) || 'Unknown'
                                const pp = f.profilePic || (f.user && f.user.profilePic)
                                return (
                                    <TouchableOpacity 
                                        key={f._id || userName} 
                                        style={styles.friendItem}
                                        onPress={() => {
                                            (navigation as any).navigate('Message', {
                                                screen: 'FriendProfile',
                                                params: { friendId: f._id, friendData: f }
                                            });
                                        }}
                                    >
                                        <View style={styles.friendAvatarWrap}>
                                            {pp ? (
                                                <Image source={{ uri: pp }} style={styles.friendAvatar} />
                                            ) : (
                                                <View style={[styles.friendAvatar, { backgroundColor: '#555' }]} />
                                            )}
                                        </View>
                                        <Text style={styles.friendName} numberOfLines={1}>{userName}</Text>
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
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>No images found.</Text></View>
                    ) : (
                        <View>
                            {images.map((uri, idx) => (
                                <TouchableOpacity key={uri + idx} onPress={() => { setImageViewerIndex(idx); setImageViewerOpen(true); }}>
                                    <View style={styles.mediaCard}>
                                        <Image source={{ uri }} style={styles.mediaImage} />
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Modal visible={imageViewerOpen} transparent animationType="fade" onRequestClose={() => setImageViewerOpen(false)}>
                        <View style={styles.viewerOverlay}>
                            <TouchableOpacity style={styles.viewerClose} onPress={() => setImageViewerOpen(false)}>
                                <Icon name="close" size={24} color={colors.text.light} />
                            </TouchableOpacity>
                            <View style={styles.viewerContent}>
                                <TouchableOpacity style={styles.viewerNavLeft} onPress={() => setImageViewerIndex(i => Math.max(0, i - 1))}>
                                    <Icon name="chevron-left" size={28} color={colors.text.light} />
                                </TouchableOpacity>
                                <Image source={{ uri: images[imageViewerIndex] }} style={styles.viewerImage} />
                                <TouchableOpacity style={styles.viewerNavRight} onPress={() => setImageViewerIndex(i => Math.min(images.length - 1, i + 1))}>
                                    <Icon name="chevron-right" size={28} color={colors.text.light} />
                                </TouchableOpacity>
                            </View>
                            <Text style={styles.viewerCounter}>{imageViewerIndex + 1} / {images.length}</Text>
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
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>Loading videos...</Text></View>
                    )}
                    {!videosLoading && videos.length === 0 && (
                        <View style={styles.placeholderCard}><Text style={styles.placeholderText}>No videos found.</Text></View>
                    )}
                    {!videosLoading && videos.length > 0 && (
                        <View>
                            {videos.map((v: any) => {
                                const thumb = v.thumbnail || v.photos || v.videoUrl
                                return (
                                    <View key={v._id} style={[styles.mediaCard, { position: 'relative' }]}>
                                        <Image source={{ uri: thumb }} style={styles.mediaImage} />
                                        <View style={[styles.playBadge, { right: 12, bottom: 12 }]}><Icon name="play-arrow" size={22} color={colors.text.light} /></View>
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
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Icon name="arrow-back" size={24} color={colors.text.light} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>

            </View>
            

            
            <View style={styles.profileHeader}>
                <View style={styles.coverContainer}>
                    {friendData?.coverPic ? (
                        <Image source={{ uri: friendData.coverPic }} style={[styles.cover, { height: coverHeight }]} />
                    ) : (
                        <View style={[styles.cover, styles.coverPlaceholder, { height: coverHeight }]} />
                    )}
                </View>

                <View style={[styles.profileInfoContainer, { marginTop: infoOverlap }]} pointerEvents="box-none">
                    <View style={[styles.profilePicSection, { height: avatarSize, width: avatarSize }]}>
                        <View style={[
                            styles.avatarWrapper,
                            { height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2 },
                            friendData?.hasStory ? styles.avatarWithStory : undefined
                        ]}>
                            {friendData?.profilePic ? (
                                <Image source={{ uri: friendData.profilePic }} style={styles.avatar} />
                            ) : (
                                <View style={styles.avatarPlaceholder} />
                            )}
                        </View>
                    </View>

                    <View style={styles.profileInfo}>
                        <View style={styles.profileNameBlock}>
                            <Text style={[styles.fullName, isSmall ? { fontSize: 20 } : null]} numberOfLines={2}>
                                {friendData?.fullName || 'Friend Profile'}
                            </Text>
                            {friendsCount > 0 ? (
                                <Text style={styles.friendsCount}>{friendsCount} friends</Text>
                            ) : null}
                        </View>

                        {/* Bio Section */}
                        <View style={styles.bioSection}>
                            {friendData?.bio ? (
                                <>
                                    <Text style={styles.bioText} numberOfLines={showFullBio ? undefined : 3}>
                                        {friendData.bio}
                                    </Text>
                                    {friendData.bio.length > 100 && (
                                        <TouchableOpacity 
                                            style={styles.bioToggleButton}
                                            onPress={() => setShowFullBio(!showFullBio)}
                                        >
                                            <Text style={styles.bioToggleText}>
                                                {showFullBio ? 'Show Less' : 'Show More'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            ) : (
                                <Text style={styles.bioPlaceholder}>
                                    No bio added yet
                                </Text>
                            )}
                        </View>

                        <View style={styles.profileButtons}>
                            {getFriendButton()}
                            <Pressable style={[styles.button, styles.secondaryButton]} onPress={() => {
                                // Navigate to message screen
                                (navigation as any).navigate('Message', { 
                                    screen: 'SingleMessage',
                                    params: { friend: friendData }
                                });
                            }}>
                                <Icon name="message" size={18} color={colors.text.light} />
                                <Text style={styles.buttonText}>Message</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>

                <View style={styles.tabRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabNavigator}>
                        {tabs.map(({ key, label, count }) => (
                            <Pressable key={key} onPress={() => setActiveTab(key)} style={[styles.tabItem, activeTab === key && styles.activeTabItem]}>
                                <View style={styles.tabLabelRow}>
                                    <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>{label}</Text>
                                    {typeof count === 'number' && count > 0 && (
                                        <View style={styles.countBadge}>
                                            <Text style={styles.countBadgeText}>{count}</Text>
                                        </View>
                                    )}
                                </View>
                            </Pressable>
                        ))}
                    </ScrollView>
                    <View style={styles.optionsMenu}><Icon name="more-horiz" size={22} color={colors.text.light} /></View>
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
        backgroundColor: colors.background.dark,
    },
    contentContainer: {
        paddingBottom: 24,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#242526',
        borderBottomWidth: 1,
        borderBottomColor: '#3B3C3C',
    },
    backButton: {
        padding: 8,
        marginRight: 12,
    },
    headerTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.text.light,
        textAlign: 'center',
    },

    loadingContainer: {
        flex: 1,
        backgroundColor: colors.background.dark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: colors.text.light,
        marginTop: 16,
        fontSize: 16,
    },
    profileHeader: {
        backgroundColor: '#242526',
        marginBottom: 15,
    },
    coverContainer: {
        width: '100%',
        overflow: 'hidden',
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        position: 'relative',
        backgroundColor: colors.gray[800],
    },
    cover: {
        width: '100%',
        height: 220,
    },
    coverPlaceholder: {
        backgroundColor: colors.gray[800],
    },
    profileInfoContainer: {
        width: '94%',
        alignSelf: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#3B3C3C',
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
        borderColor: 'gray',
        backgroundColor: '#3B3C3C',
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
        backgroundColor: '#48484A',
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
        color: colors.text.light,
        fontWeight: 'bold',
        fontSize: 22,
        textTransform: 'capitalize',
    },
    friendsCount: {
        color: '#DFE1E6',
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
        backgroundColor: colors.primary,
    },
    secondaryButton: {
        backgroundColor: '#3B3C3C',
    },
    removeButton: {
        backgroundColor: '#E74C3C',
    },
    buttonText: {
        color: colors.text.light,
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
        backgroundColor: '#3B3C3C',
        borderRadius: 10,
    },
    tabText: {
        color: colors.text.light,
    },
    activeTabText: {
        fontWeight: '700',
    },
    countBadge: {
        marginLeft: 6,
        backgroundColor: '#3B3C3C',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countBadgeText: {
        color: colors.text.light,
        fontSize: 12,
        fontWeight: '700',
    },
    optionsMenu: {
        marginLeft: 'auto',
        padding: 8,
        borderRadius: 6,
        backgroundColor: '#3B3C3C',
    },
    profileContentContainer: {
        padding: 16,
        gap: 10,
    },
    placeholderCard: {
        backgroundColor: '#242526',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: '#3B3C3C',
    },
    detailsCard: {
        backgroundColor: '#242526',
        borderRadius: 10,
        padding: 16,
        borderWidth: 1,
        borderColor: '#3B3C3C',
        gap: 12,
    },
    detailsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    detailsText: {
        color: colors.text.light,
        flexShrink: 1,
    },
    detailsStrong: {
        color: colors.text.light,
        fontWeight: '700',
    },
    detailsMuted: {
        color: '#B0B3B8',
    },
    friendsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    friendItem: {
        width: '48%',
        backgroundColor: '#242526',
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#3B3C3C',
        alignItems: 'center',
    },
    friendAvatarWrap: {
        width: 64,
        height: 64,
        borderRadius: 32,
        overflow: 'hidden',
        marginBottom: 8,
        backgroundColor: '#3B3C3C',
    },
    friendAvatar: {
        width: '100%',
        height: '100%',
    },
    friendName: {
        color: colors.text.light,
        fontWeight: '600',
    },
    mediaCard: {
        backgroundColor: '#242526',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#3B3C3C',
        marginBottom: 12,
        overflow: 'hidden',
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
        color: colors.text.light,
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
        color: colors.text.light,
    },
    bioSection: {
        marginTop: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#3B3C3C',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#555',
        width: '100%',
        alignSelf: 'center',
        minHeight: 60,
    },
    bioText: {
        color: colors.text.light,
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    bioPlaceholder: {
        color: '#B0B3B8',
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    bioToggleButton: {
        marginTop: 8,
        paddingVertical: 4,
        paddingHorizontal: 10,
        backgroundColor: '#3B3C3C',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#555',
    },
    bioToggleText: {
        color: colors.text.light,
        fontSize: 12,
        fontWeight: '600',
    },
})

export default FriendProfile;
