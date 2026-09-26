import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { fitnessApi } from '../../services/fitnessApi';
import { compatibleImagePickerOptions } from '../../utils/imageUpload';
import { Button, Card, ChipGroup, FIT, Field, FitnessPage, HeaderIconButton, Icon, MEAL_TYPES, Muted, SectionHeader, Stepper, errorMessage, fmt, num } from './ui';

type Props = { navigation?: any; route?: any };

type Nutrition = { name: string; calories: number | string; proteinG: number | string; carbsG: number | string; fatG: number | string; fiberG: number | string };

const COMMON_FOODS: Array<Nutrition & { serving: string }> = [
  { name: 'Plain rice (1 cup)', serving: '1 cup', calories: 205, proteinG: 4, carbsG: 45, fatG: 0.4, fiberG: 0.6 },
  { name: 'Roti / chapati', serving: '1 piece', calories: 120, proteinG: 3, carbsG: 18, fatG: 3.7, fiberG: 2 },
  { name: 'Dal (1 cup)', serving: '1 cup', calories: 230, proteinG: 18, carbsG: 40, fatG: 0.8, fiberG: 15 },
  { name: 'Boiled egg', serving: '1 large', calories: 78, proteinG: 6, carbsG: 0.6, fatG: 5, fiberG: 0 },
  { name: 'Chicken breast (100 g)', serving: '100 g', calories: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 },
  { name: 'Fish curry', serving: '1 bowl', calories: 280, proteinG: 26, carbsG: 8, fatG: 16, fiberG: 1 },
  { name: 'Chicken biryani', serving: '1 plate', calories: 600, proteinG: 28, carbsG: 75, fatG: 20, fiberG: 3 },
  { name: 'Mixed vegetable curry', serving: '1 cup', calories: 150, proteinG: 4, carbsG: 16, fatG: 8, fiberG: 5 },
  { name: 'Oatmeal with fruit', serving: '1 bowl', calories: 350, proteinG: 12, carbsG: 58, fatG: 9, fiberG: 8 },
  { name: 'Greek yogurt & berries', serving: '1 cup', calories: 220, proteinG: 20, carbsG: 25, fatG: 3, fiberG: 4 },
  { name: 'Banana', serving: '1 medium', calories: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, fiberG: 3 },
  { name: 'Apple', serving: '1 medium', calories: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, fiberG: 4 },
  { name: 'Milk tea with sugar', serving: '1 cup', calories: 90, proteinG: 2, carbsG: 14, fatG: 3, fiberG: 0 },
  { name: 'Peanuts (30 g)', serving: '30 g', calories: 170, proteinG: 7, carbsG: 5, fatG: 14, fiberG: 2.5 },
  { name: 'Whey protein shake', serving: '1 scoop', calories: 120, proteinG: 24, carbsG: 3, fatG: 1.5, fiberG: 0 },
  { name: 'Paratha', serving: '1 piece', calories: 260, proteinG: 5, carbsG: 36, fatG: 11, fiberG: 2 },
];

const defaultMealType = () => {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour >= 18 && hour < 23) return 'dinner';
  return 'snack';
};

const FIELDS: Array<{ key: keyof Nutrition; label: string; suffix: string }> = [
  { key: 'calories', label: 'Calories', suffix: 'kcal' },
  { key: 'proteinG', label: 'Protein', suffix: 'g' },
  { key: 'carbsG', label: 'Carbs', suffix: 'g' },
  { key: 'fatG', label: 'Fat', suffix: 'g' },
  { key: 'fiberG', label: 'Fiber', suffix: 'g' },
];

const perServing = (meal: any): Nutrition => {
  const servings = Number(meal?.servings) || 1;
  const scale = (value: any) => (value === undefined || value === null || value === '' ? '' : Math.round((Number(value) / servings) * 10) / 10);
  return { name: meal?.name || '', calories: scale(meal?.calories), proteinG: scale(meal?.proteinG), carbsG: scale(meal?.carbsG), fatG: scale(meal?.fatG), fiberG: scale(meal?.fiberG) };
};

