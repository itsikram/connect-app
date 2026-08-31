import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import KeyboardSafeView from './KeyboardSafeView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { getColorWithOpacity } from '../theme/colors';
import api from '../lib/api';
import UserPP from './UserPP';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

type ResultType = 'user' | 'video' | 'post';

type SearchItem = {
  id: string;
  type: ResultType;
  label: string;
  sublabel: string;
  profilePic?: string;
  profileId?: string;
  mediaUrl?: string | null;
};

const RECENT_SEARCH_KEY = 'headerRecentSearches';
const MAX_RECENT_SEARCHES = 8;
const MAX_RESULTS_PER_SECTION = 5;
const SEARCH_DEBOUNCE_MS = 280;

const TYPE_META: Record<ResultType, { icon: string; label: string }> = {
  user: { icon: 'person-outline', label: 'Profile' },
  video: { icon: 'videocam', label: 'Video' },
  post: { icon: 'article', label: 'Post' },
};

const emptySearchData = { users: [] as any[], posts: [] as any[], videos: [] as any[] };

const escapeRegExp = (value: string) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getDisplayName = (profile: any) =>
  profile?.fullName ||
  profile?.displayName ||
  profile?.nickname ||
  profile?.username ||
  'Unknown';

const truncateText = (text: unknown, wordCount = 8) => {
  if (!text) return '';
  const words = String(text).trim().split(/\s+/);
  if (words.length <= wordCount) return words.join(' ');
  return `${words.slice(0, wordCount).join(' ')}…`;
};

const isVideoFileUrl = (url: string) =>
  /\.(mp4|webm|mov|m4v|avi)(\?|#|$)/i.test(String(url || ''));

const getPostImage = (photos: unknown): string | null => {
  const pick = (value: unknown) => {
    if (!value || typeof value !== 'string') return null;
    const url = value.trim();
    if (!url || isVideoFileUrl(url)) return null;
    return url;
  };

  if (Array.isArray(photos)) {
    return (photos.map(pick).find(Boolean) as string | undefined) || null;
  }

  const raw = String(photos || '').trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return (parsed.map(pick).find(Boolean) as string | undefined) || null;
    }
    return pick(parsed);
  } catch {
    return pick(raw.split(',')[0]);
  }
};

const buildFlatResults = (data: typeof emptySearchData): SearchItem[] => {
  const users = (data?.users || []).slice(0, MAX_RESULTS_PER_SECTION).map((item: any) => ({
    id: `user-${item._id}`,
    type: 'user' as const,
    label: getDisplayName(item),
    sublabel: item.username ? `@${item.username}` : item.nickname || 'Profile',
    profilePic: item.profilePic,
    profileId: item._id,
  }));

  const videos = (data?.videos || []).slice(0, MAX_RESULTS_PER_SECTION).map((item: any) => ({
    id: `video-${item._id}`,
    type: 'video' as const,
    label: truncateText(item.caption) || 'Untitled video',
    sublabel: item.author ? getDisplayName(item.author) : 'Video',
    profilePic: item.author?.profilePic,
    profileId: item.author?._id,
    mediaUrl: item.thumbnail || null,
  }));

  const posts = (data?.posts || []).slice(0, MAX_RESULTS_PER_SECTION).map((item: any) => ({
    id: `post-${item._id}`,
    type: 'post' as const,
    label: truncateText(item.caption) || 'Untitled post',
    sublabel: item.author ? getDisplayName(item.author) : 'Post',
    profilePic: item.author?.profilePic,
    profileId: item.author?._id,
    mediaUrl: getPostImage(item.photos),
  }));

  return [...users, ...videos, ...posts];
};

const HighlightMatch = ({
  text,
  query,
  color,
  highlightBg,
}: {
  text: string;
  query: string;
  color: string;
  highlightBg: string;
}) => {
  const value = String(text || '');
  const q = String(query || '').trim();
  if (!value || !q) {
    return (
      <Text numberOfLines={1} style={[styles.resultLabel, { color }]}>
        {value}
      </Text>
    );
  }

  const parts = value.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return (
    <Text numberOfLines={1} style={[styles.resultLabel, { color }]}>
      {parts.map((part, index) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <Text key={`${part}-${index}`} style={{ backgroundColor: highlightBg, borderRadius: 3 }}>
            {part}
          </Text>
        ) : (
          <Text key={`${part}-${index}`}>{part}</Text>
        ),
      )}
    </Text>
  );
};

