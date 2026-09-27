import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Linking, Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import type { CrisisInfo, Helpline, RecoveryLang, SupportContact } from '../../services/recoveryApi';
import { Button, Card, FitnessPage, Icon, IconName, Ring } from '../fitness/ui';
import { STRINGS, fill, makeFormatters, toLocalDigits } from './i18n';

export {
  BarChart,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  HeaderIconButton,
  Icon,
  LineChart,
  Muted,
  OptionCards,
  ProgressBar,
  Ring,
  SectionHeader,
  Segmented,
  StatTile,
  Stepper,
  errorMessage,
  timezone,
} from '../fitness/ui';
export type { IconName, Option } from '../fitness/ui';

/** Fixed hues; each use is paired with text so meaning never relies on colour alone. */
export const REC = {
  sos: '#E5484D',
  // Deeper red for filled SOS buttons so white text is 4.8:1.
  sosFill: '#D92D3A',
  calm: '#3987e5',
  money: '#199e70',
  warm: '#c98500',
};

// ---------------------------------------------------------------------------
// Phone, SMS and links
// ---------------------------------------------------------------------------
export const callPhone = async (phone: string, lang: RecoveryLang) => {
  const digits = phone.replace(/[^\d+]/g, '');
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch (_) {
    Alert.alert('', fill(STRINGS[lang].help.cannotCall, { phone }));
  }
};

export const sendSms = (phone: string, body: string) => {
  const separator = Platform.OS === 'ios' ? '&' : '?';
  Linking.openURL(`sms:${phone.replace(/[^\d+]/g, '')}${separator}body=${encodeURIComponent(body)}`).catch(() => {});
};

export const openLink = (url: string) => Linking.openURL(url).catch(() => {});

// ---------------------------------------------------------------------------
// Page with a one-tap SOS button in the header of every Recovery screen
// ---------------------------------------------------------------------------
type PageProps = React.ComponentProps<typeof FitnessPage> & { showSos?: boolean };

export const RecoveryPage = ({ right, showSos = true, navigation, ...props }: PageProps) => (
  <FitnessPage
    {...props}
    navigation={navigation}
    right={
      right || showSos ? (
        <View style={styles.headerRight}>
          {right}
          {showSos ? <SosHeaderButton onPress={() => navigation?.navigate('RecoverySos')} /> : null}
        </View>
      ) : undefined
    }
  />
);

const SosHeaderButton = ({ onPress }: { onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel="SOS"
    hitSlop={10}
    onPress={onPress}
    style={({ pressed }) => [styles.sosHeader, { opacity: pressed ? 0.75 : 1 }]}
  >
    <Icon name="lifebuoy" size={20} color="#ffffff" />
  </Pressable>
);

/** Large, gently pulsing SOS button used in the sticky footer. */
export const SosButton = ({ label, onPress }: { label: string; onPress: () => void }) => {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.sosPulse,
          { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }), transform: [{ scaleX: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }, { scaleY: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }] },
        ]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.sosButton, { opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="lifebuoy" size={22} color="#ffffff" />
        <Text style={styles.sosText}>{label}</Text>
      </Pressable>
    </View>
  );
};

export const EmergencyStrip = ({ lang }: { lang: RecoveryLang }) => (
  <Pressable accessibilityRole="button" onPress={() => callPhone('999', lang)} style={({ pressed }) => [styles.strip, { opacity: pressed ? 0.8 : 1 }]}>
    <Icon name="phone-alert" size={16} color={REC.sos} />
    <Text style={styles.stripText}>{STRINGS[lang].common.emergencyStrip}</Text>
  </Pressable>
);

