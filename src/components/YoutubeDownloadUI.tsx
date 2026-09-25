import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Modal from './SystemBarsModal';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import {
  QUALITY_OPTIONS,
  getStageLabel,
  isYouTubeVideoUrl,
  toWatchUrl,
  youtubeThumbnailUrl,
} from '../lib/ytDownload';
import {
  BackgroundDownloadJob,
  cancelBackgroundDownload,
  dismissBackgroundDownload,
  startBackgroundYoutubeDownload,
  subscribeBackgroundDownloads,
} from '../lib/ytDownloadManager';

/**
 * YouTube download UI shared by the YouTube and Media Player screens: the
 * quality / audio-only / post-to-Watch sheet, the background progress banner
 * and the completion toasts. Downloads run in ytDownloadManager, so they keep
 * going when the user leaves the screen.
 */

const YOUTUBE_RED = '#FF0000';

// Module level so a job is announced once even when both screens are mounted.
const notifiedJobs = new Set<string>();

export function useBackgroundDownloadJobs(): BackgroundDownloadJob[] {
  const [jobs, setJobs] = useState<BackgroundDownloadJob[]>([]);
  useEffect(() => subscribeBackgroundDownloads(setJobs), []);
  return jobs;
}

/** Shows a toast when a background YouTube download finishes or fails. */
export function useBackgroundDownloadToasts(jobs: BackgroundDownloadJob[]) {
  const { showSuccess, showError } = useToast();
  useEffect(() => {
    jobs.forEach(job => {
      if (job.status === 'running') return;
      if (notifiedJobs.has(job.id)) return;
      notifiedJobs.add(job.id);
      if (job.status === 'completed') {
        const toastTitle =
          job.title.length > 48 ? `${job.title.slice(0, 45)}…` : job.title;
        showSuccess(
          job.watchPosted
            ? `Posted to Watch: ${toastTitle}`
            : `Saved to ${
                Platform.OS === 'ios' ? 'Photos' : 'Gallery'
              }: ${toastTitle}`,
        );
      } else if (job.status === 'failed') {
        showError(job.error || 'Download failed');
      }
    });
  }, [jobs, showError, showSuccess]);
}

const useDownloadStyles = () => {
  const { colors: themeColors, isDarkMode } = useTheme();
  const textPrimary = themeColors.text.primary;
  const textSecondary = themeColors.text.secondary;
  const surface = themeColors.surface.primary;
  const border = themeColors.border.primary;
  const primary = themeColors.primary;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        },
        sheet: {
          backgroundColor: surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 28,
          maxHeight: '88%',
        },
        sheetHandle: {
          alignSelf: 'center',
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: border,
          marginBottom: 14,
        },
        sheetTitle: {
          color: textPrimary,
          fontSize: 18,
          fontWeight: '700',
          marginBottom: 12,
        },
        videoRow: {
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 16,
        },
        thumb: {
          width: 96,
          height: 54,
          borderRadius: 8,
          backgroundColor: border,
        },
        videoMeta: { flex: 1, marginLeft: 12 },
        videoTitle: { color: textPrimary, fontSize: 15, fontWeight: '600' },
        videoSub: { color: textSecondary, fontSize: 12, marginTop: 4 },
        sectionLabel: {
          color: textSecondary,
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 8,
          textTransform: 'uppercase',
        },
        qualityRow: {
          borderWidth: 1,
          borderColor: border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        qualityRowActive: {
          borderColor: primary,
          backgroundColor: isDarkMode
            ? 'rgba(0,212,255,0.12)'
            : 'rgba(0,212,255,0.08)',
        },
        qualityLabel: { color: textPrimary, fontSize: 14 },
        checkRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 10,
        },
        checkLabel: {
          color: textPrimary,
          fontSize: 14,
          marginLeft: 10,
          flex: 1,
        },
        checkHint: {
          color: textSecondary,
          fontSize: 12,
          marginLeft: 34,
          marginBottom: 8,
        },
        actions: { flexDirection: 'row', marginTop: 16 },
        actionBtn: {
          flex: 1,
          borderRadius: 10,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        cancelBtn: {
          backgroundColor: isDarkMode
            ? themeColors.surface.secondary
            : themeColors.background.secondary,
          marginRight: 8,
        },
        confirmBtn: {
          backgroundColor: YOUTUBE_RED,
          marginLeft: 8,
          flexDirection: 'row',
        },
        actionText: { color: textPrimary, fontWeight: '700' },
        confirmText: { color: '#fff', fontWeight: '700', marginLeft: 6 },
        bannerWrap: {
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 20,
        },
        banner: {
          backgroundColor: surface,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderWidth: 1,
          borderColor: border,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        },
        bannerRow: { flexDirection: 'row', alignItems: 'center' },
        bannerTextWrap: { flex: 1, marginHorizontal: 10 },
        bannerTitle: { color: textPrimary, fontSize: 13, fontWeight: '700' },
        bannerSub: { color: textSecondary, fontSize: 11, marginTop: 2 },
        barTrack: {
          height: 4,
          borderRadius: 2,
          backgroundColor: border,
          overflow: 'hidden',
          marginTop: 8,
        },
        barFill: { height: 4, borderRadius: 2, backgroundColor: primary },
        bannerBtn: { paddingHorizontal: 8, paddingVertical: 6 },
      }),
    [border, isDarkMode, primary, surface, textPrimary, textSecondary, themeColors],
  );
  return { styles, themeColors, textSecondary, primary };
};

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  videoId: string | null;
  title?: string;
  /** Shown under the title; defaults to the watch URL. */
  subtitle?: string;
  thumbnail?: string;
  defaultPostAsWatch?: boolean;
};

