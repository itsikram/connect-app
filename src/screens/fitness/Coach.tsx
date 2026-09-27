import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { CoachTurn, fitnessApi } from '../../services/fitnessApi';
import { Button, Card, Chip, FIT, FitnessPage, HeaderIconButton, Icon, Muted, SectionHeader, errorMessage, fmt } from './ui';

type Props = { navigation?: any };

const SUGGESTIONS = [
  'What should I eat for dinner to hit my protein?',
  'Build me a 3-day beginner workout plan',
  'How can I stop late-night snacking?',
  'Am I on track for my goal this week?',
  'Tips to drink more water',
  'How do I break a weight-loss plateau?',
];

export const FitnessCoach = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const ask = async (text = question) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const history = turns;
    setTurns([...history, { role: 'user', text: trimmed }]);
    setQuestion('');
    setThinking(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    try {
      const response = await fitnessApi.askCoach(trimmed, history);
      setTurns((old) => [...old, { role: 'coach', text: response.data.reply || 'I could not generate guidance right now.' }]);
    } catch (error: any) {
      setTurns((old) => [...old, { role: 'coach', text: `⚠️ ${errorMessage(error, 'Coach is unavailable. Please try again shortly.')}` }]);
    } finally {
      setThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  };

  return (
    <FitnessPage
      title="AI coach"
      subtitle="Knows your targets and today's logs"
      navigation={navigation}
      scrollRef={scrollRef}
      right={turns.length ? <HeaderIconButton icon="broom" label="Clear conversation" onPress={() => setTurns([])} /> : undefined}
      footer={
        <View style={[s.composer, { borderColor: colors.border.primary, backgroundColor: colors.surface.primary }]}>
          <TextInput
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask about food, training, sleep..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={500}
            style={[s.input, { color: colors.text.primary }]}
          />
          <Pressable accessibilityLabel="Send" disabled={!question.trim() || thinking} onPress={() => ask()} style={[s.send, { backgroundColor: colors.primary, opacity: !question.trim() || thinking ? 0.4 : 1 }]}>
            <Icon name="arrow-up" size={20} color={colors.onPrimary} />
          </Pressable>
        </View>
      }
    >
      {!turns.length ? (
        <>
          <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
            <View style={[s.avatar, { backgroundColor: colors.primary }]}><Icon name="robot-happy-outline" size={30} color={colors.onPrimary} /></View>
            <Text style={[s.heroTitle, { color: colors.text.primary }]}>Your personal coach</Text>
            <Muted style={{ textAlign: 'center', marginTop: 4 }}>Get answers grounded in your calorie and macro targets, today's meals, workouts, water, steps and sleep.</Muted>
          </Card>
          <SectionHeader title="Try asking" />
          <View style={s.suggestions}>
            {SUGGESTIONS.map((suggestion) => <Chip key={suggestion} label={suggestion} onPress={() => ask(suggestion)} />)}
          </View>
        </>
      ) : null}

      {turns.map((turn, index) => (
        <View key={index} style={[s.bubbleRow, turn.role === 'user' ? s.right : s.left]}>
          {turn.role === 'coach' ? <View style={[s.miniAvatar, { backgroundColor: colors.surface.secondary }]}><Icon name="robot-happy-outline" size={16} color={colors.primary} /></View> : null}
          <View style={[s.bubble, turn.role === 'user' ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 } : { backgroundColor: colors.surface.primary, borderColor: colors.border.primary, borderWidth: 1, borderBottomLeftRadius: 4 }]}>
            <Text selectable style={[s.bubbleText, { color: turn.role === 'user' ? colors.onPrimary : colors.text.primary }]}>{turn.text}</Text>
          </View>
        </View>
      ))}
      {thinking ? (
        <View style={[s.bubbleRow, s.left]}>
          <View style={[s.miniAvatar, { backgroundColor: colors.surface.secondary }]}><Icon name="robot-happy-outline" size={16} color={colors.primary} /></View>
          <View style={[s.bubble, s.typing, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary, borderWidth: 1 }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={{ color: colors.text.secondary }}>Thinking...</Text>
          </View>
        </View>
      ) : null}
      <Muted style={{ fontSize: 11, textAlign: 'center', marginTop: 12 }}>General wellness guidance, not medical advice.</Muted>
    </FitnessPage>
  );
};

