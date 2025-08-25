import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Text, useColorScheme, View } from 'react-native';
import api from '../lib/api';
import { colors } from '../theme/colors';

type FeedPost = {
  _id: string;
  urls?: string;
  photos?: string;
  type?: string;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const isVideoPost = (post: FeedPost) => {
  const url = (post.urls || post.photos || '').toLowerCase();
  return post.type === 'video' || url.endsWith('.mp4') || url.includes('/video');
};

const VideoPlaceholder = ({ textColor }: { textColor: string }) => (
  <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: textColor }}>Video will play here</Text>
    <Text style={{ color: textColor, marginTop: 6, opacity: 0.7 }}>Install react-native-video to enable playback</Text>
  </View>
);

const VideoItem = ({ post, isActive, isDarkMode }: { post: FeedPost; isActive: boolean; isDarkMode: boolean }) => {
  const textColor = isDarkMode ? colors.text.light : colors.text.primary;

  // Lazy require to avoid hard dependency if package is missing
  let VideoComp: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    VideoComp = require('react-native-video').default;
  } catch (_) {
    VideoComp = null;
  }

  if (!VideoComp) {
    return <VideoPlaceholder textColor={textColor} />;
  }

  const sourceUri = post.urls || post.photos;

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH, backgroundColor: isDarkMode ? '#000' : '#000' }}>
      {sourceUri ? (
        <VideoComp
          source={{ uri: sourceUri }}
          style={{ height: '100%', width: '100%' }}
          resizeMode="cover"
          paused={!isActive}
          repeat
          muted={false}
        />
      ) : (
        <VideoPlaceholder textColor={textColor} />
      )}
    </View>
  );
};

const Videos = () => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';

  const [videos, setVideos] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await api.get(`watch/myWatchs`);
      console.log('video res', res)
      if (res.status === 200) {
        const posts: FeedPost[] = res.data.posts || [];
        const onlyVideos = posts.filter(isVideoPost);
        setHasMore(Boolean(res.data.hasNewPost));
        setVideos(prev => (append ? [...prev, ...onlyVideos] : onlyVideos));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(e);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed(1, false);
  }, [fetchFeed]);

  const onEndReached = () => {
    if (!loadingMore && hasMore) {
      const next = page + 1;
      setPage(next);
      fetchFeed(next, true);
    }
  };

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 80 }), []);
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems && viewableItems.length > 0) {
      const first = viewableItems[0];
      if (typeof first.index === 'number') setActiveIndex(first.index);
    }
  }).current;

  const backgroundColor = isDarkMode ? colors.background.dark : colors.background.light;
  const textColor = isDarkMode ? colors.text.light : colors.text.primary;

  if (loading && videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      keyExtractor={(item, idx) => item._id || String(idx)}
      renderItem={({ item, index }) => (
        <VideoItem post={item} isActive={index === activeIndex} isDarkMode={isDarkMode} />
      )}
      pagingEnabled
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.8}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      ListEmptyComponent={
        <View style={{ height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor }}>No videos found.</Text>
        </View>
      }
    />
  );
};

export default Videos;