export function YoutubeDownloadSheet({
  visible,
  onClose,
  videoId,
  title,
  subtitle,
  thumbnail,
  defaultPostAsWatch = false,
}: SheetProps) {
  const { styles, textSecondary, primary } = useDownloadStyles();
  const { showError, showInfo } = useToast();
  const [selectedQuality, setSelectedQuality] = useState(1080);
  const [audioOnly, setAudioOnly] = useState(false);
  const [postAsWatch, setPostAsWatch] = useState(defaultPostAsWatch);

  const queueDownload = () => {
    const watchUrl = videoId ? toWatchUrl(videoId) : null;
    if (!videoId || !watchUrl || !isYouTubeVideoUrl(watchUrl)) {
      showError('Open a YouTube video first');
      return;
    }
    try {
      startBackgroundYoutubeDownload({
        url: watchUrl,
        title: title || `YouTube ${videoId}`,
        quality: selectedQuality,
        audioOnly,
        postAsWatch,
      });
      onClose();
      showInfo(
        audioOnly
          ? 'Audio download started in the background'
          : 'Download started in the background',
      );
    } catch (error: any) {
      showError(error?.message || 'Could not start download');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Download video</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.videoRow}>
              {videoId || thumbnail ? (
                <Image
                  source={{ uri: thumbnail || youtubeThumbnailUrl(videoId!) }}
                  style={styles.thumb}
                />
              ) : (
                <View style={styles.thumb} />
              )}
              <View style={styles.videoMeta}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {title || 'YouTube video'}
                </Text>
                <Text style={styles.videoSub} numberOfLines={1}>
                  {subtitle ||
                    (videoId ? `youtube.com/watch?v=${videoId}` : '')}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Quality</Text>
            {QUALITY_OPTIONS.map(option => {
              const active = selectedQuality === option.value && !audioOnly;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.qualityRow,
                    active && styles.qualityRowActive,
                    audioOnly && { opacity: 0.45 },
                  ]}
                  disabled={audioOnly}
                  onPress={() => setSelectedQuality(option.value)}
                >
                  <Text style={styles.qualityLabel}>{option.label}</Text>
                  {active ? (
                    <Icon name="check" size={20} color={primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => {
                const next = !audioOnly;
                setAudioOnly(next);
                if (next) setPostAsWatch(false);
              }}
            >
              <Icon
                name={audioOnly ? 'check-box' : 'check-box-outline-blank'}
                size={24}
                color={audioOnly ? primary : textSecondary}
              />
              <Text style={styles.checkLabel}>
                Audio only (high quality MP3)
              </Text>
            </TouchableOpacity>
            <Text style={styles.checkHint}>
              Extracts just the audio track at the best available quality.
            </Text>

            <TouchableOpacity
              style={[styles.checkRow, audioOnly && { opacity: 0.45 }]}
              disabled={audioOnly}
              onPress={() => setPostAsWatch(prev => !prev)}
            >
              <Icon
                name={
                  postAsWatch && !audioOnly
                    ? 'check-box'
                    : 'check-box-outline-blank'
                }
                size={24}
                color={postAsWatch && !audioOnly ? primary : textSecondary}
              />
              <Text style={styles.checkLabel}>Post as Watch</Text>
            </TouchableOpacity>
            <Text style={styles.checkHint}>
              {audioOnly
                ? 'Audio-only downloads are saved to your device and are not posted to Watch.'
                : postAsWatch
                ? 'Also upload the video to Watch after it finishes.'
                : 'Save to your device only (not posted to Watch).'}
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.cancelBtn]}
              onPress={onClose}
            >
              <Text style={styles.actionText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.confirmBtn]}
              onPress={queueDownload}
            >
              <Icon
                name={audioOnly ? 'audiotrack' : 'download'}
                size={18}
                color="#fff"
              />
              <Text style={styles.confirmText}>
                {audioOnly ? 'Download audio' : 'Download'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Floating progress card for the newest background download. */
export function YoutubeDownloadBanner({
  jobs,
}: {
  jobs: BackgroundDownloadJob[];
}) {
  const { styles, themeColors, textSecondary } = useDownloadStyles();
  const navigation = useNavigation();
  const bannerJob = jobs[0];
  if (!bannerJob) return null;
  const activeJobs = jobs.filter(job => job.status === 'running');

  return (
    <View style={styles.bannerWrap} pointerEvents="box-none">
      <View style={styles.banner}>
        <View style={styles.bannerRow}>
          {bannerJob.status === 'running' ? (
            <ActivityIndicator size="small" color={YOUTUBE_RED} />
          ) : (
            <Icon
              name={
                bannerJob.status === 'completed'
                  ? 'check-circle'
                  : bannerJob.status === 'failed'
                  ? 'error'
                  : 'download'
              }
              size={22}
              color={
                bannerJob.status === 'failed'
                  ? themeColors.status?.error || '#FF4444'
                  : themeColors.status?.success || '#00C851'
              }
            />
          )}
          <View style={styles.bannerTextWrap}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                if (bannerJob.status === 'completed') {
                  (navigation as any).navigate('Downloads');
                }
              }}
            >
              <Text style={styles.bannerTitle} numberOfLines={1}>
                {bannerJob.status === 'completed'
                  ? 'Saved in background'
                  : bannerJob.status === 'failed'
                  ? 'Download failed'
                  : activeJobs.length > 1
                  ? `${activeJobs.length} downloads in background`
                  : 'Downloading in background'}
              </Text>
              <Text style={styles.bannerSub} numberOfLines={1}>
                {bannerJob.status === 'failed'
                  ? bannerJob.error || bannerJob.title
                  : `${bannerJob.title} · ${getStageLabel(
                      bannerJob.stage,
                    )} · ${Math.round(bannerJob.progress)}%`}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.bannerBtn}
            onPress={() =>
              bannerJob.status === 'running'
                ? cancelBackgroundDownload(bannerJob.id)
                : dismissBackgroundDownload(bannerJob.id)
            }
          >
            <Icon name="close" size={20} color={textSecondary} />
          </TouchableOpacity>
        </View>
        {bannerJob.status !== 'failed' ? (
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(bannerJob.progress, 3)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
