import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import CreatePost from '../components/CreatePost';
import api from '../lib/api';
import Post from '../components/Post';
import { useTheme } from '../contexts/ThemeContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import DebugInfo from '../components/DebugInfo';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StorySlider from '../components/StorySlider';
import PostSkeleton from '../components/skeleton/PostSkeleton';
import CacheManager from '../utils/cacheManager';

const INITIAL_POSTS_TO_RENDER = 5;
const MAX_BATCH_SIZE = 5;
const LIST_WINDOW_SIZE = 7;

const dedupePosts = (list: any[]) => {
    if (!Array.isArray(list)) return [];
    const seen = new Set<string>();
    return list.filter((post) => {
        const id = post?._id;
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

const Home = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [feedLoaded, setFeedLoaded] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [debugMode, setDebugMode] = useState(false);
    const [showNewPostsNotification, setShowNewPostsNotification] = useState(false);
    const [newPostsCount, setNewPostsCount] = useState(0);
    const [storiesRefreshKey, setStoriesRefreshKey] = useState(0);

    const isFocused = useIsFocused();
    const { colors: themeColors, isDarkMode } = useTheme();
    const myProfile = useSelector((state: RootState) => state.profile);
    const isFirstLoadRef = useRef(true);
    const loadLockRef = useRef(false);
    const refreshInFlightRef = useRef(false);
    const hasFocusedOnceRef = useRef(false);

    const uniquePosts = useMemo(() => dedupePosts(posts), [posts]);

    const refreshFeed = useCallback(async () => {
        if (refreshInFlightRef.current) {
            setRefreshing(false);
            return;
        }
        refreshInFlightRef.current = true;
        try {
            setError(null);
            const previousCachedPosts = (await CacheManager.getCachedPosts()) || [];
            const previousCachedPostIds = new Set(previousCachedPosts.map((post) => post?._id));

            const nfRes = await api.get('/post/newsFeed/', {
                params: { pageNumber: 1 },
            });

            if (nfRes.status === 200) {
                const latestPosts = Array.isArray(nfRes.data.posts) ? nfRes.data.posts : [];
                const newPostsInFetch = isFirstLoadRef.current
                    ? []
                    : latestPosts.filter((post: any) => post?._id && !previousCachedPostIds.has(post._id));

                setPosts(dedupePosts(latestPosts));
                await CacheManager.setCachedPosts(latestPosts);
                setPage(1);
                setHasMore(nfRes.data.hasNewPost ?? false);

                if (newPostsInFetch.length > 0) {
                    setNewPostsCount(newPostsInFetch.length);
                    setShowNewPostsNotification(true);
                } else {
                    setNewPostsCount(0);
                    setShowNewPostsNotification(false);
                }
            }
        } catch (e: any) {
            console.error('Error refreshing news feed:', e);
            const errorMessage = e?.response?.data?.message || 'Failed to load posts. Please try again.';
            setError(errorMessage);
        } finally {
            setRefreshing(false);
            setFeedLoaded(true);
            isFirstLoadRef.current = false;
            refreshInFlightRef.current = false;
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadLockRef.current) return;

        const nextPage = page + 1;
        loadLockRef.current = true;
        setLoadingMore(true);

        try {
            const nfRes = await api.get('/post/newsFeed/', {
                params: { pageNumber: nextPage },
            });
            if (nfRes.status === 200) {
                const newPosts = Array.isArray(nfRes.data.posts) ? nfRes.data.posts : [];
                setPosts((prev) => dedupePosts([...prev, ...newPosts]));
                setPage(nextPage);
                setHasMore(nfRes.data.hasNewPost ?? false);
            }
        } catch (e: any) {
            console.error('Error loading news feed:', e);
        } finally {
            setLoadingMore(false);
            setFeedLoaded(true);
            loadLockRef.current = false;
        }
    }, [hasMore, page]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setShowNewPostsNotification(false);
        setStoriesRefreshKey((key) => key + 1);
        await refreshFeed();
    }, [refreshFeed]);

    useEffect(() => {
        let cancelled = false;

        const hydrateFromCache = async () => {
            const cachedPosts = await CacheManager.getCachedPosts();
            if (!cancelled && cachedPosts && cachedPosts.length > 0) {
                setPosts(dedupePosts(cachedPosts));
            }
        };

        hydrateFromCache();
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isFocused) return;

        setHasMore(true);
        setPage(0);
        refreshFeed();
        if (hasFocusedOnceRef.current) {
            setStoriesRefreshKey((key) => key + 1);
        }
        hasFocusedOnceRef.current = true;
    }, [isFocused, refreshFeed]);

    useEffect(() => {
        if (!showNewPostsNotification) return;
        const timeout = setTimeout(() => {
            setShowNewPostsNotification(false);
        }, 5000);
        return () => clearTimeout(timeout);
    }, [showNewPostsNotification]);

    const handleLoadMore = useCallback(() => {
        if (!loadingMore && hasMore && !error && feedLoaded && !refreshing && !refreshInFlightRef.current) {
            loadMore();
        }
    }, [loadingMore, hasMore, error, feedLoaded, refreshing, loadMore]);

    const handlePostCreated = useCallback((post: any) => {
        setPosts((prev: any[]) => dedupePosts([post, ...prev]));
        CacheManager.prependCachedPost(post);
    }, []);

    const handlePostDeleted = useCallback((postId: string) => {
        setPosts((prev: any[]) => prev.filter((post) => post._id !== postId));
        CacheManager.removeCachedPost(postId);
    }, []);

    const renderPost = useCallback(
        ({ item }: { item: any }) => <Post data={item} onPostDeleted={handlePostDeleted} />,
        [handlePostDeleted],
    );

    const keyExtractor = useCallback((item: any, idx: number) => item._id || idx.toString(), []);

    const backgroundColor = themeColors.background.primary;
    const textColor = themeColors.text.primary;
    const borderColor = themeColors.border.primary;
    const mutedText = themeColors.text.secondary;

    const listHeaderComponent = useMemo(
        () => (
            <View>
                <CreatePost onPostCreated={handlePostCreated} />
                <StorySlider refreshKey={storiesRefreshKey} />
                {showNewPostsNotification && (
                    <View
                        style={{
                            marginHorizontal: 10,
                            marginBottom: 10,
                            paddingHorizontal: 14,
                            paddingVertical: 12,
                            borderRadius: 12,
                            backgroundColor: themeColors.primary + '18',
                            borderWidth: 1,
                            borderColor: themeColors.primary + '55',
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}
                    >
                        <Text style={{ flex: 1, color: textColor, fontSize: 14, fontWeight: '600' }}>
                            🆕 New Posts! {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'} available
                        </Text>
                        <TouchableOpacity onPress={() => setShowNewPostsNotification(false)} hitSlop={8}>
                            <Icon name="close" size={18} color={mutedText} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        ),
        [
            handlePostCreated,
            storiesRefreshKey,
            showNewPostsNotification,
            newPostsCount,
            themeColors.primary,
            textColor,
            mutedText,
        ],
    );

    const listEmptyComponent = useMemo(() => {
        if (!feedLoaded) {
            return <PostSkeleton count={3} />;
        }
        if (error) {
            return (
                <View style={{ alignItems: 'center', marginTop: 40, paddingHorizontal: 24 }}>
                    <Text style={{ color: themeColors.status.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
                        {error}
                    </Text>
                    <Text style={{ color: textColor, fontSize: 14, textAlign: 'center' }}>
                        Pull down to refresh
                    </Text>
                </View>
            );
        }
        return (
            <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
                <Text style={{ color: textColor, fontSize: 18, fontWeight: '700', marginBottom: 8 }}>
                    Your feed is waiting
                </Text>
                <Text style={{ color: mutedText, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
                    Post something, add a friend, or answer today's question above.
                </Text>
            </View>
        );
    }, [feedLoaded, error, themeColors, textColor, mutedText]);

    const listFooterComponent = useMemo(
        () => (loadingMore && uniquePosts.length > 0 ? <PostSkeleton count={1} /> : hasMore && uniquePosts.length > 0 ? <PostSkeleton count={1} /> : null),
        [loadingMore, hasMore, uniquePosts.length],
    );

    if (debugMode) {
        return (
            <View style={{ flex: 1, backgroundColor }}>
                <View
                    style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 16,
                        borderBottomWidth: 1,
                        borderBottomColor: borderColor,
                    }}
                >
                    <Text style={{ color: textColor, fontSize: 18, fontWeight: 'bold' }}>Debug Mode</Text>
                    <TouchableOpacity onPress={() => setDebugMode(false)} style={{ padding: 8 }}>
                        <Icon name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                </View>
                <DebugInfo
                    user={null}
                    isLoading={!feedLoaded}
                    isDarkMode={isDarkMode}
                    posts={uniquePosts}
                    profile={myProfile}
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor }}>
            <FlatList
                data={uniquePosts}
                keyExtractor={keyExtractor}
                ListHeaderComponent={listHeaderComponent}
                renderItem={renderPost}
                ListEmptyComponent={listEmptyComponent}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.2}
                ListFooterComponent={listFooterComponent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[themeColors.primary]}
                        tintColor={themeColors.primary}
                    />
                }
                style={{ backgroundColor }}
                contentContainerStyle={{ backgroundColor, flexGrow: 1, paddingBottom: 80 }}
                initialNumToRender={INITIAL_POSTS_TO_RENDER}
                maxToRenderPerBatch={MAX_BATCH_SIZE}
                windowSize={LIST_WINDOW_SIZE}
                removeClippedSubviews
                updateCellsBatchingPeriod={50}
            />
        </View>
    );
};

export default Home;
