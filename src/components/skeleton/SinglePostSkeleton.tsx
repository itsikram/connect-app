import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SkeletonBlock, SkeletonRow, SkeletonColumn } from './Skeleton';
import { useFeedTokens } from '../../theme/feedTokens';
import { useTheme } from '../../contexts/ThemeContext';

const CommentBone = ({ nameWidth = 88, lineWidth = 160, shortWidth = 92 }: { nameWidth?: number; lineWidth?: number; shortWidth?: number }) => {
  const { isDarkMode } = useTheme();
  const bubbleBg = isDarkMode ? '#2a2a2a' : '#f1f3f4';

  return (
    <View style={styles.commentRow}>
      <SkeletonBlock width={32} height={32} borderRadius={16} />
      <View style={styles.commentInfo}>
        <View style={[styles.commentBubble, { backgroundColor: bubbleBg }]}>
          <SkeletonColumn spacing={6}>
            <SkeletonBlock width={nameWidth} height={11} borderRadius={999} />
            <SkeletonBlock width={lineWidth} height={12} borderRadius={999} />
            <SkeletonBlock width={shortWidth} height={12} borderRadius={999} />
          </SkeletonColumn>
        </View>
        <SkeletonRow style={styles.commentMeta} spacing={10}>
          <SkeletonBlock width={28} height={8} borderRadius={999} />
          <SkeletonBlock width={36} height={8} borderRadius={999} />
          <SkeletonBlock width={48} height={8} borderRadius={999} />
        </SkeletonRow>
      </View>
    </View>
  );
};

const SinglePostSkeleton: React.FC = () => {
  const feed = useFeedTokens();

  return (
    <View style={[styles.page, { backgroundColor: feed.postBg }]} accessibilityRole="progressbar">
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
      >
        <View style={styles.post}>
          <SkeletonRow style={styles.authorRow} spacing={12}>
            <SkeletonBlock width={44} height={44} borderRadius={22} style={{ borderWidth: 1.5, borderColor: feed.postBorder }} />
            <SkeletonColumn style={{ flex: 1 }} spacing={8}>
              <SkeletonBlock width={140} height={13} borderRadius={999} />
              <SkeletonBlock width={96} height={10} borderRadius={999} />
            </SkeletonColumn>
            <SkeletonBlock width={34} height={34} borderRadius={17} />
          </SkeletonRow>

          <SkeletonColumn style={styles.caption} spacing={8}>
            <SkeletonBlock width={'92%'} height={13} borderRadius={999} />
            <SkeletonBlock width={'78%'} height={13} borderRadius={999} />
            <SkeletonBlock width={'54%'} height={13} borderRadius={999} />
          </SkeletonColumn>

          <SkeletonBlock
            width={'100%'}
            height={280}
            borderRadius={0}
            style={[styles.media, { backgroundColor: feed.mediaBg }]}
          />

          <View style={[styles.countsRow, { borderTopColor: feed.postDivider }]}>
            <SkeletonRow spacing={6}>
              <SkeletonBlock width={20} height={20} borderRadius={10} />
              <SkeletonBlock width={20} height={20} borderRadius={10} />
              <SkeletonBlock width={20} height={20} borderRadius={10} />
              <SkeletonBlock width={52} height={10} borderRadius={999} />
            </SkeletonRow>
            <SkeletonRow spacing={14}>
              <SkeletonBlock width={36} height={10} borderRadius={999} />
              <SkeletonBlock width={36} height={10} borderRadius={999} />
            </SkeletonRow>
          </View>

          <View style={[styles.actions, { borderTopColor: feed.postDivider }]}>
            <View style={styles.actionSlot}>
              <SkeletonBlock width={'100%'} height={38} borderRadius={10} />
            </View>
            <View style={styles.actionSlot}>
              <SkeletonBlock width={'100%'} height={38} borderRadius={10} />
            </View>
            <View style={styles.actionSlot}>
              <SkeletonBlock width={'100%'} height={38} borderRadius={10} />
            </View>
          </View>
        </View>

        <View style={styles.comments}>
          <CommentBone nameWidth={96} lineWidth={180} shortWidth={110} />
          <CommentBone nameWidth={78} lineWidth={148} shortWidth={84} />
          <CommentBone nameWidth={88} lineWidth={166} shortWidth={98} />
        </View>
      </ScrollView>

      <View style={[styles.composer, { borderTopColor: feed.postDivider, backgroundColor: feed.postBg }]}>
        <SkeletonBlock width={34} height={34} borderRadius={17} />
        <View style={{ flex: 1 }}>
          <SkeletonBlock width={'100%'} height={40} borderRadius={22} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  post: {
    paddingBottom: 4,
  },
  authorRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  caption: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  media: {},
  countsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 40,
    borderTopWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    borderTopWidth: 1,
  },
  actionSlot: {
    flex: 1,
  },
  comments: {
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  commentInfo: {
    flex: 1,
    minWidth: 0,
  },
  commentBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  commentMeta: {
    marginTop: 6,
    paddingHorizontal: 2,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
});

export default SinglePostSkeleton;
