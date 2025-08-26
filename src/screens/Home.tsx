import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, FlatList, useColorScheme, Alert, RefreshControl, TouchableOpacity, NativeSyntheticEvent, NativeScrollEvent, Animated } from 'react-native';
import CreatePost from '../components/CreatePost';
import api from '../lib/api';
import Post from '../components/Post';
import { colors } from '../theme/colors';
import { useSocket } from '../contexts/SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import DebugInfo from '../components/DebugInfo';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useHeaderVisibility } from '../contexts/HeaderVisibilityContext';

const Home = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [debugMode, setDebugMode] = useState(false);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    
    const { connect, isConnected } = useSocket();
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

    // Connect to socket when component mounts
    useEffect(() => {
        if (myProfile?._id && !isConnected) {
            connect(myProfile._id)
                .then(() => {
                    console.log('Socket connected successfully in Home component');
                })
                .catch((error) => {
                    console.error('Failed to connect socket in Home component:', error);
                    // Don't show alert for socket connection issues as they're not critical
                });
        }
    }, [myProfile?._id, isConnected, connect]);

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

    const backgroundColor = isDarkMode ? colors.background.dark : colors.background.light;
    const textColor = isDarkMode ? colors.text.light : colors.text.primary;
    const { handleScroll, spacerHeight } = useHeaderVisibility();

    // Show error state
    if (error && !loading && posts.length === 0) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor }}>
                <Text style={{ color: colors.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
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
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border.light }}>
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
            {/* Debug toggle button */}
            <TouchableOpacity 
                onPress={() => setDebugMode(true)}
                style={{ 
                    position: 'absolute', 
                    top: 50, 
                    right: 16, 
                    zIndex: 1000,
                    backgroundColor: colors.primary,
                    padding: 8,
                    borderRadius: 20,
                    opacity: 0.7
                }}
            >
                <Icon name="bug-report" size={20} color={colors.white} />
            </TouchableOpacity>
            
            <FlatList
                data={posts}
                keyExtractor={(item, idx) => item._id || idx.toString()}
                ListHeaderComponent={
                    <>
                        <Animated.View style={{ height: spacerHeight }} />
                        <CreatePost onPostCreated={handlePostCreated} />
                    </>
                }
                renderItem={({ item }) => <Post key={item._id} data={item} />}
                ListEmptyComponent={loading ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ color: textColor, marginTop: 16 }}>Loading posts...</Text>
                    </View>
                ) : error ? (
                    <View style={{ alignItems: 'center', marginTop: 40 }}>
                        <Text style={{ color: colors.error, fontSize: 16, textAlign: 'center', marginBottom: 16 }}>
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
                ListFooterComponent={loadingMore ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={{ color: textColor, marginTop: 8 }}>Loading more...</Text>
                    </View>
                ) : null}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[colors.primary]}
                        tintColor={colors.primary}
                    />
                }
                style={{ backgroundColor }}
                contentContainerStyle={{ backgroundColor, flexGrow: 1 }}
                onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => handleScroll(e.nativeEvent.contentOffset.y)}
                scrollEventThrottle={16}
            />
        </View>
    );
}

export default Home;
