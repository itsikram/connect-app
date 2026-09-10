import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { connectAPI } from '../lib/api';
import { useNavigation } from '@react-navigation/native';
import ConnectCardSkeleton from '../components/skeleton/ConnectCardSkeleton';
import ProfileImage from '../components/ProfileImage';
import ConnectCacheManager, {
  CONNECT_CACHE_EVENT,
} from '../utils/connectCacheManager';
import VerifiedName from '../components/VerifiedName';
import { profileDisplayName } from '../utils/reactTypes';

const uniqueById = (items: any[]) => {
  const seen = new Set<string>();
  return (Array.isArray(items) ? items : []).filter(item => {
    const id = String(item?._id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const Connects = () => {
  const navigation = useNavigation();
  const { colors: themeColors, isDarkMode } = useTheme();
  const backgroundColor = themeColors.background.primary;
  const cardBg = themeColors.surface.primary;
  const textColor = themeColors.text.primary;
  const subTextColor = themeColors.text.secondary;
  const buttonBg = themeColors.primary;
  const buttonText = themeColors.text.inverse;
  const removeBtnBg = themeColors.surface.secondary;
  const removeBtnText = themeColors.text.primary;
  const myProfile = useSelector((state: RootState) => state.profile);

  const [connectRequests, setConnectRequests] = useState<any[]>([]);
  const [connectSuggestions, setConnectSuggestions] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<{ id: string; action: string } | null>(null);
  const [profileLoadingId, setProfileLoadingId] = useState<string | null>(null);

  const fetchConnectData = useCallback(async () => {
    if (!myProfile?._id) return;

    try {
      setLoading(true);
      const [connectRequestsRes, connectSuggestionsRes] = await Promise.all([
        connectAPI.getConnectRequest(myProfile._id),
        connectAPI.getConnectSuggestions(myProfile._id),
      ]);

      const requests = uniqueById(connectRequestsRes.data);
      const suggestions = uniqueById(connectSuggestionsRes.data);
      setConnectRequests(requests);
      setConnectSuggestions(suggestions);
      await Promise.all([
        ConnectCacheManager.setCached(myProfile._id, 'requests', requests),
        ConnectCacheManager.setCached(myProfile._id, 'suggestions', suggestions),
      ]);
    } catch (error) {
      console.error('Error fetching connect data:', error);
    } finally {
      setLoading(false);
    }
  }, [myProfile?._id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConnectData();
    setRefreshing(false);
  }, [fetchConnectData]);

  useEffect(() => {
    let mounted = true;
    const loadConnectData = async () => {
      if (!myProfile?._id) return;
      const [cachedRequests, cachedSuggestions] = await Promise.all([
        ConnectCacheManager.getCached(myProfile._id, 'requests'),
        ConnectCacheManager.getCached(myProfile._id, 'suggestions'),
      ]);
      if (mounted && cachedRequests && cachedSuggestions) {
        setConnectRequests(cachedRequests);
        setConnectSuggestions(cachedSuggestions);
        setLoading(false);
      }
      await fetchConnectData();
    };
    loadConnectData();
    const subscription = DeviceEventEmitter.addListener(
      CONNECT_CACHE_EVENT,
      event => {
        if (!mounted || event?.profileId !== myProfile?._id) return;
        if (event.list === 'requests')
          setConnectRequests(uniqueById(event.items));
        if (event.list === 'suggestions')
          setConnectSuggestions(uniqueById(event.items));
      },
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [fetchConnectData]);

  const handleSendConnectRequest = async (connectId: string) => {
    if (actionLoading) return;
    setActionLoading({ id: connectId, action: 'send' });
    try {
      const res = await connectAPI.sendConnectRequest(connectId);
      console.log(res.data);
      setConnectSuggestions(prev => prev.filter((f: any) => f._id !== connectId));
      if (myProfile?._id)
        await ConnectCacheManager.removeProfile(
          myProfile._id,
          'suggestions',
          connectId,
        );
    } catch (error) {
      console.log(error);
    } finally {
      setActionLoading(null);
    }
  };
  const handleRemoveConnectRequest = async (connectId: string) => {
    if (actionLoading) return;
    setActionLoading({ id: connectId, action: 'remove' });
    try {
      const res = await connectAPI.removeConnect(connectId);
      console.log(res.data);
      // Hide from suggestions if present
      setConnectSuggestions(prev => prev.filter((f: any) => f._id !== connectId));
      if (myProfile?._id)
        await ConnectCacheManager.removeProfile(
          myProfile._id,
          'suggestions',
          connectId,
        );
    } catch (error) {
      console.log(error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptConnectRequest = async (connectId: string) => {
    if (actionLoading) return;
    setActionLoading({ id: connectId, action: 'accept' });
    console.log('accept connect request', connectId);
    try {
      const res = await connectAPI.acceptConnectRequest(connectId);
      console.log(res.data);
      // Remove the accepted request from the list
      setConnectRequests(prev => prev.filter((f: any) => f._id !== connectId));
      if (myProfile?._id) {
        await Promise.all([
          ConnectCacheManager.removeProfile(myProfile._id, 'requests', connectId),
          ConnectCacheManager.removeProfile(
            myProfile._id,
            'suggestions',
            connectId,
          ),
        ]);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConnectRequest = async (connectId: string) => {
    if (actionLoading) return;
    setActionLoading({ id: connectId, action: 'delete' });
    try {
      const res = await connectAPI.deleteConnectRequest(connectId);
      console.log(res.data);
      // Remove the deleted request from the list
      setConnectRequests(prev => prev.filter((f: any) => f._id !== connectId));
      if (myProfile?._id)
        await ConnectCacheManager.removeProfile(
          myProfile._id,
          'requests',
          connectId,
        );
    } catch (error) {
      console.log(error);
    } finally {
      setActionLoading(null);
    }
  };

  const navigateToConnectProfile = (connect: any) => {
    if (profileLoadingId) return;
    setProfileLoadingId(connect._id);
    (navigation as any).navigate('ConnectProfile', {
      connectId: connect._id,
      connectData: connect,
    });
  };

  return (
    <ScrollView
      style={[styles.connectsContent, { backgroundColor }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[themeColors.primary]}
          tintColor={themeColors.primary}
        />
      }
    >
      <View style={[styles.sectionContainer, { backgroundColor: cardBg }]}>
        <View style={styles.headingRow}>
          <Text style={[styles.headingTitle, { color: textColor }]}>
            Connect Requests
          </Text>
          <TouchableOpacity>
            <Text style={[styles.viewMoreBtn, { color: themeColors.primary }]}>
              See All
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.connectGridContainer}>
          {loading && <ConnectCardSkeleton count={4} />}
          {!loading &&
            connectRequests.length > 0 &&
            connectRequests.map((connect: any) => (
              <TouchableOpacity
                key={connect._id}
                style={[styles.connectGridItem, { backgroundColor: cardBg }]}
                onPress={() => navigateToConnectProfile(connect)}
                disabled={Boolean(profileLoadingId)}
              >
                <View style={styles.profilePictureWrapper}>
                  <ProfileImage
                    uri={connect.profilePic}
                    pixelSize={200}
                    style={styles.profilePicture}
                  />
                </View>
                <View style={styles.gridBody}>
                  <View style={styles.profileNameContainer}>
                    <VerifiedName
                      name={profileDisplayName(connect)}
                      verified={connect.isVerified}
                      textStyle={[styles.profileName, { color: textColor }]}
                      numberOfLines={2}
                      style={styles.profileNameRow}
                    />
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.addConnectBtn,
                        { backgroundColor: buttonBg },
                      ]}
                      onPress={() => {
                        handleAcceptConnectRequest(connect._id);
                      }}
                      disabled={Boolean(actionLoading)}
                    >
                      {actionLoading?.id === connect._id && actionLoading.action === 'accept' ? (
                        <ActivityIndicator size="small" color={buttonText} />
                      ) : <Text
                        style={[styles.addConnectBtnText, { color: buttonText }]}
                      >
                        Accept
                      </Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.removeConnectBtn,
                        { backgroundColor: removeBtnBg },
                      ]}
                      onPress={() => {
                        handleDeleteConnectRequest(connect._id);
                      }}
                      disabled={Boolean(actionLoading)}
                    >
                      {actionLoading?.id === connect._id && actionLoading.action === 'delete' ? (
                        <ActivityIndicator size="small" color={removeBtnText} />
                      ) : <Text
                        style={[
                          styles.removeConnectBtnText,
                          { color: removeBtnText },
                        ]}
                      >
                        Delete
                      </Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          {!loading && connectRequests.length === 0 && (
            <Text style={[styles.dataNotFound, { color: subTextColor }]}>
              You don't have any Connect Request to show
            </Text>
          )}
        </View>
      </View>

      <View
        style={[
          styles.sectionContainer,
          { marginBottom: 32, backgroundColor: cardBg },
        ]}
      >
        <View style={styles.headingRow}>
          <Text style={[styles.headingTitle, { color: textColor }]}>
            People You May Know
          </Text>
        </View>
        <View style={styles.connectGridContainer}>
          {loading && <ConnectCardSkeleton count={6} />}
          {!loading &&
            connectSuggestions.length > 0 &&
            connectSuggestions.map((connect: any) => (
              <TouchableOpacity
                key={connect._id}
                style={[styles.connectGridItem, { backgroundColor: cardBg }]}
                onPress={() => navigateToConnectProfile(connect)}
                disabled={Boolean(profileLoadingId)}
              >
                <View style={styles.profilePictureWrapper}>
                  <ProfileImage
                    uri={connect.profilePic}
                    pixelSize={200}
                    style={styles.profilePicture}
                  />
                </View>
                <View style={styles.gridBody}>
                  <View style={styles.profileNameContainer}>
                    <VerifiedName
                      name={profileDisplayName(connect)}
                      verified={connect.isVerified}
                      textStyle={[styles.profileName, { color: textColor }]}
                      numberOfLines={2}
                      style={styles.profileNameRow}
                    />
                  </View>
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={[
                        styles.addConnectBtn,
                        { backgroundColor: buttonBg },
                      ]}
                      onPress={() => {
                        handleSendConnectRequest(connect._id);
                      }}
                      disabled={Boolean(actionLoading)}
                    >
                      {actionLoading?.id === connect._id && actionLoading.action === 'send' ? (
                        <ActivityIndicator size="small" color={buttonText} />
                      ) : <Text
                        style={[styles.addConnectBtnText, { color: buttonText }]}
                      >
                        Add Connect
                      </Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.removeConnectBtn,
                        { backgroundColor: removeBtnBg },
                      ]}
                      onPress={() => {
                        handleRemoveConnectRequest(connect._id);
                      }}
                      disabled={Boolean(actionLoading)}
                    >
                      {actionLoading?.id === connect._id && actionLoading.action === 'remove' ? (
                        <ActivityIndicator size="small" color={removeBtnText} />
                      ) : <Text
                        style={[
                          styles.removeConnectBtnText,
                          { color: removeBtnText },
                        ]}
                      >
                        Remove
                      </Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          {!loading && connectSuggestions.length === 0 && (
            <Text style={[styles.dataNotFound, { color: subTextColor }]}>
              You don't have any Connect Suggestions to show
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  connectsContent: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    padding: 12,
    paddingBottom: 130,
  },
  sectionContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 18,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  viewMoreBtn: {
    color: '#007bff',
    fontSize: 15,
    fontWeight: '500',
  },
  connectGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  dataNotFound: {
    width: '100%',
    textAlign: 'center',
    color: '#888',
    fontSize: 15,
    marginVertical: 16,
  },
  connectGridItem: {
    width: '48%',
    borderRadius: 10,
    margin: '1%',
    padding: 10,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  profilePictureWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    marginBottom: 8,
    backgroundColor: '#eee',
  },
  profilePicture: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridBody: {
    alignItems: 'stretch',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 6,
    padding: 8,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#222',
    lineHeight: 22,
    textAlign: 'center',
  },
  profileNameContainer: {
    height: 44,
    justifyContent: 'center',
    marginBottom: 8,
  },
  profileNameRow: {
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'column',
    marginTop: 4,
    width: '100%',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addConnectBtn: {
    backgroundColor: '#29b1a9', // Using the primary color directly
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 3,
    width: '100%',
    alignSelf: 'stretch',
  },
  addConnectBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
  removeConnectBtn: {
    backgroundColor: '#eee',
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    width: '100%',
    alignSelf: 'stretch',
  },
  removeConnectBtnText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default Connects;
