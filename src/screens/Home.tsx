import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import CreatePost from '../components/CreatePost';
import api from '../lib/api';
import Post from '../components/Post';

const Home = () => {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPosts = async () => {
            try {
                const res = await api.get('/post/newsFeed');
                if (res.status === 200) {
                    console.log('res posts', res)
                    setPosts(res.data.posts || []);
                }
            } catch (e) {
                console.log(e);
            } finally {
                setLoading(false);
            }
        };
        fetchPosts();
    }, []);

    return (
        <ScrollView>
            <CreatePost onPostCreated={post => setPosts((prev: any[]) => [post, ...prev])} />
            {loading ? (
                <ActivityIndicator size="large" style={{ marginTop: 40 }} />
            ) : posts.length === 0 ? (
                <View style={{ alignItems: 'center', marginTop: 40 }}>
                    <Text>No posts found.</Text>
                </View>
            ) : (
                posts.map((post: any, idx: number) => (
                    <Post key={post._id || idx} data={post} index={idx} />
                ))
            )}
        </ScrollView>
    );
}

export default Home;
