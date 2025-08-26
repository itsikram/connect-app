import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { colors } from '../theme/colors';
import api from '../lib/api';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

type SearchResult = {
  users?: any[];
  posts?: any[];
  videos?: any[];
};

const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose }) => {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults({});
      setLoading(false);
      setError(null);
    }
  }, [visible]);

  const performSearch = useCallback(async (text: string) => {
    if (!text || text.trim().length === 0) {
      setResults({});
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/search?input=${encodeURIComponent(text)}`);
      setResults(res.data || {});
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Search failed');
      setResults({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(handler);
  }, [query, performSearch]);

  const backgroundColor = isDarkMode ? colors.background.dark : colors.background.light;
  const textColor = isDarkMode ? colors.text.light : colors.text.primary;

  const renderSection = (title: string, data?: any[], keyExtractor?: (item: any, index: number) => string) => {
    if (!data || data.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>{title}</Text>
        {data.slice(0, 10).map((item, idx) => (
          <View key={(keyExtractor ? keyExtractor(item, idx) : idx.toString())} style={styles.resultRow}>
            <Text numberOfLines={2} style={[styles.resultText, { color: textColor }]}>
              {item.fullName || item.caption || JSON.stringify(item)}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor }]}>        
        <View style={styles.searchBar}>
          <Icon name="search" size={22} color={colors.gray[600]} />
          <TextInput
            placeholder="Search people, posts, videos..."
            placeholderTextColor={colors.gray[600]}
            value={query}
            onChangeText={setQuery}
            style={[styles.input, { color: textColor }]}
            autoFocus
            returnKeyType="search"
          />
          <TouchableOpacity onPress={onClose}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: textColor, marginLeft: 8 }}>Searching...</Text>
          </View>
        )}

        {!!error && (
          <Text style={{ color: colors.error, paddingHorizontal: 16, paddingVertical: 8 }}>{error}</Text>
        )}

        <FlatList
          data={[1]}
          keyExtractor={() => 'results'}
          renderItem={() => (
            <View>
              {renderSection('Users', results.users, (item: any) => item._id)}
              {renderSection('Posts', results.posts, (item: any) => item._id)}
              {renderSection('Videos', results.videos, (item: any) => item._id)}
              {!loading && !error && !results.users && !results.posts && !results.videos && (
                <Text style={{ color: colors.gray[600], textAlign: 'center', marginTop: 24 }}>Type to start searching</Text>
              )}
            </View>
          )}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
    gap: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  resultRow: {
    paddingVertical: 8,
  },
  resultText: {
    fontSize: 14,
  },
});

export default SearchModal;


