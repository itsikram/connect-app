// Vanishing secure messages (server: utils/secureMessages.js).
// A secure message arrives as a placeholder (messageType "secure"); its
// content is fetched once, by the receiver, from POST /message/secure/open
// and only ever lives in the viewer's state — never in the message list,
// Redux or AsyncStorage.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Modal from './SystemBarsModal';
import api from '../lib/api';

export const SECURE_MESSAGE_TYPE = 'secure';
export const SECURE_PLACEHOLDER = '🔒 Secure message';

export type SecureState = 'sealed' | 'opened' | 'expired';

export interface SecureInfo {
  state?: SecureState;
  expiresAt?: string | null;
  openedAt?: string | null;
}

export interface SecureContent {
  text: string;
  attachment: string;
  kind?: string;
}

export const isSecureMessage = (msg: any): boolean =>
  msg?.messageType === SECURE_MESSAGE_TYPE;

export const secureStateOf = (msg: any): SecureState => {
  const secure: SecureInfo = msg?.secure || {};
  if (secure.state === 'opened' || secure.openedAt) return 'opened';
  if (secure.state === 'expired') return 'expired';
  const expiresAt = secure.expiresAt ? new Date(secure.expiresAt).getTime() : 0;
  if (expiresAt && expiresAt <= Date.now()) return 'expired';
  return 'sealed';
};

const timeLeftLabel = (expiresAt?: string | null) => {
  const ms = new Date(expiresAt || 0).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const hours = Math.floor(ms / 3600000);
  if (hours >= 1) return `Expires in ${hours}h`;
  return `Expires in ${Math.max(1, Math.floor(ms / 60000))}m`;
};

const viewSecondsFor = (content: SecureContent | null) => {
  if (content?.attachment) return 30;
  const words = String(content?.text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.min(60, Math.max(10, Math.ceil(words / 3) + 8));
};

const isImageUrl = (url: string) =>
  /\.(png|jpe?g|gif|webp|heic|heif|bmp)(\?|$)|\/image\/upload\//i.test(
    String(url || ''),
  );

