import React from 'react';
import { View, Text, StyleSheet, Image, Pressable, ScrollView, useWindowDimensions, ActivityIndicator, Platform, TouchableOpacity, Modal } from 'react-native'
import { useSelector } from 'react-redux'
import Icon from 'react-native-vector-icons/MaterialIcons'
import { RootState } from '../store'
import { colors } from '../theme/colors'
import api, { friendAPI } from '../lib/api'
import PostItem from '../components/Post'
import { launchImageLibrary } from 'react-native-image-picker'
import { useDispatch } from 'react-redux'
import { setProfile } from '../reducers/profileReducer'
import { useNavigation } from '@react-navigation/native'

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

const MyProfile = () => {
    const navigation = useNavigation();
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

    React.useEffect(() => {
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
                // 3) refresh profile from backend or optimistically update
                const updated = { ...myProfile, coverPic: uploadedUrl }
                dispatch(setProfile(updated as any))
            }
        } catch (e) {
            console.log(e)
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
                const updated = { ...myProfile, profilePic: uploadedUrl }
                dispatch(setProfile(updated as any))
            }
        } catch (e) {
            console.log(e)
        } finally {
            setIsUploadingPP(false)
        }
    }

    const tabs: { key: TabKey; label: string; count?: number; render: () => React.ReactNode }[] = [
        {
            key: 'About',
            label: 'About',
            render: () => (
                <View style={styles.detailsCard}>
                    {/* Workplaces */}
                    {Array.isArray(myProfile?.workPlaces) && myProfile.workPlaces.map((wp: any, idx: number) => (
                        <View key={`wp-${idx}`} style={styles.detailsItem}>
                            <Icon name="work" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                {wp?.designation ? `${wp.designation} at ` : ''}
                                <Text style={styles.detailsStrong}>{wp?.name || 'Unknown workplace'}</Text>
                            </Text>
                        </View>
                    ))}

                    {/* Schools */}
                    {Array.isArray(myProfile?.schools) && myProfile.schools.map((sc: any, idx: number) => (
                        <View key={`sc-${idx}`} style={styles.detailsItem}>
                            <Icon name="school" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                Studied at <Text style={styles.detailsStrong}>{sc?.name || 'Unknown school'}</Text>
                                {sc?.degree ? <Text style={styles.detailsMuted}> ({sc.degree})</Text> : null}
                            </Text>
                        </View>
                    ))}

                    {/* Present address */}
                    {!!myProfile?.presentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="home" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                Lives in <Text style={styles.detailsStrong}>{myProfile.presentAddress}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Permanent address */}
                    {!!myProfile?.permanentAddress && (
                        <View style={styles.detailsItem}>
                            <Icon name="public" size={20} color={colors.text.light} />
                            <Text style={styles.detailsText}>
                                From <Text style={styles.detailsStrong}>{myProfile.permanentAddress}</Text>
                            </Text>
                        </View>
                    )}

                    {/* Joined */}
                    <View style={styles.detailsItem}>
                        <Icon name="schedule" size={20} color={colors.text.light} />
                        <Text style={styles.detailsText}>
                            Joined <Text style={styles.detailsStrong}>{formatMonthYear(myProfile?.user?.createdAt || myProfile?.createdAt)}</Text>
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
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            {/* Header spacer */}
            <View/>
            
            {/* Cover Photo */}
            <View style={styles.profileHeader}>
                <View style={styles.coverContainer}>
                {myProfile?.coverPic ? (
                        <Image source={{ uri: myProfile.coverPic }} style={[styles.cover, { height: coverHeight }]} />
                    ) : (
                        <View style={[styles.cover, styles.coverPlaceholder, { height: coverHeight }]} />
                    )}
                    <TouchableOpacity style={styles.uploadCoverBtn} onPress={onUploadCover} disabled={isUploadingCover} activeOpacity={0.8} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
                        <Icon name="photo-camera" color={colors.text.light} size={18} />
                        <Text style={styles.uploadCoverText}>{isUploadingCover ? 'Uploading...' : 'Edit cover photo'}</Text>
                        {isUploadingCover && <ActivityIndicator size="small" color={colors.text.light} style={{ marginLeft: 6 }} />}
                    </TouchableOpacity>
                </View>

                <View style={[styles.profileInfoContainer, { marginTop: infoOverlap }]} pointerEvents="box-none">
                    <View style={[styles.profilePicSection, { height: avatarSize, width: avatarSize }]}>
                        <View style={[
                            styles.avatarWrapper,
                            { height: avatarSize, width: avatarSize, borderRadius: avatarSize / 2 },
                            myProfile?.hasStory ? styles.avatarWithStory : undefined
                        ]}>
                    {myProfile?.profilePic ? (
                        <Image source={{ uri: myProfile.profilePic }} style={styles.avatar} />
                    ) : (
                        <View style={styles.avatarPlaceholder} />
                    )}
                </View>
                        <Pressable style={styles.uploadPPBtn} onPress={onUploadProfilePic} disabled={isUploadingPP}>
                            {isUploadingPP ? (
                                <ActivityIndicator size="small" color={colors.text.light} />
                            ) : (
                                <Icon name="photo-camera" color={colors.text.light} size={18} />
                            )}
                        </Pressable>
                    </View>

                    <View style={styles.profileInfo}>
                        <View style={styles.profileNameBlock}>
                            <Text style={[styles.fullName, isSmall ? { fontSize: 20 } : null]} numberOfLines={2}>
                                {myProfile?.fullName || 'My Profile'}
                            </Text>
                            {friendsCount > 0 ? (
                                <Text style={styles.friendsCount}>{friendsCount} friends</Text>
                            ) : null}
                        </View>

                        <View style={styles.profileButtons}>
                            <Pressable style={[styles.button, styles.primaryButton]}>
                                <Icon name="add-circle" size={18} color={colors.text.light} />
                                <Text style={styles.buttonText}>Add to story</Text>
                            </Pressable>
                            <Pressable style={[styles.button, styles.secondaryButton]}>
                                <Icon name="edit" size={18} color={colors.text.light} />
                                <Text style={styles.buttonText}>Edit profile</Text>
                            </Pressable>
                            {/* <Pressable style={[styles.iconButton]}>
                                <Icon name="more-horiz" size={22} color={colors.text.light} />
                            </Pressable> */}
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
    uploadCoverBtn: {
        position: 'absolute',
        right: 16,
        top: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B3C3C',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        zIndex: 5,
    },
    uploadCoverText: {
        color: colors.text.light,
        marginLeft: 6,
        fontSize: 12,
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
    uploadPPBtn: {
        position: 'absolute',
        bottom: 20,
        right: 4,
        backgroundColor: '#3B3C3C',
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
    iconButton: {
        backgroundColor: '#3B3C3C',
        padding: 8,
        borderRadius: 6,
        marginLeft: 6,
        marginTop: 30,

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
        backgroundColor: '#3B3C3C',
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
    videoThumbWrap: {
        width: '32%',
        aspectRatio: 1,
        marginBottom: 8,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#3B3C3C',
        position: 'relative',
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
})

export default MyProfile;