export const FitnessRecommendations = ({ navigation }: Props) => {
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await fitnessApi.getRecommendations(Date.now());
      setData(response.data);
    } catch (err: any) {
      setError(errorMessage(err, 'Could not load recommendations'));
    } finally {
      setLoading(false);
    }
  };
  React.useEffect(() => { load(); }, []);

  const remaining = data?.remaining || {};
  return (
    <FitnessPage
      title="Meal ideas"
      subtitle="Picked to fit what you have left today"
      navigation={navigation}
      right={<HeaderIconButton icon="refresh" label="New ideas" onPress={load} />}
    >
      {data ? (
        <Card>
          <Text style={[s.remainingTitle, { color: colors.text.secondary }]}>Remaining today</Text>
          <Text style={[s.remainingKcal, { color: colors.text.primary }]}>{fmt(remaining.calories)} <Text style={{ fontSize: 14, color: colors.text.secondary }}>kcal</Text></Text>
          <View style={s.remainingRow}>
            {[{ label: 'Protein', value: remaining.proteinG, color: FIT.protein }, { label: 'Carbs', value: remaining.carbsG, color: FIT.carbs }, { label: 'Fat', value: remaining.fatG, color: FIT.fat }].map((item) => (
              <View key={item.label} style={s.remainingItem}>
                <View style={[s.swatch, { backgroundColor: item.color }]} />
                <Text style={{ color: colors.text.primary, fontWeight: '700' }}>{fmt(item.value)}g</Text>
                <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {error ? <Card><Muted style={{ color: colors.status.error }}>{error}</Muted><Button label="Try again" variant="secondary" onPress={load} /></Card> : null}
      {loading ? (
        <View style={s.loading}><ActivityIndicator color={colors.primary} /><Muted>Finding meals that fit your targets...</Muted></View>
      ) : null}

      {!loading && data ? (
        <>
          <Muted style={{ fontSize: 12, marginBottom: 8 }}>{data.source === 'gemini' ? 'Personalised by AI' : 'Curated suggestions'} · tap refresh for new ideas</Muted>
          {(data.recommendations || []).map((item: any, index: number) => (
            <Card key={`${item.name}-${index}`}>
              <View style={s.recHead}>
                <Text style={[s.recName, { color: colors.text.primary }]}>{item.name}</Text>
                <Text style={[s.recKcal, { color: colors.text.primary }]}>{fmt(item.calories)} kcal</Text>
              </View>
              <Text style={{ color: colors.text.tertiary, fontSize: 12, marginBottom: 8 }}>
                {String(item.mealType || 'snack').replace(/^./, (letter: string) => letter.toUpperCase())} · P {item.proteinG}g · C {item.carbsG}g · F {item.fatG}g
              </Text>
              <Muted style={{ fontSize: 13 }}>{item.why}</Muted>
              <Button
                label="Log this meal"
                icon="plus"
                variant="secondary"
                onPress={() => navigation.navigate('FitnessMeal', { analysis: { name: item.name, calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG, fiberG: 0 }, mealType: item.mealType })}
              />
            </Card>
          ))}
          {(data.healthNotes || []).length ? (
            <>
              <SectionHeader title="Good to know" />
              <Card>
                {(data.healthNotes || []).map((note: string, index: number) => (
                  <View key={index} style={s.note}><Icon name="information-outline" size={16} color={colors.text.tertiary} /><Muted style={{ flex: 1, fontSize: 13 }}>{note}</Muted></View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      ) : null}
    </FitnessPage>
  );
};

const s = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderWidth: 1, borderRadius: 22, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 15, maxHeight: 110, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  heroTitle: { fontSize: 20, fontWeight: '800' },
  suggestions: { gap: 8, alignItems: 'flex-start' },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 10 },
  left: { justifyContent: 'flex-start', paddingRight: 40 },
  right: { justifyContent: 'flex-end', paddingLeft: 40 },
  miniAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  remainingTitle: { fontSize: 13, fontWeight: '600' },
  remainingKcal: { fontSize: 30, fontWeight: '800', marginVertical: 4 },
  remainingRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  remainingItem: { alignItems: 'center', flex: 1, gap: 2 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 30 },
  recHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 2 },
  recName: { flex: 1, fontSize: 16, fontWeight: '800' },
  recKcal: { fontSize: 15, fontWeight: '700' },
  note: { flexDirection: 'row', gap: 8, marginBottom: 8 },
});
