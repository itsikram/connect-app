import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useChessGame } from '../../contexts/ChessGameContext';
import { useLudoGame } from '../../contexts/LudoGameContext';
import { CravingResult, SubstanceKey, ToolKey, newClientId, recoveryApi } from '../../services/recoveryApi';
import { OFFLINE_HELPLINES, OFFLINE_TRIGGERS, TOOL_ICONS } from './content';
import { hasPersonalOrder, orderTools } from './helpers';
import { useCachedDashboard, useRecoveryContent } from './hooks';
import { useRecoveryI18n } from './i18n';
import {
  Banner,
  BreathingCircle,
  Button,
  Card,
  ChipGroup,
  EmergencyStrip,
  Icon,
  InfoCard,
  MultiChips,
  Muted,
  NumberScale,
  Question,
  REC,
  RecoveryPage,
  UrgeTimer,
  callPhone,
  sendSms,
} from './ui';

type Props = { navigation?: any; route?: any };
type Phase = 'rate' | 'tools' | 'tool' | 'outcome' | 'done';

// Every step here works offline; the session is queued and synced later if needed.
export const RecoverySos = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const { lang, s, f, num, money } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const dashboard = useCachedDashboard();
  const { setLudoGameActive } = useLudoGame();
  const { setChessGameActive } = useChessGame();
  const initialTool: ToolKey | undefined = route?.params?.tool;

  const [phase, setPhase] = useState<Phase>(initialTool ? 'tool' : 'rate');
  const [tool, setTool] = useState<ToolKey | null>(initialTool || null);
  const [intensity, setIntensity] = useState<number | null>(null);
  const [intensityEnd, setIntensityEnd] = useState<number | null>(null);
  const [trigger, setTrigger] = useState('');
  const [substance, setSubstance] = useState<SubstanceKey | ''>('');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CravingResult | null>(null);
  const [saveError, setSaveError] = useState('');
  const toolsUsed = useRef<Set<ToolKey>>(new Set(initialTool ? [initialTool] : []));
  const startedAt = useRef(Date.now());
  const clientId = useRef(newClientId());
  const logged = useRef(false);

  const profile = dashboard?.profile;
  const substances = dashboard?.substances || [];
  const primary = substances.find((item) => item.primary) || substances[0];
  const tools = useMemo(() => orderTools(dashboard?.toolOrder), [dashboard?.toolOrder]);
  const personal = hasPersonalOrder(dashboard?.toolOrder);
  const triggers = content?.triggers?.length ? content.triggers : OFFLINE_TRIGGERS[lang];
  const helplines = (content?.helplines?.length ? content.helplines : OFFLINE_HELPLINES[lang]).filter((line) => line.crisis && line.key !== 'emergency');
  const contacts = (profile?.supportContacts || []).filter((contact) => contact.phone);
  const reasonLabels = (profile?.reasonKeys || []).map((key) => content?.reasons?.find((reason) => reason.key === key)?.label).filter(Boolean) as string[];

  const waveDone = useCallback(() => setPhase('outcome'), []);

  const openTool = (key: ToolKey) => {
    toolsUsed.current.add(key);
    if (key === 'coach') {
      navigation.navigate('RecoveryCoach', { mode: 'sos' });
      return;
    }
    setTool(key);
    setStep(0);
    setPhase('tool');
  };

  const log = async (outcome: 'resisted' | 'used' | 'unsure') => {
    if (logged.current || !profile) return null;
    logged.current = true;
    const start = intensity ?? intensityEnd ?? 5;
    try {
      return await recoveryApi.logCraving(
        {
          clientId: clientId.current,
          at: new Date(startedAt.current).toISOString(),
          substance: (substance || primary?.key) as SubstanceKey | undefined,
          intensityStart: Math.max(1, start),
          intensityEnd: intensityEnd ?? undefined,
          trigger: trigger || undefined,
          tools: [...toolsUsed.current],
          durationSec: Math.round((Date.now() - startedAt.current) / 1000),
          outcome,
        },
        lang,
      );
    } catch (_) {
      // The server rejected it (not a network problem). The person still got through; do not block them.
      setSaveError(s.common.saveError);
      return null;
    }
  };

  const finish = async (outcome: 'resisted' | 'used') => {
    const saved = await log(outcome);
    if (outcome === 'used') {
      navigation.replace('RecoveryLapse', { substance: substance || primary?.key });
      return;
    }
    setResult(saved);
    setPhase('done');
  };

  const playGame = async (game: 'ludo' | 'chess') => {
    toolsUsed.current.add('distract');
    await log('unsure');
    navigation.popToTop();
    if (game === 'ludo') setLudoGameActive(true);
    else setChessGameActive(true);
  };

  const renderTool = () => {
    switch (tool) {
      case 'urge_surf':
        return (
          <InfoCard icon="waves" title={s.sos.urgeTitle}>
            <Muted style={styles.body}>{s.sos.urgeBody}</Muted>
            <UrgeTimer lang={lang} onComplete={waveDone} />
          </InfoCard>
        );
      case 'breathing':
        return (
          <Card>
            <BreathingCircle lang={lang} autoStart />
          </Card>
        );
      case 'reasons':
        return (
          <InfoCard icon="heart-outline" title={s.sos.reasonsTitle}>
            {reasonLabels.map((label) => (
              <View key={label} style={styles.bullet}>
                <Icon name="heart" size={16} color={REC.sos} />
                <Text style={[styles.bulletText, { color: colors.text.primary }]}>{label}</Text>
              </View>
            ))}
            {profile?.reasons ? <Text style={[styles.quote, { color: colors.text.primary }]}>{profile.reasons}</Text> : null}
            {!reasonLabels.length && !profile?.reasons ? <Muted style={styles.body}>{s.sos.noReasons}</Muted> : null}
            {profile?.letter ? (
              <View style={[styles.letter, { backgroundColor: colors.surface.secondary }]}>
                <Text style={[styles.letterTitle, { color: colors.text.secondary }]}>{s.sos.letterTitle}</Text>
                <Text style={[styles.quote, { color: colors.text.primary }]}>{profile.letter}</Text>
              </View>
            ) : null}
            {dashboard?.totals?.moneySaved ? <Text style={[styles.strong, { color: REC.money }]}>{f(s.sos.moneyLine, { amount: num(dashboard.totals.moneySaved) })}</Text> : null}
            {primary?.currentStreakDays ? <Text style={[styles.strong, { color: colors.text.primary }]}>{f(s.sos.daysLine, { days: num(primary.currentStreakDays) })}</Text> : null}
          </InfoCard>
        );
      case 'tape_forward':
      case 'grounding':
      case 'four_ds': {
        const items: Array<[string, string]> =
          tool === 'tape_forward'
            ? s.sos.tapeQuestions.map((text) => [text, ''])
            : tool === 'grounding'
              ? s.sos.groundingSteps.map((text) => [text, ''])
              : (s.sos.fourDs as Array<[string, string]>);
        const [title, detail] = items[Math.min(step, items.length - 1)];
        const last = step >= items.length - 1;
        return (
          <InfoCard icon={TOOL_ICONS[tool]} title={s.sos.tools[tool][0]}>
            <Muted style={{ fontSize: 13 }}>{`${num(step + 1)} / ${num(items.length)}`}</Muted>
            <Text style={[styles.bigStep, { color: colors.text.primary }]}>{title}</Text>
            {detail ? <Muted style={styles.body}>{detail}</Muted> : null}
            <Button label={last ? s.common.done : s.sos.nextStep} icon={last ? 'check' : 'arrow-right'} onPress={() => (last ? setPhase('tools') : setStep(step + 1))} />
          </InfoCard>
        );
      }
      case 'distract':
        return (
          <>
            <InfoCard icon="gamepad-variant-outline" title={s.sos.gamesTitle}>
              <Muted style={styles.body}>{s.sos.gamesBody}</Muted>
              <View style={styles.row}>
                <Button label={s.sos.playLudo} icon="dice-5-outline" variant="secondary" onPress={() => playGame('ludo')} style={{ flex: 1 }} />
                <Button label={s.sos.playChess} icon="chess-knight" variant="secondary" onPress={() => playGame('chess')} style={{ flex: 1 }} />
              </View>
            </InfoCard>
            <InfoCard icon="walk" title={s.sos.tools.distract[0]}>
              {s.sos.distractIdeas.map((idea) => (
                <View key={idea} style={styles.bullet}>
                  <Icon name="circle-small" size={20} color={colors.primary} />
                  <Text style={[styles.bulletText, { color: colors.text.primary }]}>{idea}</Text>
                </View>
              ))}
            </InfoCard>
          </>
        );
      case 'call_support':
        return (
          <InfoCard icon="phone-outline" title={s.sos.tools.call_support[0]}>
            {contacts.length ? (
              contacts.map((contact) => (
                <View key={`${contact.name}-${contact.phone}`} style={styles.row}>
                  <Button label={f(s.sos.callPerson, { name: contact.name || contact.phone })} icon="phone" onPress={() => callPhone(contact.phone, lang)} style={{ flex: 1 }} />
                  <Button label={s.help.message} icon="message-text-outline" variant="secondary" onPress={() => sendSms(contact.phone, s.sos.smsText)} style={{ flex: 1 }} />
                </View>
              ))
            ) : (
              <Muted style={styles.body}>{s.sos.noContact}</Muted>
            )}
            <Text style={[styles.subhead, { color: colors.text.secondary }]}>{s.sos.orHelpline}</Text>
            {helplines.map((line) => (
              <Button key={line.key} label={`${line.name} · ${line.display}`} icon="phone-outline" variant="secondary" onPress={() => callPhone(line.phone, lang)} />
            ))}
          </InfoCard>
        );
      default:
        return null;
    }
  };

  const footer =
    phase === 'rate' ? (
      <Button label={s.sos.start} icon="arrow-right" disabled={intensity === null} onPress={() => setPhase('tools')} />
    ) : phase === 'tools' || phase === 'tool' ? (
      <View style={styles.row}>
        {phase === 'tool' ? <Button label={s.common.back} variant="secondary" icon="view-grid-outline" onPress={() => setPhase('tools')} style={{ flex: 1 }} /> : null}
        <Button label={s.sos.finish} icon="flag-checkered" onPress={() => setPhase('outcome')} style={{ flex: 2 }} />
      </View>
    ) : phase === 'done' ? (
      <Button label={s.sos.backHome} icon="home-outline" onPress={() => navigation.goBack()} />
    ) : undefined;

  return (
    <RecoveryPage title={s.sos.title} subtitle={s.sos.subtitle} navigation={navigation} showSos={false} footer={footer}>
      <EmergencyStrip lang={lang} />

      {phase === 'rate' ? (
        <Card>
          <Question title={s.sos.rateTitle}>
            <NumberScale min={1} max={10} value={intensity} onChange={setIntensity} lang={lang} lowLabel={s.sos.mild} highLabel={s.sos.overwhelming} danger />
          </Question>
          {substances.length > 1 ? (
            <Question title={s.sos.cravingFor}>
              <ChipGroup options={substances.map((item) => ({ label: item.name, value: item.key }))} value={substance || primary?.key || ''} onChange={(value) => setSubstance(value as SubstanceKey)} />
            </Question>
          ) : null}
          <Question title={s.sos.triggerQ} hint={s.common.optional}>
            <MultiChips options={triggers} values={trigger ? [trigger] : []} onToggle={(key) => setTrigger(trigger === key ? '' : key)} />
          </Question>
        </Card>
      ) : null}

      {phase === 'tools' ? (
        <>
          <Text style={[styles.title, { color: colors.text.primary }]}>{s.sos.toolsTitle}</Text>
          {tools.map((key, index) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              onPress={() => openTool(key)}
              style={({ pressed }) => [styles.tool, { backgroundColor: colors.surface.primary, borderColor: index === 0 && personal ? colors.primary : colors.border.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[styles.toolIcon, { backgroundColor: colors.surface.secondary }]}>
                <Icon name={TOOL_ICONS[key]} size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toolTitle, { color: colors.text.primary }]}>{s.sos.tools[key][0]}</Text>
                <Text style={[styles.toolHint, { color: colors.text.secondary }]}>{s.sos.tools[key][1]}</Text>
                {index === 0 && personal ? <Text style={[styles.worked, { color: colors.primary }]}>{s.sos.workedBefore}</Text> : null}
              </View>
              {toolsUsed.current.has(key) ? <Icon name="check-circle" size={20} color={colors.status.success} /> : <Icon name="chevron-right" size={22} color={colors.text.tertiary} />}
            </Pressable>
          ))}
        </>
      ) : null}

      {phase === 'tool' ? renderTool() : null}

      {phase === 'outcome' ? (
        <Card>
          {intensity === null ? (
            <Question title={s.sos.startWas}>
              <NumberScale min={1} max={10} value={intensity} onChange={setIntensity} lang={lang} lowLabel={s.sos.mild} highLabel={s.sos.overwhelming} danger />
            </Question>
          ) : null}
          <Question title={s.sos.outcomeTitle}>
            <NumberScale min={0} max={10} value={intensityEnd} onChange={setIntensityEnd} lang={lang} lowLabel={s.sos.mild} highLabel={s.sos.overwhelming} danger />
          </Question>
          <Question title={s.sos.outcomeQ}>
            <Button label={s.sos.resisted} icon="shield-check" onPress={() => finish('resisted')} />
            <Button label={s.sos.used} icon="restart" variant="secondary" onPress={() => finish('used')} />
          </Question>
        </Card>
      ) : null}

      {phase === 'done' ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Text style={styles.party}>🎉</Text>
          <Text style={[styles.title, { color: colors.text.primary, textAlign: 'center' }]}>{s.sos.celebrateTitle}</Text>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.sos.celebrateBody}</Muted>
          {result?.pointsEarned ? <Text style={[styles.strong, { color: REC.warm }]}>{f(s.common.points, { n: num(result.pointsEarned) })}</Text> : null}
          {(result?.newBadges || []).map((badge) => (
            <Text key={badge.key} style={[styles.strong, { color: colors.text.primary }]}>{f(s.common.newBadge, { label: badge.label })}</Text>
          ))}
          {dashboard?.totals?.moneySaved ? <Muted style={{ marginTop: 8 }}>{`${s.home.moneySaved}: ${money(dashboard.totals.moneySaved)}`}</Muted> : null}
          {result?.queued ? <Banner icon="cloud-upload-outline" text={s.sos.savedOffline} /> : null}
          {saveError ? <Banner icon="alert-circle-outline" tone="warn" text={saveError} /> : null}
        </Card>
      ) : null}

      {phase !== 'done' && phase !== 'rate' ? (
        <Button label={s.sos.talkNow} icon="robot-happy-outline" variant="ghost" onPress={() => openTool('coach')} />
      ) : null}
    </RecoveryPage>
  );
};

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '800', marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 21, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  tool: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14, marginBottom: 10 },
  toolIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { fontSize: 16, fontWeight: '800' },
  toolHint: { fontSize: 13, marginTop: 2 },
  worked: { fontSize: 12, fontWeight: '800', marginTop: 4 },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bulletText: { flex: 1, fontSize: 15, lineHeight: 21 },
  quote: { fontSize: 16, lineHeight: 24, fontStyle: 'italic', marginTop: 8 },
  letter: { borderRadius: 12, padding: 12, marginTop: 12 },
  letterTitle: { fontSize: 12, fontWeight: '800' },
  strong: { fontSize: 15, fontWeight: '800', marginTop: 10 },
  bigStep: { fontSize: 22, fontWeight: '800', lineHeight: 30, marginVertical: 12 },
  subhead: { fontSize: 13, fontWeight: '700', marginTop: 14 },
  party: { fontSize: 54 },
});