export const Banner = ({ icon, text, tone = 'neutral' }: { icon: IconName; text: string; tone?: 'neutral' | 'good' | 'warn' }) => {
  const { colors } = useTheme();
  const color = tone === 'good' ? colors.status.success : tone === 'warn' ? colors.status.warning : colors.text.secondary;
  return (
    <View style={[styles.banner, { backgroundColor: colors.surface.secondary }]}>
      <Icon name={icon} size={18} color={color} />
      <Text style={[styles.bannerText, { color: colors.text.primary }]}>{text}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Crisis card: curated message + one-tap calls. Never depends on AI.
// ---------------------------------------------------------------------------
export const CrisisCard = ({ crisis, contacts = [], lang, onMoreHelp }: { crisis: CrisisInfo; contacts?: SupportContact[]; lang: RecoveryLang; onMoreHelp?: () => void }) => {
  const { colors } = useTheme();
  const s = STRINGS[lang].crisis;
  const lines = (crisis.helplines || []).filter((line: Helpline) => line.phone && line.phone !== '999');
  return (
    <View accessibilityRole="alert" style={[styles.crisis, { backgroundColor: colors.surface.primary }]}>
      <View style={styles.crisisHead}>
        <Icon name="hand-heart" size={22} color={REC.sos} />
        <Text style={[styles.crisisTitle, { color: colors.text.primary }]}>{s.title}</Text>
      </View>
      <Text style={[styles.crisisBody, { color: colors.text.primary }]}>{crisis.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => callPhone('999', lang)} style={({ pressed }) => [styles.call999, { opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="phone" size={20} color="#ffffff" />
        <Text style={styles.call999Text}>{s.call999}</Text>
      </Pressable>
      {lines.map((line) => (
        <Pressable key={line.key} accessibilityRole="button" onPress={() => callPhone(line.phone, lang)} style={({ pressed }) => [styles.crisisLine, { borderColor: colors.border.primary, opacity: pressed ? 0.8 : 1 }]}>
          <Icon name="phone-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.crisisLineName, { color: colors.text.primary }]}>{fill(s.call, { name: line.name })}</Text>
            <Text style={[styles.crisisLineMeta, { color: colors.text.secondary }]}>{[line.display, line.hours].filter(Boolean).join(' · ')}</Text>
          </View>
        </Pressable>
      ))}
      {contacts
        .filter((contact) => contact.phone)
        .slice(0, 2)
        .map((contact) => (
          <Pressable key={`${contact.name}-${contact.phone}`} accessibilityRole="button" onPress={() => callPhone(contact.phone, lang)} style={({ pressed }) => [styles.crisisLine, { borderColor: colors.border.primary, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name="account-heart-outline" size={18} color={colors.primary} />
            <Text style={[styles.crisisLineName, { color: colors.text.primary, flex: 1 }]}>{fill(s.call, { name: contact.name || contact.phone })}</Text>
          </Pressable>
        ))}
      {onMoreHelp ? <Button label={s.moreHelp} variant="ghost" icon="lifebuoy" onPress={onMoreHelp} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Live clean-time counter (ticks every second on the device)
// ---------------------------------------------------------------------------
const pad = (value: number) => String(value).padStart(2, '0');

export const CleanTimeCounter = ({ since, until, lang, offsetMs = 0 }: { since?: string; until?: number | null; lang: RecoveryLang; offsetMs?: number }) => {
  const { colors } = useTheme();
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => clearInterval(timer);
  }, [offsetMs]);
  const s = STRINGS[lang].common;
  const { num } = makeFormatters(lang);
  const target = until ?? (since ? Date.parse(since) : now);
  const ms = Math.max(0, until ? target - now : now - target);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`${days} ${s.days} ${hours} ${s.hours} ${minutes} ${s.minutes}`}>
      <Text style={[styles.counterDays, { color: colors.text.primary }]}>{num(days)}</Text>
      <Text style={[styles.counterUnit, { color: colors.text.secondary }]}>{days === 1 ? s.day : s.days}</Text>
      <Text style={[styles.counterClock, { color: colors.text.secondary }]}>{toLocalDigits(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, lang)}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Breathing guide
// ---------------------------------------------------------------------------
type Phase = { kind: 'in' | 'hold' | 'out'; seconds: number };
const PATTERNS: Record<'box' | 'relax', Phase[]> = {
  box: [
    { kind: 'in', seconds: 4 },
    { kind: 'hold', seconds: 4 },
    { kind: 'out', seconds: 4 },
    { kind: 'hold', seconds: 4 },
  ],
  relax: [
    { kind: 'in', seconds: 4 },
    { kind: 'hold', seconds: 7 },
    { kind: 'out', seconds: 8 },
  ],
};

export const BreathingCircle = ({ lang, autoStart = false, onRound }: { lang: RecoveryLang; autoStart?: boolean; onRound?: (round: number) => void }) => {
  const { colors } = useTheme();
  const s = STRINGS[lang].sos;
  const { num } = makeFormatters(lang);
  const [pattern, setPattern] = useState<'box' | 'relax'>('box');
  const [running, setRunning] = useState(autoStart);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(PATTERNS.box[0].seconds);
  const [round, setRound] = useState(1);
  const roundRef = useRef(1);
  const scale = useRef(new Animated.Value(0.55)).current;
  const phases = PATTERNS[pattern];
  const phase = phases[index];

  useEffect(() => {
    if (!running) return undefined;
    Vibration.vibrate(20);
    setCount(phase.seconds);
    if (phase.kind !== 'hold') {
      Animated.timing(scale, { toValue: phase.kind === 'in' ? 1 : 0.55, duration: phase.seconds * 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }).start();
    }
    const tick = setInterval(() => setCount((value) => Math.max(1, value - 1)), 1000);
    const next = setTimeout(() => {
      const nextIndex = (index + 1) % phases.length;
      if (nextIndex === 0) {
        onRound?.(roundRef.current);
        roundRef.current += 1;
        setRound(roundRef.current);
      }
      setIndex(nextIndex);
    }, phase.seconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [running, index, pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    setRunning(false);
    setIndex(0);
    roundRef.current = 1;
    setRound(1);
    scale.stopAnimation();
    Animated.timing(scale, { toValue: 0.55, duration: 400, useNativeDriver: true }).start();
  };

  const label = !running ? s.begin : phase.kind === 'in' ? s.breathIn : phase.kind === 'out' ? s.breathOut : s.hold;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={styles.patternRow}>
        {(['box', 'relax'] as const).map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityState={{ selected: pattern === key }}
            onPress={() => {
              stop();
              setPattern(key);
            }}
            style={[styles.patternChip, { borderColor: pattern === key ? colors.primary : colors.border.primary, backgroundColor: pattern === key ? colors.primary : 'transparent' }]}
          >
            <Text style={{ color: pattern === key ? colors.onPrimary : colors.text.primary, fontWeight: '700', fontSize: 13 }}>{key === 'box' ? s.boxPattern : s.relaxPattern}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => (running ? stop() : setRunning(true))} style={styles.breathArea}>
        <Animated.View style={[styles.breathCircle, { backgroundColor: colors.primary, opacity: 0.22, transform: [{ scale }] }]} />
        <Animated.View style={[styles.breathCore, { borderColor: colors.primary, transform: [{ scale }] }]} />
        <View style={styles.breathLabel}>
          <Text style={[styles.breathPhase, { color: colors.text.primary }]}>{label}</Text>
          {running ? <Text style={[styles.breathCount, { color: colors.text.primary }]}>{num(count)}</Text> : null}
        </View>
      </Pressable>
      <Text style={{ color: colors.text.secondary, marginTop: 4 }}>{running ? fill(s.round, { n: num(round) }) : ''}</Text>
      {running ? <Button label={s.stop} variant="secondary" icon="stop" onPress={stop} style={{ alignSelf: 'stretch' }} /> : null}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Urge-surfing timer
// ---------------------------------------------------------------------------
export const UrgeTimer = ({ lang, minutes = 10, onComplete }: { lang: RecoveryLang; minutes?: number; onComplete?: () => void }) => {
  const { colors } = useTheme();
  const s = STRINGS[lang].sos;
  const total = minutes * 60 * 1000;
  const [remaining, setRemaining] = useState(total);
  const [endAt, setEndAt] = useState<number | null>(null);
  const completed = useRef(false);

  useEffect(() => {
    if (!endAt) return undefined;
    const timer = setInterval(() => {
      const left = Math.max(0, endAt - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        setEndAt(null);
        if (!completed.current) {
          completed.current = true;
          Vibration.vibrate([0, 200, 120, 200]);
          onComplete?.();
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [endAt, onComplete]);

  const running = endAt !== null;
  const done = remaining === 0;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Ring size={190} stroke={12} progress={1 - remaining / total} color={done ? colors.status.success : colors.primary}>
        {done ? <Icon name="check-bold" size={44} color={colors.status.success} /> : <Icon name="waves" size={28} color={colors.primary} />}
        <Text style={[styles.timerText, { color: colors.text.primary }]}>{toLocalDigits(`${pad(mm)}:${pad(ss)}`, lang)}</Text>
        <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{done ? '' : s.left}</Text>
      </Ring>
      {done ? (
        <Text style={[styles.timerDone, { color: colors.status.success }]}>{s.waveDone}</Text>
      ) : (
        <Button
          label={running ? s.pause : remaining < total ? s.resume : s.startTimer}
          icon={running ? 'pause' : 'play'}
          variant={running ? 'secondary' : 'primary'}
          onPress={() => {
            if (running) {
              setEndAt(null);
            } else {
              setEndAt(Date.now() + remaining);
            }
          }}
          style={{ alignSelf: 'stretch' }}
        />
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Scales
// ---------------------------------------------------------------------------
export const NumberScale = ({
  min,
  max,
  value,
  onChange,
  lang,
  lowLabel,
  highLabel,
  danger,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (value: number) => void;
  lang: RecoveryLang;
  lowLabel?: string;
  highLabel?: string;
  danger?: boolean;
}) => {
  const { colors } = useTheme();
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <View>
      <View style={styles.scaleRow}>
        {values.map((item) => {
          const selected = value === item;
          const tint = danger && item >= Math.ceil(max * 0.7) ? REC.sos : colors.primary;
          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={String(item)}
              onPress={() => onChange(item)}
              style={[styles.scaleItem, { borderColor: selected ? tint : colors.border.primary, backgroundColor: selected ? tint : colors.surface.secondary }]}
            >
              <Text style={{ color: selected ? '#ffffff' : colors.text.primary, fontWeight: '800', fontSize: 15 }}>{toLocalDigits(String(item), lang)}</Text>
            </Pressable>
          );
        })}
      </View>
      {lowLabel || highLabel ? (
        <View style={styles.scaleLabels}>
          <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{lowLabel}</Text>
          <Text style={{ color: colors.text.tertiary, fontSize: 12 }}>{highLabel}</Text>
        </View>
      ) : null}
    </View>
  );
};

const MOOD_FACES = ['😞', '🙁', '😐', '🙂', '😄'];

export const MoodScale = ({ value, onChange, labels }: { value: number | null; onChange: (value: number) => void; labels: string[] }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.moodRow}>
      {MOOD_FACES.map((face, index) => {
        const selected = value === index + 1;
        return (
          <Pressable
            key={face}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={labels[index]}
            onPress={() => onChange(index + 1)}
            style={[styles.moodItem, { borderColor: selected ? colors.primary : colors.border.primary, backgroundColor: selected ? colors.surface.secondary : 'transparent' }]}
          >
            <Text style={{ fontSize: 26 }}>{face}</Text>
            <Text numberOfLines={1} style={{ color: selected ? colors.text.primary : colors.text.tertiary, fontSize: 11, fontWeight: selected ? '700' : '500' }}>{labels[index]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

/** Multi-select chips. */
export const MultiChips = ({ options, values, onToggle }: { options: Array<{ key: string; label: string }>; values: string[]; onToggle: (key: string) => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.chips}>
      {options.map((option) => {
        const selected = values.includes(option.key);
        return (
          <Pressable
            key={option.key}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onToggle(option.key)}
            style={({ pressed }) => [
              styles.chip,
              { backgroundColor: selected ? colors.primary : colors.surface.secondary, borderColor: selected ? colors.primary : colors.border.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {selected ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}
            <Text style={{ color: selected ? colors.onPrimary : colors.text.primary, fontWeight: '600', fontSize: 14 }}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export const toggleIn = (list: string[], key: string) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]);

/** A titled block inside a card. */
export const Question = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={[styles.questionTitle, { color: colors.text.primary }]}>{title}</Text>
      {hint ? <Text style={[styles.questionHint, { color: colors.text.secondary }]}>{hint}</Text> : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
};

export const InfoCard = ({ icon, title, children, tone }: { icon: IconName; title: string; children: React.ReactNode; tone?: string }) => {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={styles.infoHead}>
        <Icon name={icon} size={20} color={tone || colors.primary} />
        <Text style={[styles.infoTitle, { color: colors.text.primary }]}>{title}</Text>
      </View>
      {children}
    </Card>
  );
};

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosHeader: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: REC.sosFill },
  sosButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 999, paddingVertical: 16, backgroundColor: REC.sosFill },
  sosPulse: { borderRadius: 999, backgroundColor: REC.sosFill },
  sosText: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: REC.sos },
  stripText: { color: REC.sos, fontWeight: '800', fontSize: 13 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 12 },
  bannerText: { flex: 1, fontSize: 14, lineHeight: 20 },
  crisis: { borderWidth: 2, borderColor: REC.sos, borderRadius: 18, padding: 16, marginBottom: 12, gap: 10 },
  crisisHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crisisTitle: { fontSize: 17, fontWeight: '800' },
  crisisBody: { fontSize: 15, lineHeight: 22 },
  call999: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: REC.sosFill, borderRadius: 14, paddingVertical: 14 },
  call999Text: { color: '#ffffff', fontWeight: '800', fontSize: 16 },
  crisisLine: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12 },
  crisisLineName: { fontSize: 15, fontWeight: '700' },
  crisisLineMeta: { fontSize: 12, marginTop: 2 },
  counterDays: { fontSize: 56, fontWeight: '800', fontVariant: ['tabular-nums'], lineHeight: 62 },
  counterUnit: { fontSize: 15, fontWeight: '700', marginTop: -2 },
  counterClock: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'], marginTop: 4 },
  patternRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  patternChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  breathArea: { width: 240, height: 240, alignItems: 'center', justifyContent: 'center' },
  breathCircle: { position: 'absolute', width: 230, height: 230, borderRadius: 115 },
  breathCore: { position: 'absolute', width: 150, height: 150, borderRadius: 75, borderWidth: 3 },
  breathLabel: { alignItems: 'center' },
  breathPhase: { fontSize: 20, fontWeight: '800' },
  breathCount: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerText: { fontSize: 34, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timerDone: { fontSize: 18, fontWeight: '800' },
  scaleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  scaleItem: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  moodRow: { flexDirection: 'row', gap: 6 },
  moodItem: { flex: 1, alignItems: 'center', gap: 2, borderWidth: 1.5, borderRadius: 14, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  questionTitle: { fontSize: 16, fontWeight: '800' },
  questionHint: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoTitle: { fontSize: 16, fontWeight: '800', flex: 1 },
});
