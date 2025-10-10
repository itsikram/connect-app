import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, FlatList, Alert, RefreshControl, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent, Animated } from 'react-native';
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
// Modern components
import { ModernCard, ModernButton, ModernLoading } from '../components/modern';


const Home = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [debugMode, setDebugMode] = useState(false);
    const { colors: themeColors, isDarkMode } = useTheme();

    const { isConnected } = useSocket();
    const myProfile = useSelector((state: RootState) => state.profile);

    const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);

        try {
            setError(null);
            const res = await api.get(`/post/newsFeed?pageNumber=${pageNum}`);
            if (res.status === 200) {
                const newPosts = res.data.posts || [];
                setHasMore(res.data.hasNewPost); // use backend's hasNewPost
                setPosts(prev => append ? [...prev, ...newPosts] : newPosts);
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
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        setPage(1);
        await fetchPosts(1, false);
        setRefreshing(false);
    }, [fetchPosts]);

    useEffect(() => {
        fetchPosts(1, false);
    }, [fetchPosts]);

    // Home should not trigger socket connect; connection is managed globally in App

    const handleLoadMore = () => {
        if (!loadingMore && hasMore && !error) {
            const nextPage = page + 1;
            setPage(nextPage);
            fetchPosts(nextPage, true);
        }
    };

    const handlePostCreated = (post: any) => {
        setPosts((prev: any[]) => [post, ...prev]);
    };

    const handlePostDeleted = (postId: string) => {
        setPosts((prev: any[]) => prev.filter(post => post._id !== postId));
    };

    const backgroundColor = themeColors.background.primary;
    const textColor = themeColors.text.primary;

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



            <FlatList
                data={posts}
                keyExtractor={(item, idx) => item._id || idx.toString()}
                ListHeaderComponent={
                    <View>
                        <CreatePost onPostCreated={handlePostCreated} />

                        <StorySlider />
                    </View>
                }
                renderItem={({ item }) => <Post key={item._id} data={item} onPostDeleted={handlePostDeleted} />}
                ListEmptyComponent={loading ? (
                    <PostSkeleton count={3} />
                ) : error ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Text style={{ color: themeColors.status.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
                            {error}
                        </Text>
                        <Text style={{ color: textColor, fontSize: 14, textAlign: 'center' }}>
                            Pull down to refresh
                        </Text>
                    </View>
                ) : (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Text style={{ color: textColor }}>No posts found.</Text>
                    </View>
                )}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loadingMore && !loading ? (
                    <PostSkeleton count={1} />
                ) : null}
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
            />
        </View>
    );
}

export default Home;
