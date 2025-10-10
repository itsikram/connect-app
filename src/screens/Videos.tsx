import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Text, View, NativeSyntheticEvent, NativeScrollEvent, AppState, AppStateStatus, Image, TouchableOpacity, Pressable, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import api from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
// Use lazy require for react-native-video to avoid crash if the package/linking is missing
import { useFocusEffect } from '@react-navigation/native';
import UserPP from '../components/UserPP';

type Video = {
  _id: string;
  videoUrl?: string;
  caption?: string;
  photos?: string;
  type?: string;
  author?: {
    username?: string;
    fullName?: string;
    profilePic?: string;
    isActive?: boolean;
  };
  user?: {
    name?: string;
    username?: string;
    avatar?: string;
    profilePicture?: string;
    photo?: string;
  };
  likesCount?: number;
  commentsCount?: number;
};

type RootStackParamList = {
  SingleVideo: { videoId: string };
  [key: string]: any;
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

const isVideoPost = (post: Video) => {
  const url = (post?.videoUrl || post.photos || '').toLowerCase();
  return post.type === 'video' || url.endsWith('.mp4') || url.includes('/video');
};

const VideoPlaceholder = ({ textColor }: { textColor: string }) => (
  <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ color: textColor }}>Video will play here</Text>
    <Text style={{ color: textColor, marginTop: 6, opacity: 0.7 }}>Install react-native-video to enable playback</Text>
  </View>
);

const VideoItem = ({ post, isActive, isDarkMode, containerHeight }: { post: Video; isActive: boolean; isDarkMode: boolean; containerHeight: number }) => {
  const { colors: themeColors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const textColor = themeColors.text.primary;

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

  const sourceUri = post?.videoUrl || post.photos;
  const overlayTextColor = '#fff';
  const overlayMutedColor = 'rgba(255,255,255,0.8)';

  const authorName = post?.author?.fullName || post?.user?.name || post?.author?.username || post?.user?.username || 'Unknown';
  const authorAvatar = post?.author?.profilePic || post?.user?.avatar || post?.user?.profilePicture || post?.user?.photo || '';
  const authorIsActive = post?.author?.isActive || false;
  const likesDisplay = typeof post?.likesCount === 'number' ? post.likesCount : undefined;
  const commentsDisplay = typeof post?.commentsCount === 'number' ? post.commentsCount : undefined;

  const [isManuallyPaused, setIsManuallyPaused] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsManuallyPaused(false);
    }
  }, [isActive]);

  return (
    <View style={{ height: containerHeight, width: SCREEN_WIDTH, backgroundColor: isDarkMode ? '#000' : '#000', justifyContent: 'center', alignItems: 'center' }}>
      {sourceUri ? (
        <>
          <VideoComp
            source={{ uri: sourceUri }}
            style={{ height: 400, width: SCREEN_WIDTH }}
            resizeMode="contain"
            paused={!isActive || isManuallyPaused}
            playInBackground
            playWhenInactive
            ignoreSilentSwitch="ignore"
            repeat
            muted={false}
            useTextureView
            onError={(err: any) => {
              // eslint-disable-next-line no-console
              console.log('Video error', err);
            }}
          />
          <Pressable onPress={() => setIsManuallyPaused(p => !p)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10 }} />
          
          {/* Navigation to SingleVideo */}
          <TouchableOpacity
            onPress={() => navigation.navigate('SingleVideo', { videoId: post._id })}
            style={{
              position: 'absolute',
              top: 20,
              left: 20,
              zIndex: 15,
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon name="open-outline" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
              View Details
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <VideoPlaceholder textColor={textColor} />
      )}
      {isManuallyPaused && (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 11 }}>
          <Icon name="play" size={48} color={overlayTextColor} />
        </View>
      )}

      <View style={{ position: 'absolute', right: 12, bottom: 140, alignItems: 'center', zIndex: 12 }}>
        <TouchableOpacity onPress={() => {}} activeOpacity={0.8} style={{ alignItems: 'center', marginBottom: 18 }}>
          <Icon name="heart" size={28} color={overlayTextColor} />
          {typeof likesDisplay === 'number' && (
            <Text style={{ color: overlayMutedColor, marginTop: 4, fontSize: 12 }}>{likesDisplay}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} activeOpacity={0.8} style={{ alignItems: 'center', marginBottom: 18 }}>
          <Icon name="chatbubble-ellipses" size={26} color={overlayTextColor} />
          {typeof commentsDisplay === 'number' && (
            <Text style={{ color: overlayMutedColor, marginTop: 4, fontSize: 12 }}>{commentsDisplay}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} activeOpacity={0.8} style={{ alignItems: 'center', marginBottom: 18 }}>
          <Icon name="share-social" size={26} color={overlayTextColor} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {}} activeOpacity={0.8} style={{ alignItems: 'center' }}>
          <Icon name="ellipsis-vertical" size={24} color={overlayTextColor} />
        </TouchableOpacity>
      </View>


      <View style={{ position: 'absolute', left: 12, right: 80, bottom: 80, zIndex: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 }}>
          {authorAvatar ? (
            <UserPP size={40} image={authorAvatar} isActive={authorIsActive} />
          ) : (
            <View style={{ width: 40, height: 40, marginLeft: 20, borderRadius: 20, marginRight: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="person" size={22} color={overlayTextColor} />
            </View>
          )}
          <Text style={{ color: overlayTextColor, fontWeight: 'bold', fontSize: 16 }} numberOfLines={1}>{authorName}</Text>
          <TouchableOpacity onPress={() => {}} activeOpacity={0.8} style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)' }}>
            <Text style={{ color: overlayTextColor, fontSize: 12 }}>Follow</Text>
          </TouchableOpacity>
        </View>
        {!!post?.caption && (
          <Text style={{ color: overlayMutedColor, fontSize: 14 }} numberOfLines={2}>{post.caption}</Text>
        )}
      </View>
    </View>
  );
};

