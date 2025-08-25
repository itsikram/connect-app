import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ActivityIndicator, FlatList, useColorScheme, Alert } from 'react-native';
import CreatePost from '../components/CreatePost';
import api from '../lib/api';
import Post from '../components/Post';
import { colors } from '../theme/colors';
import { useSocket } from '../contexts/SocketContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

const Home = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const colorScheme = useColorScheme();
    const isDarkMode = colorScheme === 'dark';
    
    const { connect, isConnected } = useSocket();
    const myProfile = useSelector((state: RootState) => state.profile);

    const fetchPosts = useCallback(async (pageNum = 1, append = false) => {
        if (append) setLoadingMore(true);
        else setLoading(true);
        try {
            const res = await api.get(`/post/newsFeed?pageNumber=${pageNum}`);
            if (res.status === 200) {
                const newPosts = res.data.posts || [];
                setHasMore(res.data.hasNewPost); // use backend's hasNewPost
                setPosts(prev => append ? [...prev, ...newPosts] : newPosts);
            }
        } catch (e) {
            console.log(e);
        } finally {
            if (append) setLoadingMore(false);
            else setLoading(false);
        }
    }, []);

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
                    Alert.alert('Connection Error', 'Failed to connect to real-time service');
                });
        }
    }, [myProfile?._id, isConnected, connect]);

    const handleLoadMore = () => {
        if (!loadingMore && hasMore) {
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

    return (
        <FlatList
            data={posts}
            keyExtractor={(item, idx) => item._id || idx.toString()}
            ListHeaderComponent={<CreatePost onPostCreated={handlePostCreated} />}
            renderItem={({ item }) => <Post key={item._id} data={item} />}
            ListEmptyComponent={loading ? (
                <ActivityIndicator size="large" style={{ marginTop: 40 }} />
            ) : (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Text style={{ color: textColor }}>No posts found.</Text>
                </View>
            )}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={loadingMore ? <ActivityIndicator size="small" style={{ marginVertical: 16 }} /> : null}
            style={{ backgroundColor }}
            contentContainerStyle={{ backgroundColor, flexGrow: 1 }}
        />
    );
}

export default Home;
