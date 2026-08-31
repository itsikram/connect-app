import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { FEED } from '../theme/feedTokens';
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
        <View style={[styles.card, styles.promptCard]}>
          <TouchableOpacity
            style={styles.dismiss}
            onPress={() => {
              setIcebreakerHidden(true);
              AsyncStorage.setItem(icebreakerKey(), '1');
            }}
            hitSlop={8}
          >
            <Icon name="close" size={16} color={FEED.postTextMuted} />
          </TouchableOpacity>
          <Text style={styles.kicker}>Today's question</Text>
          <Text style={styles.title}>{icebreaker.en}</Text>
          <Text style={styles.bn}>{icebreaker.bn}</Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => onPostPrompt?.(formatBilingualPrompt(icebreaker))}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Post this</Text>
          </TouchableOpacity>
        </View>
      )}

      {showWelcome && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.dismiss}
            onPress={() => {
              setWelcomeHidden(true);
              AsyncStorage.setItem(WELCOME_KEY, '1');
            }}
            hitSlop={8}
          >
            <Icon name="close" size={16} color={FEED.postTextMuted} />
          </TouchableOpacity>
          <Text style={styles.kicker}>Welcome to Connect</Text>
          <Text style={styles.title}>Make this feed yours</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => navigation.navigate('Friends')}
              activeOpacity={0.8}
            >
              <Icon name="person-add" size={14} color={FEED.postText} />
              <Text style={styles.chipText}>Add friends</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.chip}
              onPress={() => onPostPrompt?.('')}
              activeOpacity={0.8}
            >
              <Icon name="photo-camera" size={14} color={FEED.postText} />
              <Text style={styles.chipText}>First photo</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>Post something, or answer today's question.</Text>
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
    backgroundColor: FEED.postBg,
    borderWidth: 1,
    borderColor: FEED.postBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  promptCard: {
    backgroundColor: 'rgba(0, 40, 54, 0.96)',
  },
  dismiss: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    color: '#7ce7ff',
  },
  title: {
    marginBottom: 6,
    fontSize: 18,
    fontWeight: '700',
    color: FEED.postText,
  },
  bn: {
    marginBottom: 12,
    color: FEED.postTextMuted,
    fontSize: 13,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: FEED.postAccent,
  },
  ctaText: {
    color: '#04222a',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: FEED.postBorder,
  },
  chipText: {
    color: FEED.postText,
    fontSize: 13,
    fontWeight: '600',
  },
  hint: {
    color: FEED.postTextMuted,
    fontSize: 13,
  },
});

export default FeedBoostCards;