const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose }) => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const [searchedData, setSearchedData] = useState(emptySearchData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<SearchItem[]>([]);
  const [inputFocused, setInputFocused] = useState(true);

  const overlay = useCallback(
    (opacity: number) => (isDarkMode ? `rgba(255,255,255,${opacity})` : `rgba(0,0,0,${opacity})`),
    [isDarkMode],
  );

  const primary = themeColors.primary;
  const textColor = themeColors.text.primary;
  const mutedColor = themeColors.text.tertiary;
  const trimmedQuery = query.trim();
  const liveResults = useMemo(() => buildFlatResults(searchedData), [searchedData]);
  const showingRecents = visible && !trimmedQuery && recentSearches.length > 0;
  const hasAnyLiveResults = liveResults.length > 0;
  const peopleResults = liveResults.filter((item) => item.type === 'user');
  const videoResults = liveResults.filter((item) => item.type === 'video');
  const postResults = liveResults.filter((item) => item.type === 'post');

  const resultsMaxHeight = Math.max(
    240,
    Dimensions.get('window').height - insets.top - insets.bottom - 96,
  );

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setSearchedData(emptySearchData);
      setLoading(false);
      setError(null);
      setInputFocused(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(RECENT_SEARCH_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        if (!cancelled && Array.isArray(parsed)) {
          setRecentSearches(parsed);
        }
      } catch {
        if (!cancelled) setRecentSearches([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  const persistRecentSearches = useCallback((items: SearchItem[]) => {
    AsyncStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(items)).catch(() => {});
  }, []);

  const performSearch = useCallback(async (text: string) => {
    if (!text || text.trim().length === 0) {
      setSearchedData(emptySearchData);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/search?input=${encodeURIComponent(text)}`);
      setSearchedData({
        users: res.data?.users || [],
        posts: res.data?.posts || [],
        videos: res.data?.videos || [],
      });
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Search failed');
      setSearchedData(emptySearchData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handler = setTimeout(() => performSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handler);
  }, [query, performSearch, visible]);

  const saveRecentSearch = useCallback(
    (item: SearchItem) => {
      setRecentSearches((prev) => {
        const next = [
          item,
          ...prev.filter((entry) => entry.id !== item.id),
        ].slice(0, MAX_RECENT_SEARCHES);
        persistRecentSearches(next);
        return next;
      });
    },
    [persistRecentSearches],
  );

  const removeRecentSearch = useCallback(
    (id: string) => {
      setRecentSearches((prev) => {
        const next = prev.filter((entry) => entry.id !== id);
        persistRecentSearches(next);
        return next;
      });
    },
    [persistRecentSearches],
  );

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    persistRecentSearches([]);
  }, [persistRecentSearches]);

  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  const handleBack = useCallback(() => {
    if (trimmedQuery) {
      setQuery('');
      setSearchedData(emptySearchData);
      setError(null);
      return;
    }
    handleClose();
  }, [handleClose, trimmedQuery]);

  const goToSearchItem = useCallback(
    (item: SearchItem) => {
      saveRecentSearch(item);
      handleClose();
      const nav = navigation as any;
      try {
        if (item.type === 'user' && item.profileId) {
          nav.navigate('Home', {
            screen: 'FriendProfile',
            params: { friendId: item.profileId },
          });
          return;
        }
        if (item.type === 'post') {
          nav.navigate('Home', {
            screen: 'SinglePost',
            params: { postId: item.id.replace(/^post-/, '') },
          });
          return;
        }
        if (item.type === 'video') {
          nav.navigate('Videos', {
            screen: 'SingleWatch',
            params: { watchId: item.id.replace(/^video-/, '') },
          });
        }
      } catch (_) {}
    },
    [handleClose, navigation, saveRecentSearch],
  );

  const renderThumb = (item: SearchItem) => {
    const meta = TYPE_META[item.type];
    if (item.mediaUrl) {
      const isVideo = item.type === 'video';
      const isPost = item.type === 'post';
      return (
        <View
          style={[
            styles.thumb,
            isVideo && styles.videoThumb,
            isPost && styles.postThumb,
            { borderColor: overlay(0.1), backgroundColor: 'rgba(0,0,0,0.35)' },
          ]}
        >
          <Image source={{ uri: item.mediaUrl }} style={styles.thumbImage} />
          {isVideo && (
            <View style={styles.playOverlay}>
              <Icon name="play-arrow" size={14} color="#FFFFFF" />
            </View>
          )}
        </View>
      );
    }

    if (item.profilePic) {
      return (
        <View style={[styles.thumb, { borderColor: overlay(0.1) }]}>
          <UserPP image={item.profilePic} size={38} />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.thumb,
          styles.fallbackThumb,
          { borderColor: overlay(0.1), backgroundColor: overlay(0.08) },
        ]}
      >
        <Icon name={meta.icon} size={18} color={mutedColor} />
      </View>
    );
  };

  const renderResultItem = (item: SearchItem, { isRecent = false } = {}) => {
    const meta = TYPE_META[item.type];
    return (
      <Pressable
        key={item.id}
        onPress={() => goToSearchItem(item)}
        style={({ pressed }) => [
          styles.resultRow,
          pressed && {
            backgroundColor: getColorWithOpacity(primary, 0.15),
            transform: [{ translateX: 3 }],
          },
        ]}
      >
        {renderThumb(item)}
        <View style={styles.resultCopy}>
          <HighlightMatch
            text={item.label}
            query={trimmedQuery}
            color={textColor}
            highlightBg={getColorWithOpacity(primary, 0.28)}
          />
          <View style={styles.sublabelRow}>
            <Icon name={meta.icon} size={12} color={mutedColor} />
            <Text numberOfLines={1} style={[styles.sublabel, { color: mutedColor }]}>
              {isRecent ? `Recent · ${meta.label}` : item.sublabel}
            </Text>
          </View>
        </View>
        {isRecent && (
          <TouchableOpacity
            onPress={() => removeRecentSearch(item.id)}
            hitSlop={10}
            style={styles.recentRemove}
            accessibilityLabel={`Remove ${item.label} from recent searches`}
          >
            <Icon name="close" size={16} color={mutedColor} />
          </TouchableOpacity>
        )}
      </Pressable>
    );
  };

  const renderSection = (
    title: string,
    icon: string,
    items: SearchItem[],
    extraHeader?: React.ReactNode,
    isLast = false,
  ) => {
    if (!items.length) return null;
    return (
      <View
        style={[
          styles.section,
          { borderBottomColor: overlay(0.1) },
          isLast && styles.sectionLast,
        ]}
      >
        <View style={styles.sectionHeading}>
          <View style={styles.sectionTitleRow}>
            <Icon name={icon} size={14} color={mutedColor} />
            <Text style={[styles.sectionTitle, { color: overlay(0.5) }]}>{title}</Text>
          </View>
          {extraHeader}
        </View>
        {items.map((item) => renderResultItem(item, { isRecent: title === 'Recent' }))}
      </View>
    );
  };

  const renderEmptyState = (
    icon: string,
    title: React.ReactNode,
    subtitle: string,
    spinning = false,
  ) => (
    <View style={styles.emptyState}>
      {spinning ? (
        <ActivityIndicator size="small" color={primary} style={{ marginBottom: 8 }} />
      ) : (
        <Icon name={icon} size={32} color={overlay(0.28)} style={{ marginBottom: 8 }} />
      )}
      <Text style={[styles.emptyTitle, { color: textColor }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.emptySubtitle, { color: mutedColor }]}>{subtitle}</Text>}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <KeyboardSafeView force nested>
        <View style={styles.flex}>
          <Pressable style={styles.backdrop} onPress={handleClose} />

          <View
            style={[
              styles.sheet,
              {
                paddingTop: Math.max(insets.top, 8) + 8,
                paddingLeft: Math.max(insets.left, 10),
                paddingRight: Math.max(insets.right, 10),
                paddingBottom: insets.bottom + 12,
              },
            ]}
            pointerEvents="box-none"
          >
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: themeColors.surface.secondary,
                  borderColor: inputFocused ? primary : overlay(0.08),
                  shadowColor: inputFocused ? primary : '#000',
                },
              ]}
            >
              <View style={styles.searchBarHighlight} />
              <TouchableOpacity
                onPress={handleBack}
                style={[styles.backButton, { backgroundColor: overlay(0.08) }]}
                accessibilityLabel={trimmedQuery ? 'Clear search' : 'Close search'}
              >
                <Icon name="arrow-back" size={18} color={textColor} />
              </TouchableOpacity>

              <View style={styles.inputWrap}>
                <TextInput
                  placeholder="Search"
                  placeholderTextColor={overlay(0.45)}
                  value={query}
                  onChangeText={setQuery}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  style={[styles.input, { color: textColor }]}
                  autoFocus
                  returnKeyType="search"
                  autoCorrect={false}
                  autoCapitalize="none"
                  spellCheck={false}
                />
                {!!trimmedQuery && (
                  <TouchableOpacity
                    onPress={() => {
                      setQuery('');
                      setSearchedData(emptySearchData);
                    }}
                    style={[styles.clearButton, { backgroundColor: overlay(0.12) }]}
                    accessibilityLabel="Clear search"
                  >
                    <Icon name="close" size={14} color={textColor} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View
              style={[
                styles.resultsPanel,
                {
                  backgroundColor: themeColors.surface.elevated,
                  borderColor: themeColors.border.primary,
                  maxHeight: resultsMaxHeight,
                },
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.resultsContent}
              >
                {showingRecents &&
                  renderSection(
                    'Recent',
                    'history',
                    recentSearches,
                    <TouchableOpacity onPress={clearRecentSearches}>
                      <Text style={[styles.clearAll, { color: primary }]}>Clear all</Text>
                    </TouchableOpacity>,
                    true,
                  )}

                {!trimmedQuery && !showingRecents &&
                  renderEmptyState(
                    'search',
                    'Search people, posts, and videos',
                    'Start typing a name or keyword',
                  )}

                {!!trimmedQuery && loading && !hasAnyLiveResults &&
                  renderEmptyState('search', 'Searching…', 'Looking through people, posts, and videos', true)}

                {!!error && !loading &&
                  renderEmptyState('error-outline', error, 'Please try again in a moment')}

                {!!trimmedQuery && !loading && !error && !hasAnyLiveResults &&
                  renderEmptyState(
                    'search',
                    <>
                      No results for <Text style={{ fontWeight: '700' }}>{trimmedQuery}</Text>
                    </>,
                    'Try a different name or keyword',
                  )}

                {!!trimmedQuery &&
                  renderSection(
                    'People',
                    'person-outline',
                    peopleResults,
                    undefined,
                    videoResults.length === 0 && postResults.length === 0,
                  )}
                {!!trimmedQuery &&
                  renderSection(
                    'Videos',
                    'videocam',
                    videoResults,
                    undefined,
                    postResults.length === 0,
                  )}
                {!!trimmedQuery &&
                  renderSection('Posts', 'article', postResults, undefined, true)}
              </ScrollView>
            </View>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    gap: 6,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 12,
  },
  searchBarHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    paddingVertical: 0,
    paddingLeft: 8,
    fontWeight: '400',
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  resultsPanel: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 14,
  },
  resultsContent: {
    padding: 10,
  },
  section: {
    marginBottom: 4,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  clearAll: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginVertical: 2,
  },
  thumb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postThumb: {
    borderRadius: 10,
  },
  videoThumb: {
    width: 58,
    height: 36,
    borderRadius: 8,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackThumb: {
    overflow: 'hidden',
  },
  resultCopy: {
    flex: 1,
    minWidth: 0,
  },
  resultLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  sublabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  sublabel: {
    flex: 1,
    fontSize: 12,
  },
  recentRemove: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    opacity: 0.85,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
});

export default SearchModal;
