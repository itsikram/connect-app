import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Platform, TouchableOpacity, Modal, RefreshControl } from 'react-native'
import { useSelector } from 'react-redux'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { RootState } from '../store'
import { useTheme } from '../contexts/ThemeContext'
import api, { friendAPI } from '../lib/api'
import PostItem from '../components/Post'
import { launchImageLibrary } from 'react-native-image-picker'
import { useDispatch } from 'react-redux'
import { setProfile, updateProfilePic, updateCoverPic } from '../reducers/profileReducer'
import { useNavigation } from '@react-navigation/native'

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

type TabKey = 'Posts' | 'About' | 'Friends' | 'Images' | 'Videos'

const MyProfile = () => {
    const navigation = useNavigation();
    const { colors: themeColors } = useTheme();
    const myProfile = useSelector((state: RootState) => state.profile)
    const [activeTab, setActiveTab] = React.useState<TabKey>('About')
    const { width } = useWindowDimensions()

    const dispatch = useDispatch()
    const isSmall = width < 380
    const avatarSize = isSmall ? 120 : 170
    const coverHeight = isSmall ? 240 : 280
    const infoOverlap = -Math.round(avatarSize / 3)

    const friendsCount = Array.isArray(myProfile?.friends) ? myProfile.friends.length : 0

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
    const [refreshing, setRefreshing] = React.useState<boolean>(false)

    const fetchProfileData = React.useCallback(async () => {
        if (!myProfile?._id) return;

        // Posts (for Posts and Images tabs)
        setPostsLoading(true)
        api.get('/post/myPosts', { params: { profile: myProfile._id } }).then(res => {
            if (res.status === 200) {
                setPosts(Array.isArray(res.data) ? res.data : [])
            }
        }).catch(() => {}).finally(() => setPostsLoading(false))

        // Friends
        setFriendsLoading(true)
        // Use server's expected query param `profile`
        api.get('/friend/getFriends', { params: { profile: myProfile._id } }).then(res => {
            if (res.status === 200) {
                const arr = Array.isArray(res.data) ? res.data : []
                setFriends(arr.length ? arr : (Array.isArray(myProfile?.friends) ? myProfile.friends : []))
            }
        }).catch(() => {
            // Fallback to local profile state if request fails
            setFriends(Array.isArray(myProfile?.friends) ? myProfile.friends : [])
        }).finally(() => setFriendsLoading(false))

        // Videos (profile watch list)
        setVideosLoading(true)
        api.get('/watch/profileWatch', { params: { profile: myProfile._id, pageNumber: 1 } }).then(res => {
            if (res.status === 200) {
                const data = res.data.watchs || res.data || []
                setVideos(Array.isArray(data) ? data : [])
            }
        }).catch(() => {}).finally(() => setVideosLoading(false))
    }, [myProfile?._id])

    const onRefresh = React.useCallback(async () => {
        setRefreshing(true);
        await fetchProfileData();
        setRefreshing(false);
    }, [fetchProfileData]);

    const handlePostDeleted = (postId: string) => {
        setPosts((prev: any[]) => prev.filter(post => post._id !== postId));
    };

    React.useEffect(() => {
        fetchProfileData();
    }, [fetchProfileData])

    const [isUploadingCover, setIsUploadingCover] = React.useState(false)
    const [isUploadingPP, setIsUploadingPP] = React.useState(false)

    const uploadToServer = async (formData: FormData, path: string) => {
        // Requires auth header automatically via api instance
        const res = await api.post(path, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return res
    }

    const handlePickImage = async (): Promise<any | null> => {
        const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 })
        if (result.didCancel || !result.assets || result.assets.length === 0) return null
        const asset = result.assets[0]
        return asset
    }

    const onUploadCover = async () => {
        if (!myProfile?._id) return;
        const asset = await handlePickImage()
        if (!asset || !asset.uri) return
        try {
            setIsUploadingCover(true)
            // 0) Optimistic update - show the selected image immediately
            dispatch(updateCoverPic(asset.uri))
            // 1) upload raw image to server/cloud
            const fileName = asset.fileName || `cover_${Date.now()}.jpg`
            const file: any = {
                uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
                type: asset.type || 'image/jpeg',
                name: fileName,
            }
            const uploadFd = new FormData()
            uploadFd.append('image', file)
            const uploaded = await uploadToServer(uploadFd, '/upload/')
            const uploadedUrl = uploaded?.data?.secure_url || uploaded?.data?.url
            if (!uploadedUrl) throw new Error('Upload failed')

            // 2) update profile cover URL (send as multipart/form-data to satisfy multer)
            const updateFd = new FormData()
            updateFd.append('profile', String(myProfile._id))
            updateFd.append('coverPicUrl', String(uploadedUrl))
            const res = await api.post('/profile/update/coverPic', updateFd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            if (res.status === 200) {
                // 3) instant update cover pic in Redux store with final URL
                dispatch(updateCoverPic(uploadedUrl))
            }
        } catch (e) {
            console.log(e)
            // Revert optimistic update on error
            if (myProfile?.coverPic) {
                dispatch(updateCoverPic(myProfile.coverPic))
            }
        } finally {
            setIsUploadingCover(false)
        }
    }

    const onUploadProfilePic = async () => {
        if (!myProfile?._id) return;
        const asset = await handlePickImage()
        if (!asset || !asset.uri) return
        try {
            setIsUploadingPP(true)
            // Optimistic update - show the selected image immediately
            dispatch(updateProfilePic(asset.uri))
            const fileName = asset.fileName || `pp_${Date.now()}.jpg`
            const file: any = {
                uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
                type: asset.type || 'image/jpeg',
                name: fileName,
            }
            const uploadFd = new FormData()
            uploadFd.append('image', file)
            const uploaded = await uploadToServer(uploadFd, '/upload/')
            const uploadedUrl = uploaded?.data?.secure_url || uploaded?.data?.url
            if (!uploadedUrl) throw new Error('Upload failed')

            const res = await api.post('/profile/update/profilePic', { profilePicUrl: uploadedUrl, type: 'profilePic' })
            if (res.status === 200) {
                // Instant update profile pic in Redux store with final URL
                dispatch(updateProfilePic(uploadedUrl))
            }
        } catch (e) {
            console.log(e)
            // Revert optimistic update on error
            if (myProfile?.profilePic) {
                dispatch(updateProfilePic(myProfile.profilePic))
            }
        } finally {
            setIsUploadingPP(false)
        }
    }

    const tabs: { key: TabKey; label: string; count?: number; render: () => React.ReactNode }[] = [
        {
            key: 'About',
            label: 'About',
            render: () => (
                <View style={[styles.detailsCard, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>

                    {myProfile?.bio && (
                        <View style={styles.detailsItem}>
                            <Icon name="info" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{myProfile.bio}</Text>
                            </Text>
                        </View>
                    )}


                    {Array.isArray(myProfile?.workPlaces) && myProfile.workPlaces.map((wp: any, idx: number) => (
                        <View key={`wp-${idx}`} style={styles.detailsItem}>
                            <Icon name="work" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                <Text>{wp?.designation ? `${wp.designation} at ` : ''}</Text>
                                <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{wp?.name || 'Unknown workplace'}</Text>
                            </Text>
                        </View>
                    ))}


                    {Array.isArray(myProfile?.schools) && myProfile.schools.map((sc: any, idx: number) => (
                        <View key={`sc-${idx}`} style={styles.detailsItem}>
                            <Icon name="school" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                Studied at <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{sc?.name || 'Unknown school'}</Text>
                                {sc?.degree ? <Text style={[styles.detailsMuted, { color: themeColors.text.tertiary }]}> ({sc.degree})</Text> : null}
                            </Text>
                        </View>
                    ))}


                    {!!myProfile?.presentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="home" size={20} color={themeColors.text.secondary} />
                            <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                                Lives in <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{myProfile.presentAddress}</Text>
                            </Text>
                        </View>
                    )}


                    {!!myProfile?.permanentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="public" size={20} color={themeColors.text.secondary} />
                            <Text style={styles.detailsText}>
                                From <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{myProfile.permanentAddress}</Text>
                            </Text>
                        </View>
                    )}


                    <View style={styles.detailsItem}>
                        <Icon name="schedule" size={20} color={themeColors.text.secondary} />
                        <Text style={[styles.detailsText, { color: themeColors.text.primary }]}>
                            Joined <Text style={[styles.detailsStrong, { color: themeColors.text.primary }]}>{formatMonthYear(myProfile?.user?.createdAt || myProfile?.createdAt)}</Text>
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

    // Fetch images directly from profile endpoint; fall back to deriving from posts
    React.useEffect(() => {
        if (!myProfile?._id) return
        api.get('/profile/getImages', { params: { profileId: myProfile._id } }).then(res => {
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
    }, [myProfile?._id, posts])

    return (
        <ScrollView style={[styles.container, { backgroundColor: themeColors.background.primary }]} showsVerticalScrollIndicator={false} refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColors.text.secondary]} />
        }>

            

            <View style={[styles.profileHeader, { backgroundColor: themeColors.surface.header }]}>
                <View style={[styles.coverContainer, { backgroundColor: themeColors.gray[200] }]}>
                {myProfile?.coverPic ? (
                        <Image source={{ uri: myProfile.coverPic }} style={[styles.cover, { height: coverHeight }]} />
                    ) : (
                        <View style={[styles.cover, styles.coverPlaceholder, { height: coverHeight, backgroundColor: themeColors.gray[200] }]} />
                    )}
                    <TouchableOpacity style={[styles.uploadCoverBtn, { backgroundColor: themeColors.surface.secondary }]} onPress={onUploadCover} disabled={isUploadingCover} activeOpacity={0.8} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
                        <Icon name="photo-camera" color={themeColors.text.secondary} size={18} />
                        <Text style={[styles.uploadCoverText, { color: themeColors.text.secondary }]}>{isUploadingCover ? 'Uploading...' : 'Edit cover photo'}</Text>
                        {isUploadingCover && <ActivityIndicator size="small" color={themeColors.text.secondary} style={{ marginLeft: 6 }} />}
                    </TouchableOpacity>
                </View>

                <View style={[styles.profileInfoContainer, { marginTop: infoOverlap, borderBottomColor: themeColors.border.secondary }]} pointerEvents="box-none">
                    <View style={[styles.profilePicSection, { height: avatarSize, width: avatarSize }]}>
                        <View style={[
                            styles.avatarWrapper,
                            { height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2, borderColor: themeColors.gray[400], backgroundColor: themeColors.surface.secondary },
                            myProfile?.hasStory ? styles.avatarWithStory : undefined
                        ]}>
                    {myProfile?.profilePic ? (
                        <Image source={{ uri: myProfile.profilePic }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.gray[300] }]} />
                    )}
                </View>
                        <Pressable style={[styles.uploadPPBtn, { backgroundColor: themeColors.surface.secondary }]} onPress={onUploadProfilePic} disabled={isUploadingPP}>
                            {isUploadingPP ? (
                                <ActivityIndicator size="small" color={themeColors.text.secondary} />
                            ) : (
                                <Icon name="photo-camera" color={themeColors.text.secondary} size={18} />
                            )}
                        </Pressable>
                    </View>

                    <View style={styles.profileInfo}>
                        <View style={styles.profileNameBlock}>
                            <Text style={[styles.fullName, isSmall ? { fontSize: 20 } : null, { color: themeColors.text.primary }]} numberOfLines={2}>
                                {myProfile?.fullName || 'My Profile'}
                            </Text>
                            {friendsCount > 0 ? (
                                <Text style={[styles.friendsCount, { color: themeColors.text.secondary }]}>{friendsCount} friends</Text>
                            ) : null}
                        </View>


                        <View style={[styles.bioSection, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.secondary }]}>
                            {myProfile?.bio ? (
                                <>
                                    <Text style={[styles.bioText, { color: themeColors.text.primary }]} numberOfLines={showFullBio ? undefined : 3}>
                                        {myProfile.bio}
                                    </Text>
                                    {myProfile.bio.length > 100 && (
                                                                    <TouchableOpacity 
                                style={[styles.bioToggleButton, { backgroundColor: themeColors.surface.secondary }]}
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
                                    Add a bio to tell people about yourself
                                </Text>
                            )}
                            <TouchableOpacity 
                                style={[styles.editBioButton, { backgroundColor: themeColors.surface.secondary }]}
                                onPress={() => {
                                    // Navigate to profile settings
                                    (navigation as any).navigate('Settings', { screen: 'ProfileSettings' });
                                }}
                            >
                                <Icon name="edit" size={16} color={themeColors.text.secondary} />
                                <Text style={[styles.editBioText, { color: themeColors.text.secondary }]}>Edit Bio</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileButtons}>
                            <Pressable style={[styles.button, styles.primaryButton, { backgroundColor: themeColors.primary }]}>
                                <Icon name="add-circle" size={18} color={themeColors.text.inverse} />
                                <Text style={[styles.buttonText, { color: themeColors.text.inverse }]}>Add to story</Text>
                            </Pressable>
                            <Pressable style={[styles.button, styles.secondaryButton, { backgroundColor: themeColors.surface.secondary }]}>
                                <Icon name="edit" size={18} color={themeColors.text.secondary} />
                                <Text style={[styles.buttonText, { color: themeColors.text.secondary }]}>Edit profile</Text>
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
    uploadCoverBtn: {
        position: 'absolute',
        right: 16,
        top: 16,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        zIndex: 5,
    },
    uploadCoverText: {
        marginLeft: 6,
        fontSize: 12,
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
    uploadPPBtn: {
        position: 'absolute',
        bottom: 20,
        right: 4,
        padding: 8,
        borderRadius: 20,
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
        // backgroundColor will be set dynamically
    },
    secondaryButton: {
        // backgroundColor will be set dynamically
    },
    iconButton: {
        padding: 8,
        borderRadius: 6,
        marginLeft: 6,
        marginTop: 30,
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
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    imageThumb: {
        width: '32%',
        aspectRatio: 1,
        marginBottom: 8,
        borderRadius: 8,
        // backgroundColor will be set dynamically
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
    videoThumbWrap: {
        width: '32%',
        aspectRatio: 1,
        marginBottom: 8,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
        // backgroundColor will be set dynamically
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
        width: '90%',
        alignSelf: 'center',
        minHeight: 60,
    },
    bioText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 8,
        // color will be set dynamically
    },
    bioPlaceholder: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
        fontStyle: 'italic',
        // color will be set dynamically
    },
    editBioButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'center',
    },
    editBioText: {
        marginLeft: 6,
        fontSize: 12,
        fontWeight: '600',
        // color will be set dynamically
    },
    bioToggleButton: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 6,
        alignSelf: 'center',
        marginTop: 8,
    },
    bioToggleText: {
        fontSize: 12,
        fontWeight: '600',
        // color will be set dynamically
    },
})

export default MyProfile;