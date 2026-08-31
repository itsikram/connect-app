import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFeedTokens } from '../theme/feedTokens';
import { formatBilingualPrompt, getDailyIcebreaker, isoDateKey } from '../utils/feedPrompts';

const WELCOME_KEY = 'feedBoost:welcomeDismissed';
const icebreakerKey = () => `feedBoost:icebreaker:${isoDateKey()}`;

type FeedBoostCardsProps = {
  onPostPrompt?: (caption: string) => void;
  feedLoaded?: boolean;
  postCount?: number;
};

const FeedBoostCards: React.FC<FeedBoostCardsProps> = ({
  onPostPrompt,
  feedLoaded,
  postCount = 0,
}) => {
  const navigation = useNavigation<any>();
  const feed = useFeedTokens();
  const icebreaker = useMemo(() => getDailyIcebreaker(), []);
  const thinFeed = !!feedLoaded && postCount < 4;
  const [icebreakerHidden, setIcebreakerHidden] = useState(true);
  const [welcomeHidden, setWelcomeHidden] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      AsyncStorage.getItem(icebreakerKey()),
      AsyncStorage.getItem(WELCOME_KEY),
    ]).then(([ice, welcome]) => {
      if (cancelled) return;
      setIcebreakerHidden(ice === '1');
      setWelcomeHidden(welcome === '1');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!feedLoaded) return null;

  const showIcebreaker = !icebreakerHidden;
  const showWelcome = thinFeed && !welcomeHidden;
  if (!showIcebreaker && !showWelcome) return null;

  return (
    <View style={styles.wrap}>
      {showIcebreaker && (
        <View style={[styles.card, { backgroundColor: feed.promptCardBg, borderColor: feed.postBorder }]}>
          <TouchableOpacity
            style={[styles.dismiss, { backgroundColor: feed.chipBg }]}
            onPress={() => {
              setIcebreakerHidden(true);
              AsyncStorage.setItem(icebreakerKey(), '1');
            }}
            hitSlop={8}
          >
            <Icon name="close" size={16} color={feed.postTextMuted} />
          </TouchableOpacity>
          <Text style={[styles.kicker, { color: feed.kicker }]}>Today's question</Text>
          <Text style={[styles.title, { color: feed.postText }]}>{icebreaker.en}</Text>
          <Text style={[styles.bn, { color: feed.postTextMuted }]}>{icebreaker.bn}</Text>
          <TouchableOpacity
            style={[styles.cta, { backgroundColor: feed.postAccent }]}
            onPress={() => onPostPrompt?.(formatBilingualPrompt(icebreaker))}
            activeOpacity={0.85}
          >
            <Text style={[styles.ctaText, { color: feed.ctaText }]}>Post this</Text>
          </TouchableOpacity>
        </View>
      )}

      {showWelcome && (
        <View style={[styles.card, { backgroundColor: feed.postBg, borderColor: feed.postBorder }]}>
          <TouchableOpacity
            style={[styles.dismiss, { backgroundColor: feed.chipBg }]}
            onPress={() => {
              setWelcomeHidden(true);
              AsyncStorage.setItem(WELCOME_KEY, '1');
            }}
            hitSlop={8}
          >
            <Icon name="close" size={16} color={feed.postTextMuted} />
          </TouchableOpacity>
          <Text style={[styles.kicker, { color: feed.kicker }]}>Welcome to Connect</Text>
          <Text style={[styles.title, { color: feed.postText }]}>Make this feed yours</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: feed.chipBg, borderColor: feed.postBorder }]}
              onPress={() => navigation.navigate('Friends')}
              activeOpacity={0.8}
            >
              <Icon name="person-add" size={14} color={feed.postText} />
              <Text style={[styles.chipText, { color: feed.postText }]}>Add friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: feed.chipBg, borderColor: feed.postBorder }]}
              onPress={() => onPostPrompt?.('')}
              activeOpacity={0.8}
            >
              <Icon name="photo-camera" size={14} color={feed.postText} />
              <Text style={[styles.chipText, { color: feed.postText }]}>First photo</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: feed.postTextMuted }]}>Post something, or answer today's question.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
    gap: 10,
  },
  card: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  dismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  kicker: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    marginBottom: 6,
    fontSize: 18,
    fontWeight: '700',
  },
  bn: {
    marginBottom: 12,
    fontSize: 13,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: {
    fontWeight: '700',
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
  },
});

export default FeedBoostCards;