const Videos = () => {
  const { isDarkMode } = useTheme();

  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [listHeight, setListHeight] = useState(SCREEN_HEIGHT);
  const [isAppBackgrounded, setIsAppBackgrounded] = useState(false);
  const myProfile = useSelector((state: RootState) => state.profile);

  const fetchFeed = useCallback(async (pageNum = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await api.get(`watch/profileWatch?pageNumber=${pageNum}`);
      if (res.status === 200) {
        const data = res.data || {};
        const items: Video[] = Array.isArray(data.watchs) ? data.watchs : Array.isArray(data) ? data : [];
        const more = typeof data.hasNewWatch === 'boolean' ? data.hasNewWatch : false;
        setHasMore(more);
        setVideos(prev => (append ? [...prev, ...items] : items));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('Failed to load videos', e);
    } finally {
      if (append) setLoadingMore(false); else setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setPage(1);
    await fetchFeed(1, false);
    setRefreshing(false);
  }, [fetchFeed]);

  useEffect(() => {
    fetchFeed(1, false);
  }, [fetchFeed]);

  // Pause videos when screen loses focus
  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
      };
    }, [])
  );

  // Track app state to allow background playback when app is backgrounded/locked
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      setIsAppBackgrounded(nextAppState !== 'active');
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    // Initialize current state
    handleAppStateChange(AppState.currentState);
    return () => {
      subscription.remove();
    };
  }, []);

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

  const backgroundColor = isDarkMode ? '#000' : '#000';
  const textColor = '#fff';

  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const newIndex = Math.round(offsetY / listHeight);
    if (newIndex !== activeIndex) setActiveIndex(newIndex);
  }, [activeIndex, listHeight]);

  if (loading && videos.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <FlatList
      data={videos}
      keyExtractor={(item, idx) => item._id || String(idx)}
      renderItem={({ item, index }) => (
        <VideoItem
          post={item}
          isActive={index === activeIndex && (isScreenFocused || isAppBackgrounded)}
          isDarkMode={isDarkMode}
          containerHeight={listHeight}
        />
      )}
      pagingEnabled
      onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
      onMomentumScrollEnd={onMomentumScrollEnd}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.8}
      viewabilityConfig={viewabilityConfig}
      onViewableItemsChanged={onViewableItemsChanged}
      ListFooterComponent={loadingMore ? (
        <View style={{ height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#fff']}
          tintColor="#fff"
        />
      }
      ListEmptyComponent={
        <View style={{ height: SCREEN_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: textColor }}>No videos found.</Text>
        </View>
      }
    />
  );
};

export default Videos;


