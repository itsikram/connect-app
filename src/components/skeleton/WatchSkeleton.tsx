import React from 'react';
import { Dimensions, StatusBar, StyleSheet, View } from 'react-native';
import { SkeletonBlock, SkeletonColumn, SkeletonRow } from './Skeleton';
import { useWatchTokens } from '../../theme/watchTokens';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

type WatchSkeletonProps = {
  showBack?: boolean;
  height?: number;
  variant?: 'feed' | 'page';
};

const WatchPageSkeleton: React.FC<{ showBack?: boolean }> = ({ showBack }) => {
  const t = useWatchTokens();
  const mediaH = Math.min(220, Math.round(SCREEN_WIDTH * (9 / 16)));

  return (
    <View style={[pageStyles.page, { backgroundColor: t.pageBg }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.pageBg} />
      {showBack ? (
        <View style={[pageStyles.header, { borderBottomColor: t.border }]}>
          <SkeletonBlock width={36} height={36} borderRadius={18} />
          <SkeletonBlock width={92} height={16} borderRadius={999} />
        </View>
      ) : null}
      <View style={[pageStyles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <SkeletonRow spacing={10} style={pageStyles.author}>
          <SkeletonBlock width={44} height={44} borderRadius={22} />
          <SkeletonColumn style={{ flex: 1 }} spacing={8}>
            <SkeletonBlock width={150} height={14} borderRadius={999} />
            <SkeletonBlock width={90} height={10} borderRadius={999} />
          </SkeletonColumn>
          <SkeletonBlock width={72} height={28} borderRadius={16} />
        </SkeletonRow>
        <SkeletonColumn style={pageStyles.caption} spacing={8}>
          <SkeletonBlock width={SCREEN_WIDTH - 56} height={12} borderRadius={999} />
          <SkeletonBlock width={SCREEN_WIDTH - 120} height={12} borderRadius={999} />
        </SkeletonColumn>
        <SkeletonBlock width={SCREEN_WIDTH - 32} height={mediaH} borderRadius={0} />
        <View style={pageStyles.actions}>
          {[0, 1, 2, 3].map((key) => (
            <View key={key} style={pageStyles.action}>
              <SkeletonBlock width={44} height={44} borderRadius={22} />
              <SkeletonBlock width={48} height={10} borderRadius={999} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
        <SkeletonColumn style={pageStyles.comments} spacing={12}>
          {[0, 1, 2].map((key) => (
            <SkeletonRow key={key} spacing={10}>
              <SkeletonBlock width={32} height={32} borderRadius={16} />
              <SkeletonColumn style={{ flex: 1 }} spacing={6}>
                <SkeletonBlock width={120} height={10} borderRadius={999} />
                <SkeletonBlock width={SCREEN_WIDTH - 110} height={12} borderRadius={999} />
              </SkeletonColumn>
            </SkeletonRow>
          ))}
        </SkeletonColumn>
      </View>
    </View>
  );
};

const WatchSkeleton: React.FC<WatchSkeletonProps> = ({ showBack = false, height, variant = 'feed' }) => {
  if (variant === 'page') {
    return <WatchPageSkeleton showBack={showBack} />;
  }

  const t = useWatchTokens();
  const fillStyle = height ? { height } : { flex: 1 };
  const wellHeight = height || SCREEN_HEIGHT;
  const videoHeight = Math.min(wellHeight, Math.round(SCREEN_WIDTH * (9 / 16)));
  const metaContentWidth = SCREEN_WIDTH * 0.9 - 24;
  const actionLabelWidths = [44, 24, 24, 52, 32, 30];

  return (
    <View style={[styles.item, fillStyle, { backgroundColor: t.pageBg }]}>
      <StatusBar barStyle={t.statusBar} backgroundColor={t.pageBg} />

      <View style={[styles.videoWell, fillStyle, { backgroundColor: t.pageBg }]}>
        <SkeletonBlock
          width={SCREEN_WIDTH}
          height={videoHeight}
          borderRadius={18}
          style={styles.video}
        />
        <View pointerEvents="none" style={styles.pauseToggle}>
          <SkeletonBlock width={36} height={36} borderRadius={18} />
        </View>
      </View>

      {showBack ? (
        <View style={styles.header}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <View style={[styles.titleChip, { backgroundColor: t.metaBg, borderColor: t.chipBorder }]}>
            <SkeletonBlock width={72} height={14} borderRadius={999} />
          </View>
        </View>
      ) : null}

      <View style={styles.actions}>
        {actionLabelWidths.map((labelWidth, key) => (
          <View key={key} style={styles.action}>
            <View style={[styles.sideBtn, { backgroundColor: t.btnBg, borderColor: t.chipBorder }]}>
              <SkeletonBlock width={22} height={22} borderRadius={11} />
            </View>
            <SkeletonBlock width={labelWidth} height={14} borderRadius={999} style={styles.count} />
          </View>
        ))}
      </View>

      <View style={[styles.meta, { backgroundColor: t.metaBg, borderColor: t.chipBorder }]}>
        <View style={styles.authorRow}>
          <SkeletonBlock width={40} height={40} borderRadius={20} />
          <SkeletonColumn style={styles.authorInfo} spacing={8}>
            <SkeletonBlock width={140} height={14} borderRadius={999} />
            <SkeletonBlock width={86} height={10} borderRadius={999} />
          </SkeletonColumn>
          <SkeletonBlock width={72} height={28} borderRadius={16} />
        </View>
        <SkeletonColumn spacing={8}>
          <SkeletonBlock width={metaContentWidth} height={12} borderRadius={999} />
          <SkeletonBlock width={metaContentWidth - 60} height={12} borderRadius={999} />
        </SkeletonColumn>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  item: {
    width: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoWell: {
    width: SCREEN_WIDTH,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  video: {
    alignSelf: 'center',
    marginBottom: 120,
    borderRadius: 18,
  },
  pauseToggle: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 12,
  },
  header: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actions: {
    position: 'absolute',
    right: 5,
    top: 0,
    bottom: 150,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    zIndex: 12,
  },
  action: {
    alignItems: 'center',
    minWidth: 48,
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  count: {
    marginTop: 4,
  },
  meta: {
    position: 'absolute',
    left: '5%',
    width: '90%',
    bottom: 80,
    marginBottom: 25,
    zIndex: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  authorInfo: {
    flex: 1,
  },
});

const pageStyles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  card: {
    margin: 12,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: 16,
  },
  author: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  caption: {
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
    paddingVertical: 16,
  },
  action: {
    alignItems: 'center',
  },
  comments: {
    paddingHorizontal: 14,
  },
});

export default WatchSkeleton;
