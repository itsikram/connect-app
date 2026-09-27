import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Speech from 'expo-speech';
import VoiceTextInput from '../../components/VoiceTextInput';
import { useTheme } from '../../contexts/ThemeContext';
import { CoachMessage, CoachMode, CrisisInfo, SuggestedTool, recoveryApi } from '../../services/recoveryApi';
import { useCachedDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { Banner, Button, Card, Chip, CrisisCard, HeaderIconButton, Icon, IconName, Muted, REC, RecoveryPage, SectionHeader } from './ui';

type Props = { navigation?: any; route?: any };

const TOOL_BUTTON_ICONS: Record<Exclude<SuggestedTool, 'none'>, IconName> = {
  breathing: 'weather-windy',
  urge_surf: 'waves',
  reasons: 'heart-outline',
  grounding: 'hand-back-left-outline',
  tape_forward: 'fast-forward-outline',
  distract: 'gamepad-variant-outline',
  call_support: 'phone-outline',
  help: 'lifebuoy',
};

const localMessage = (role: 'user' | 'coach', text: string, mode: string, extra: Partial<CoachMessage> = {}): CoachMessage => ({
  id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  role,
  mode,
  text,
  risk: 'none',
  suggestedTool: 'none',
  crisis: null,
  createdAt: new Date().toISOString(),
  ...extra,
});

export const RecoveryCoach = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { lang, s } = useRecoveryI18n();
  const dashboard = useCachedDashboard();
  const mode: CoachMode = ['sos', 'lapse'].includes(route?.params?.mode) ? route.params.mode : 'coach';
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [aiOff, setAiOff] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const sentInitial = useRef(false);

  const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  useEffect(() => {
    let active = true;
    recoveryApi
      .getCoachHistory(lang)
      .then((response) => {
        if (!active) return;
        setMessages((current) => [...response.data.messages, ...current.filter((message) => message.id.startsWith('local-'))]);
        scrollToEnd();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [lang]);

  useEffect(() => () => {
    Speech.stop();
  }, []);

  const send = async (text = draft) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    setDraft('');
    setMessages((current) => [...current, localMessage('user', trimmed, mode)]);
    setThinking(true);
    scrollToEnd();
    try {
      const response = await recoveryApi.askCoach(trimmed, mode, lang);
      const reply = response.data;
      setMessages((current) => [...current, localMessage('coach', reply.reply, mode, { risk: reply.risk, suggestedTool: reply.suggestedTool, crisis: reply.crisis })]);
    } catch (error: any) {
      if (error?.response?.data?.code === 'AI_DISABLED') {
        setAiOff(true);
      } else {
        // Never a bare error in a hard moment: a calm, curated message with next steps.
        setMessages((current) => [...current, localMessage('coach', s.coach.errorReply, mode, { suggestedTool: mode === 'sos' ? 'breathing' : 'none' })]);
      }
    } finally {
      setThinking(false);
      scrollToEnd();
    }
  };

  // Opened with a prefilled message (e.g. "Talk it through" after a check-in).
  useEffect(() => {
    const initial = route?.params?.message;
    if (initial && !sentInitial.current) {
      sentInitial.current = true;
      send(initial);
    }
  }, [route?.params?.message]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSpeech = (message: CoachMessage) => {
    Speech.stop();
    if (speakingId === message.id) {
      setSpeakingId(null);
      return;
    }
    setSpeakingId(message.id);
    Speech.speak(message.text, {
      language: lang === 'bn' ? 'bn-BD' : 'en-US',
      rate: 0.95,
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  const runTool = (tool: SuggestedTool) => {
    if (tool === 'help') navigation.navigate('RecoveryHelp');
    else if (tool !== 'none') navigation.navigate('RecoverySos', { tool });
  };

  const clear = () =>
    Alert.alert(s.coach.clear, s.coach.clearConfirm, [
      { text: s.common.cancel, style: 'cancel' },
      {
        text: s.home.delete,
        style: 'destructive',
        onPress: async () => {
          try {
            await recoveryApi.clearCoachHistory();
            setMessages([]);
          } catch (_) {
            Alert.alert(s.coach.title, s.common.saveError);
          }
        },
      },
    ]);

  const latestCrisis: CrisisInfo | null = [...messages].reverse().find((message) => message.role === 'coach')?.crisis || null;
  const subtitle = mode === 'sos' ? s.coach.sosSubtitle : mode === 'lapse' ? s.coach.lapseSubtitle : s.coach.subtitle;

  return (
    <RecoveryPage
      title={s.coach.title}
      subtitle={subtitle}
      navigation={navigation}
      scrollRef={scrollRef}
      right={messages.length ? <HeaderIconButton icon="broom" label={s.coach.clear} onPress={clear} /> : undefined}
      footer={
        <View>
          <View style={[styles.composer, { borderColor: colors.border.primary, backgroundColor: colors.surface.primary }]}>
            <VoiceTextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={s.coach.placeholder}
              placeholderTextColor={colors.text.tertiary}
              multiline
              maxLength={1000}
              editable={!aiOff}
              style={[styles.input, { color: colors.text.primary }]}
              rightAccessory={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  disabled={!draft.trim() || thinking || aiOff}
                  onPress={() => send()}
                  style={[styles.send, { backgroundColor: colors.primary, opacity: !draft.trim() || thinking || aiOff ? 0.4 : 1 }]}
                >
                  <Icon name="arrow-up" size={20} color={colors.onPrimary} />
                </Pressable>
              }
            />
          </View>
          <Muted style={styles.disclaimer}>{s.common.aiDisclaimer}</Muted>
        </View>
      }
    >
      {latestCrisis ? <CrisisCard crisis={latestCrisis} contacts={dashboard?.profile?.supportContacts} lang={lang} onMoreHelp={() => navigation.navigate('RecoveryHelp')} /> : null}
      {aiOff ? (
        <>
          <Banner icon="robot-off-outline" tone="warn" text={s.coach.aiOff} />
          <Button label={s.settings.title} icon="cog-outline" variant="secondary" onPress={() => navigation.navigate('RecoverySettings')} />
        </>
      ) : null}

      {!messages.length ? (
        <>
          <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Icon name="robot-happy-outline" size={30} color={colors.onPrimary} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text.primary }]}>{s.coach.title}</Text>
            <Muted style={{ textAlign: 'center', marginTop: 4 }}>{s.coach.intro}</Muted>
          </Card>
          <SectionHeader title={s.coach.tryAsking} />
          <View style={styles.suggestions}>
            {s.coach.suggestions.map((suggestion) => (
              <Chip key={suggestion} label={suggestion} onPress={() => send(suggestion)} />
            ))}
          </View>
        </>
      ) : null}

      {messages.map((message) => {
        const mine = message.role === 'user';
        return (
          <View key={message.id} style={[styles.bubbleRow, mine ? styles.right : styles.left]}>
            {!mine ? (
              <View style={[styles.miniAvatar, { backgroundColor: colors.surface.secondary }]}>
                <Icon name="robot-happy-outline" size={16} color={colors.primary} />
              </View>
            ) : null}
            <View style={{ flexShrink: 1 }}>
              <View
                style={[
                  styles.bubble,
                  mine
                    ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                    : { backgroundColor: colors.surface.primary, borderColor: message.risk === 'crisis' ? REC.sos : colors.border.primary, borderWidth: 1, borderBottomLeftRadius: 4 },
                ]}
              >
                <Text selectable style={[styles.bubbleText, { color: mine ? colors.onPrimary : colors.text.primary }]}>{message.text}</Text>
              </View>
              {!mine ? (
                <View style={styles.bubbleActions}>
                  <Pressable accessibilityRole="button" hitSlop={8} onPress={() => toggleSpeech(message)} style={styles.speak}>
                    <Icon name={speakingId === message.id ? 'stop-circle-outline' : 'volume-high'} size={16} color={colors.text.secondary} />
                    <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{speakingId === message.id ? s.coach.stopReading : s.coach.readAloud}</Text>
                  </Pressable>
                  {message.suggestedTool && message.suggestedTool !== 'none' ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => runTool(message.suggestedTool)}
                      style={({ pressed }) => [styles.toolButton, { borderColor: message.suggestedTool === 'help' ? REC.sos : colors.primary, opacity: pressed ? 0.8 : 1 }]}
                    >
                      <Icon name={TOOL_BUTTON_ICONS[message.suggestedTool]} size={16} color={message.suggestedTool === 'help' ? REC.sos : colors.primary} />
                      <Text style={{ color: message.suggestedTool === 'help' ? REC.sos : colors.primary, fontWeight: '800', fontSize: 13 }}>{s.coach.toolButtons[message.suggestedTool]}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}

      {thinking ? (
        <View style={[styles.bubbleRow, styles.left]}>
          <View style={[styles.miniAvatar, { backgroundColor: colors.surface.secondary }]}>
            <Icon name="robot-happy-outline" size={16} color={colors.primary} />
          </View>
          <View style={[styles.bubble, styles.typing, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary, borderWidth: 1 }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.text.secondary }}>{s.coach.thinking}</Text>
          </View>
        </View>
      ) : null}
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 22, paddingLeft: 14, paddingRight: 4, paddingVertical: 4, minHeight: 46 },
  input: { fontSize: 15, maxHeight: 110, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontSize: 11, textAlign: 'center', marginTop: 6 },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  suggestions: { gap: 8, alignItems: 'flex-start' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  left: { justifyContent: 'flex-start', paddingRight: 32 },
  right: { justifyContent: 'flex-end', paddingLeft: 40 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  speak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toolButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
});
