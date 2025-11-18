import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Animated } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import CreatePost from '../components/CreatePost';
import api from '../lib/api';
import Post from '../components/Post';
import { useTheme } from '../contexts/ThemeContext';
import { useSocket } from '../contexts/SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import DebugInfo from '../components/DebugInfo';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StorySlider from '../components/StorySlider';
import PostSkeleton from '../components/skeleton/PostSkeleton';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Modern components
import { ModernCard, ModernButton, ModernLoading } from '../components/modern';

// Storage keys for caching
const CACHED_POSTS_KEY = 'cached_home_posts';
const LAST_SYNC_TIMESTAMP_KEY = 'home_last_sync';
const CACHE_POST_LIMIT = 30;
const NEW_POSTS_POLL_INTERVAL = 60000;
const INITIAL_POSTS_TO_RENDER = 5;
const MAX_BATCH_SIZE = 5;
const LIST_WINDOW_SIZE = 7;


const Home = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [debugMode, setDebugMode] = useState(false);
    const [hasNewData, setHasNewData] = useState(false);
    const [isCheckingForNewData, setIsCheckingForNewData] = useState(false);
    
    const isFocused = useIsFocused();
    const { colors: themeColors, isDarkMode } = useTheme();
    const { isConnected } = useSocket();
    const myProfile = useSelector((state: RootState) => state.profile);
    
    // Animation for refresh button
    const slideAnim = useRef(new Animated.Value(-100)).current;
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Save posts to cache
    const savePostsToCache = useCallback(async (postsToSave: any[]) => {
        try {
            const trimmedPosts = postsToSave.slice(0, CACHE_POST_LIMIT);
            const dataToCache = {
                posts: trimmedPosts,
                timestamp: new Date().toISOString()
            };
            await AsyncStorage.setItem(CACHED_POSTS_KEY, JSON.stringify(dataToCache));
            await AsyncStorage.setItem(LAST_SYNC_TIMESTAMP_KEY, new Date().toISOString());
            console.log('💾 Home posts cached successfully');
        } catch (error) {
            console.error('❌ Error saving posts to cache:', error);
        }
    }, []);

    // Load posts from cache
    const loadPostsFromCache = async () => {
        try {
            const cachedData = await AsyncStorage.getItem(CACHED_POSTS_KEY);
            if (cachedData) {
                const parsedData = JSON.parse(cachedData);
                if (parsedData.posts && parsedData.posts.length > 0) {
                    setPosts(parsedData.posts.slice(0, CACHE_POST_LIMIT));
                    console.log('✅ Loaded posts from cache:', parsedData.posts.length);
                    return true;
                }
            }
        } catch (error) {
            console.error('❌ Error loading posts from cache:', error);
        }
        return false;
    };

    // Check for new posts
    const checkForNewPosts = useCallback(async () => {
        try {
            setIsCheckingForNewData(true);
            setError(null);
            const res = await api.get(`/post/newsFeed?pageNumber=1`);
            if (res.status === 200) {
                const newPosts = res.data.posts || [];
                const cachedData = await AsyncStorage.getItem(CACHED_POSTS_KEY);
                
                if (cachedData && newPosts.length > 0) {
                    const cachedPosts = JSON.parse(cachedData).posts;
                    // Check if there are new posts by comparing first post ID
                    if (cachedPosts.length > 0 && newPosts[0]._id !== cachedPosts[0]._id) {
                        setHasNewData(true);
                        // Animate refresh button
                        Animated.timing(slideAnim, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                        }).start();
                        console.log('🆕 New posts available!');
                    }
                }
            }
        } catch (e: any) {
            console.error('Error checking for new posts:', e);
        } finally {
            setIsCheckingForNewData(false);
        }
    }, [slideAnim]);

    const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            setError(null);
            const res = await api.get(`/post/newsFeed?pageNumber=${pageNum}`);
            if (res.status === 200) {
                const newPosts = res.data.posts || [];
                setHasMore(res.data.hasNewPost); // use backend's hasNewPost
                
                setPosts(prev => {
                    const updatedPosts = append ? [...prev, ...newPosts] : newPosts;
                    // Save to cache if this is a full refresh (not pagination)
                    if (!append) {
                        savePostsToCache(updatedPosts);
                    }
                    return updatedPosts;
                });
            }
        } catch (e: any) {
            console.error('Error fetching posts:', e);
            const errorMessage = e?.response?.data?.message || 'Failed to load posts. Please try again.';
            setError(errorMessage);

            if (!append) {
                setPosts([]);
            }
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, [savePostsToCache]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setPage(1);
        setHasNewData(false);
        // Hide refresh button
        Animated.timing(slideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
        }).start();
        await fetchPosts(1, false);
        setRefreshing(false);
    }, [fetchPosts, slideAnim]);

    // Initial load: try cache first, then fetch fresh data
    useEffect(() => {
        const initializePosts = async () => {
            // Load from cache immediately for instant display
            const hasCachedData = await loadPostsFromCache();
            setLoading(false);
            
            // Fetch fresh data in background
            await fetchPosts(1, false);
        };
        
        initializePosts();
    }, []);

    // Check for new posts periodically when app comes to foreground
    useEffect(() => {
        if (!isFocused) {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
            return;
        }

        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(() => {
            if (!loading && !refreshing && !loadingMore) {
                checkForNewPosts();
            }
        }, NEW_POSTS_POLL_INTERVAL);

        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [isFocused, loading, refreshing, loadingMore, checkForNewPosts]);

    // Home should not trigger socket connect; connection is managed globally in App

    const handleLoadMore = () => {
        if (!loadingMore && hasMore && !error) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchPosts(nextPage, true);
        }
    };

    const handlePostCreated = useCallback((post: any) => {
        setPosts((prev: any[]) => [post, ...prev]);
    }, []);

    const handlePostDeleted = useCallback((postId: string) => {
        setPosts((prev: any[]) => prev.filter(post => post._id !== postId));
    }, []);

    const renderPost = useCallback(({ item }: { item: any }) => (
        <Post data={item} onPostDeleted={handlePostDeleted} />
    ), [handlePostDeleted]);

    const keyExtractor = useCallback((item: any, idx: number) => item._id || idx.toString(), []);

    const backgroundColor = themeColors.background.primary;
    const textColor = themeColors.text.primary;

    const listHeaderComponent = useMemo(() => (
        <View>
            <CreatePost onPostCreated={handlePostCreated} />
            <StorySlider />
        </View>
    ), [handlePostCreated]);

    const listEmptyComponent = useMemo(() => {
        if (loading) {
            return <PostSkeleton count={3} />;
        }
        if (error) {
            return (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
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
            <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: textColor }}>No posts found.</Text>
            </View>
        );
    }, [loading, error, themeColors, textColor]);

    const listFooterComponent = useMemo(() => (
        loadingMore && !loading ? <PostSkeleton count={1} /> : null
    ), [loadingMore, loading]);

    // Show error state
    if (error && !loading && posts.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor }}>
                <Text style={{ color: themeColors.status.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
                    {error}
                </Text>
                <Text style={{ color: textColor, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
                    Pull down to refresh or try again later.
                </Text>
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            </View>
        );
    }

    // Show debug info if debug mode is enabled
    if (debugMode) {
        return (
            <View style={{ flex: 1, backgroundColor }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: themeColors.border.primary }}>
                    <Text style={{ color: textColor, fontSize: 18, fontWeight: 'bold' }}>Debug Mode</Text>
                    <TouchableOpacity onPress={() => setDebugMode(false)} style={{ padding: 8 }}>
                        <Icon name="close" size={24} color={textColor} />
                    </TouchableOpacity>
                </View>
                <DebugInfo
                    user={null} // You can pass user data here if available
                    isLoading={loading}
                    isDarkMode={isDarkMode}
                    posts={posts}
                    profile={myProfile}
                />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor }}>
            {/* Refresh Button - appears when new data is available */}
            {hasNewData && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 60,
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        alignItems: 'center',
                        transform: [{ translateY: slideAnim }],
                    }}
                >
                    <TouchableOpacity
                        onPress={onRefresh}
                        disabled={refreshing}
                        style={{
                            backgroundColor: themeColors.primary,
                            paddingHorizontal: 24,
                            paddingVertical: 12,
                            borderRadius: 24,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                        }}
                        activeOpacity={0.8}
                    >
                        <Icon name="refresh" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 14 }}>
                            New posts available! Tap to refresh
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            <FlatList
                data={posts}
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
}

export default Home;