export function SecureMessageViewer({
  content,
  senderName,
  onClose,
}: {
  content: SecureContent;
  senderName?: string;
  onClose: () => void;
}) {
  const total = viewSecondsFor(content);
  const [secondsLeft, setSecondsLeft] = useState(total);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const left = total - Math.floor((Date.now() - started) / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timer);
        closeRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [total]);

  // Leaving the app (app switcher, notifications shade, screen recorder
  // prompt) ends the view: the content is gone for good.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') closeRef.current();
    });
    return () => sub.remove();
  }, []);

  const progress = Math.max(0, Math.min(1, secondsLeft / total));

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.badge}>
              <Icon name="lock" size={13} color="#67e8f9" />
              <Text style={styles.badgeText}>Secure message</Text>
            </View>
            {senderName ? (
              <Text style={styles.from} numberOfLines={1}>
                from {senderName}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={onClose}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Icon name="close" size={20} color="#f1f5f9" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
          >
            {content.attachment ? (
              isImageUrl(content.attachment) ? (
                <Image
                  source={{ uri: content.attachment }}
                  style={styles.image}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.file}>
                  <Icon name="insert-drive-file" size={18} color="#67e8f9" />
                  <Text style={styles.fileText}>Attachment</Text>
                </View>
              )
            ) : null}
            {content.text ? (
              <Text style={styles.text} selectable={false}>
                {content.text}
              </Text>
            ) : null}
          </ScrollView>

          <View style={styles.foot}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.timer}>
              Vanishes in {secondsLeft}s · it can't be opened again
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SecureMessageBubble({
  msg,
  isMine,
  senderName,
  textColor,
  metaColor,
  accentColor,
  onStateChange,
}: {
  msg: any;
  isMine: boolean;
  senderName?: string;
  textColor: string;
  metaColor: string;
  accentColor: string;
  onStateChange?: (
    messageId: string,
    state: SecureState,
    openedAt?: string | null,
  ) => void;
}) {
  const [opening, setOpening] = useState(false);
  const [content, setContent] = useState<SecureContent | null>(null);
  const [, setTick] = useState(0);
  const state = secureStateOf(msg);

  useEffect(() => {
    if (state !== 'sealed') return undefined;
    const timer = setInterval(() => setTick(n => n + 1), 60000);
    return () => clearInterval(timer);
  }, [state]);

  const markState = useCallback(
    (next: SecureState, openedAt: string | null = null) =>
      onStateChange?.(String(msg._id), next, openedAt),
    [msg._id, onStateChange],
  );

  const canOpen = !isMine && state === 'sealed' && !msg.isOptimistic;

  const open = async () => {
    if (!canOpen || opening) return;
    setOpening(true);
    try {
      const { data } = await api.post('/message/secure/open', {
        messageId: msg._id,
      });
      setContent({
        text: String(data?.content?.text || ''),
        attachment: String(data?.content?.attachment || ''),
        kind: data?.content?.kind,
      });
    } catch (error: any) {
      const serverState = error?.response?.data?.state;
      if (serverState === 'opened' || serverState === 'expired') {
        markState(serverState);
      }
      Alert.alert(
        'Secure message',
        error?.response?.data?.message ||
          "Couldn't open this secure message.",
      );
    } finally {
      setOpening(false);
    }
  };

  const closeViewer = () => {
    setContent(null);
    markState('opened', new Date().toISOString());
  };

  let icon = 'lock';
  let detail = '';
  if (msg.isOptimistic) {
    detail = msg.sendFailed ? 'Not sent' : 'Sending securely…';
  } else if (state === 'opened') {
    icon = 'lock-open';
    detail = isMine ? 'Opened' : 'Opened · this message has vanished';
  } else if (state === 'expired') {
    icon = 'hourglass-empty';
    detail = isMine ? 'Expired before it was opened' : 'Expired';
  } else if (isMine) {
    detail = `Not opened yet · ${
      timeLeftLabel(msg.secure?.expiresAt) || "vanishes after it's read"
    }`;
  } else {
    const left = timeLeftLabel(msg.secure?.expiresAt);
    detail = `Tap to view · vanishes after reading${left ? ` · ${left}` : ''}`;
  }

  const dim = state !== 'sealed';

  return (
    <>
      <Pressable
        onPress={canOpen ? open : undefined}
        disabled={!canOpen || opening}
        accessibilityRole={canOpen ? 'button' : 'text'}
        accessibilityLabel={
          canOpen ? 'Open secure message' : `Secure message, ${detail}`
        }
        style={styles.bubble}
      >
        <View
          style={[
            styles.bubbleIcon,
            {
              backgroundColor: dim
                ? 'rgba(255,255,255,0.08)'
                : `${accentColor}33`,
            },
          ]}
        >
          {opening ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Icon name={icon} size={18} color={dim ? metaColor : accentColor} />
          )}
        </View>
        <View style={styles.bubbleCopy}>
          <Text style={[styles.bubbleTitle, { color: textColor }]}>
            Secure message
          </Text>
          <Text style={[styles.bubbleDetail, { color: metaColor }]}>
            {detail}
          </Text>
        </View>
        {canOpen ? (
          <View style={[styles.cta, { backgroundColor: accentColor }]}>
            <Text style={styles.ctaText}>View</Text>
          </View>
        ) : null}
      </Pressable>
      {content ? (
        <SecureMessageViewer
          content={content}
          senderName={senderName}
          onClose={closeViewer}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 210,
    paddingVertical: 2,
  },
  bubbleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  bubbleCopy: { flexShrink: 1, flexGrow: 1 },
  bubbleTitle: { fontSize: 14, fontWeight: '700' },
  bubbleDetail: { fontSize: 12, marginTop: 1 },
  cta: {
    marginLeft: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  ctaText: { color: '#0b1220', fontSize: 12, fontWeight: '800' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,6,12,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: 20,
    backgroundColor: '#0f1622',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,212,255,0.14)',
  },
  badgeText: {
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  from: {
    flex: 1,
    marginLeft: 10,
    color: 'rgba(241,245,249,0.7)',
    fontSize: 13,
  },
  close: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flexGrow: 0 },
  bodyContent: { padding: 20 },
  image: {
    width: '100%',
    height: 320,
    borderRadius: 12,
    marginBottom: 12,
  },
  file: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  fileText: { color: '#67e8f9', marginLeft: 8 },
  text: { color: '#f1f5f9', fontSize: 17, lineHeight: 25 },
  foot: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#22d3ee' },
  timer: { marginTop: 8, fontSize: 12, color: 'rgba(241,245,249,0.6)' },
});