export const FitnessMeal = ({ navigation, route }: Props) => {
  const { colors } = useTheme();
  const editingMeal = route?.params?.meal;
  const initial = editingMeal || route?.params?.analysis || {};
  const [base, setBase] = useState<Nutrition>(perServing(editingMeal ? initial : { ...initial, servings: 1 }));
  const [servings, setServings] = useState<number>(Number(editingMeal?.servings) || 1);
  const [mealType, setMealType] = useState<string>(editingMeal?.mealType || route?.params?.mealType || initial.mealType || defaultMealType());
  const [imageUri, setImageUri] = useState<string | null>(route?.params?.imageUri || editingMeal?.imageUrl || null);
  const [source, setSource] = useState<string>(editingMeal?.source || route?.params?.source || 'manual');
  const [recent, setRecent] = useState<any[]>([]);
  const [showAllFoods, setShowAllFoods] = useState(false);

  useEffect(() => {
    if (editingMeal) return;
    fitnessApi.getRecentMeals().then((response) => setRecent(response.data.meals || [])).catch(() => {});
  }, [editingMeal]);

  const set = (key: keyof Nutrition) => (value: string) => setBase((old) => ({ ...old, [key]: key === 'name' ? value : value.replace(/[^0-9.]/g, '') }));
  const fill = (values: Partial<Nutrition>, nextSource = 'manual') => {
    setBase((old) => ({ ...old, ...values }));
    setServings(1);
    setSource(nextSource);
  };

  const pickImage = async (camera: boolean) => {
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(camera ? 'Camera permission needed' : 'Photo permission needed', 'You can still add this meal manually.');
      return;
    }
    const options = { mediaTypes: ImagePicker.MediaTypeOptions.Images, ...compatibleImagePickerOptions, quality: 0.7, allowsEditing: false };
    const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]?.uri) setImageUri(result.assets[0].uri);
  };

  const analyze = async () => {
    if (!imageUri && !base.name.trim()) {
      Alert.alert('Analyze food', 'Add a photo or describe what you ate, e.g. "2 rotis with chicken curry".');
      return;
    }
    try {
      let response;
      if (imageUri && !imageUri.startsWith('http')) {
        const body = new FormData();
        body.append('name', base.name || 'meal');
        body.append('mealType', mealType);
        body.append('image', { uri: imageUri, name: 'meal.jpg', type: 'image/jpeg' } as any);
        response = await fitnessApi.analyzeMeal(body);
      } else {
        response = await fitnessApi.analyzeMeal({ name: base.name, mealType });
      }
      const analysis = response.data.analysis || {};
      if (response.data.provider === 'placeholder' || analysis.calories === null) {
        Alert.alert('AI analysis unavailable', 'Enter the nutrition values manually or pick a common food below.');
        return;
      }
      fill({ name: analysis.name || base.name, calories: analysis.calories, proteinG: analysis.proteinG, carbsG: analysis.carbsG, fatG: analysis.fatG, fiberG: analysis.fiberG }, response.data.provider || 'gemini');
    } catch (_) {
      Alert.alert('Analysis unavailable', 'Could not analyze this meal. You can add it manually.');
    }
  };

  const totals = FIELDS.reduce((acc, field) => ({ ...acc, [field.key]: Math.round((Number(base[field.key]) || 0) * servings * 10) / 10 }), {} as Record<string, number>);
  const macroCalories = totals.proteinG * 4 + totals.carbsG * 4 + totals.fatG * 9;
  const mismatch = totals.calories > 0 && macroCalories > 0 && Math.abs(macroCalories - totals.calories) > Math.max(60, totals.calories * 0.25);

  const save = async () => {
    if (!base.name.trim()) { Alert.alert('Meal', 'Add a food name before saving.'); return; }
    if (!(Number(base.calories) > 0)) { Alert.alert('Meal', 'Add a calorie value before saving.'); return; }
    const payload = {
      name: base.name.trim(),
      mealType,
      servings,
      calories: totals.calories,
      proteinG: totals.proteinG,
      carbsG: totals.carbsG,
      fatG: totals.fatG,
      fiberG: totals.fiberG,
      source: ['manual', 'gemini', 'placeholder'].includes(source) ? source : 'manual',
      imageUrl: imageUri || undefined,
    };
    try {
      if (editingMeal?._id) await fitnessApi.updateMeal(editingMeal._id, payload);
      else await fitnessApi.createMeal({ ...payload, date: new Date().toISOString() });
      navigation.navigate('FitnessDashboard');
    } catch (error: any) {
      Alert.alert('Meal', errorMessage(error, 'Please check the nutrition values.'));
    }
  };

  const remove = () => Alert.alert('Delete meal', `Remove "${editingMeal?.name}"?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await fitnessApi.deleteMeal(editingMeal._id); navigation.goBack(); } catch (e: any) { Alert.alert('Meal', errorMessage(e, 'Could not delete this meal')); } } },
  ]);

  const foods = showAllFoods ? COMMON_FOODS : COMMON_FOODS.slice(0, 6);

  return (
    <FitnessPage
      title={editingMeal ? 'Edit meal' : 'Log food'}
      navigation={navigation}
      right={editingMeal ? <HeaderIconButton icon="trash-can-outline" label="Delete meal" onPress={remove} /> : undefined}
      footer={
        <View style={s.footer}>
          <View style={{ flex: 1 }}>
            <Text style={[s.footerKcal, { color: colors.text.primary }]}>{fmt(totals.calories)} kcal</Text>
            <Text style={[s.footerMacros, { color: colors.text.secondary }]}>P {num(totals.proteinG)} · C {num(totals.carbsG)} · F {num(totals.fatG)}</Text>
          </View>
          <Button label={editingMeal ? 'Update' : 'Save meal'} loadingLabel="Saving..." icon="check" onPress={save} style={{ marginTop: 0, paddingHorizontal: 22 }} />
        </View>
      }
    >
      <ChipGroup value={mealType} onChange={setMealType} options={MEAL_TYPES.map((type) => ({ label: type.label, value: type.value, icon: type.icon }))} />

      {!editingMeal ? (
        <Card style={{ marginTop: 14 }}>
          <View style={s.aiHead}>
            <Icon name="creation" size={20} color={colors.primary} />
            <Text style={[s.aiTitle, { color: colors.text.primary }]}>Snap or describe your meal</Text>
          </View>
          <Muted style={{ fontSize: 13, marginBottom: 12 }}>AI estimates calories and macros. Always review before saving.</Muted>
          {imageUri ? (
            <View>
              <Image source={{ uri: imageUri }} style={s.photo} resizeMode="cover" />
              <Pressable accessibilityLabel="Remove photo" onPress={() => setImageUri(null)} style={s.removePhoto}><Icon name="close" size={18} color="#fff" /></Pressable>
            </View>
          ) : (
            <View style={s.photoButtons}>
              <PhotoButton icon="camera-outline" label="Camera" onPress={() => pickImage(true)} />
              <PhotoButton icon="image-outline" label="Gallery" onPress={() => pickImage(false)} />
            </View>
          )}
          <Field label="What did you eat?" value={base.name} onChangeText={set('name')} placeholder="e.g. 2 rotis with chicken curry" style={{ marginTop: 12, marginBottom: 0 }} />
          <Button label="Analyze with AI" loadingLabel="Analyzing..." icon="auto-fix" variant="secondary" onPress={analyze} />
          {source === 'gemini' ? <Muted style={{ fontSize: 12, marginTop: 8, color: colors.status.warning }}>AI-filled values are estimates. Adjust portions below if needed.</Muted> : null}
        </Card>
      ) : null}

      {!editingMeal && recent.length ? (
        <>
          <SectionHeader title="Recent" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {recent.map((meal) => (
              <Pressable key={meal.name} onPress={() => { fill(perServing({ ...meal, servings: 1 })); if (meal.mealType) setMealType(meal.mealType); }} style={[s.recent, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}>
                <Text numberOfLines={1} style={[s.recentName, { color: colors.text.primary }]}>{meal.name}</Text>
                <Text style={[s.recentKcal, { color: colors.text.secondary }]}>{fmt(meal.calories)} kcal{meal.count > 1 ? ` · ${meal.count}x` : ''}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {!editingMeal ? (
        <>
          <SectionHeader title="Common foods" action={showAllFoods ? 'Show less' : 'Show all'} onAction={() => setShowAllFoods((value) => !value)} />
          <Card style={{ paddingVertical: 4 }}>
            {foods.map((food, index) => (
              <Pressable key={food.name} onPress={() => fill(food)} style={[s.foodRow, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.primary }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.foodName, { color: colors.text.primary }]}>{food.name}</Text>
                  <Text style={[s.recentKcal, { color: colors.text.tertiary }]}>{food.serving} · P {food.proteinG}g · C {food.carbsG}g · F {food.fatG}g</Text>
                </View>
                <Text style={[s.foodKcal, { color: colors.text.primary }]}>{food.calories}</Text>
                <Icon name="plus-circle-outline" size={20} color={colors.primary} />
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Nutrition per serving" />
      <Card>
        {editingMeal ? <Field label="Food name" value={base.name} onChangeText={set('name')} /> : null}
        <View style={s.fieldGrid}>
          {FIELDS.map((field) => (
            <Field key={field.key} label={field.label} value={base[field.key]} onChangeText={set(field.key)} keyboardType="decimal-pad" suffix={field.suffix} style={s.gridField} />
          ))}
        </View>
        <Text style={[s.servingLabel, { color: colors.text.secondary }]}>Servings</Text>
        <Stepper value={servings} onChange={setServings} step={0.5} min={0.5} max={20} decimals={1} suffix="x" />
        {mismatch ? (
          <View style={[s.warning, { backgroundColor: colors.surface.secondary }]}>
            <Icon name="alert-circle-outline" size={18} color={colors.status.warning} />
            <Muted style={{ flex: 1, fontSize: 12 }}>Macros add up to about {fmt(macroCalories)} kcal (4/4/9 rule). Double-check the values.</Muted>
          </View>
        ) : null}
        <View style={s.macroLegend}>
          {[{ label: 'Protein', value: totals.proteinG * 4, color: FIT.protein }, { label: 'Carbs', value: totals.carbsG * 4, color: FIT.carbs }, { label: 'Fat', value: totals.fatG * 9, color: FIT.fat }].map((item) => (
            <View key={item.label} style={s.legendItem}>
              <View style={[s.swatch, { backgroundColor: item.color }]} />
              <Text style={{ color: colors.text.secondary, fontSize: 12 }}>{item.label} {macroCalories ? Math.round((item.value / macroCalories) * 100) : 0}%</Text>
            </View>
          ))}
        </View>
      </Card>
    </FitnessPage>
  );
};

/** Kept for existing navigation: AI results open the same editor, pre-filled. */
export const FitnessConfirmation = ({ navigation, route }: Props) => (
  <FitnessMeal navigation={navigation} route={{ ...route, params: { ...route?.params, source: route?.params?.source || 'gemini' } }} />
);

const PhotoButton = ({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) => {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.photoButton, { borderColor: colors.border.secondary, backgroundColor: colors.surface.secondary, opacity: pressed ? 0.8 : 1 }]}>
      <Icon name={icon} size={26} color={colors.primary} />
      <Text style={{ color: colors.text.primary, fontWeight: '700', marginTop: 4 }}>{label}</Text>
    </Pressable>
  );
};

const s = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  footerKcal: { fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  footerMacros: { fontSize: 12 },
  aiHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  aiTitle: { fontSize: 16, fontWeight: '800' },
  photo: { width: '100%', height: 200, borderRadius: 14 },
  removePhoto: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  photoButtons: { flexDirection: 'row', gap: 10 },
  photoButton: { flex: 1, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 18 },
  recent: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, width: 150 },
  recentName: { fontSize: 14, fontWeight: '700' },
  recentKcal: { fontSize: 12, marginTop: 2 },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  foodName: { fontSize: 14, fontWeight: '600' },
  foodKcal: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  gridField: { width: '48%', flexGrow: 1 },
  servingLabel: { fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 8 },
  warning: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: 12, padding: 10, marginTop: 12 },
  macroLegend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 4 },
});
