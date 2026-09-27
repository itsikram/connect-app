import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export const Icon = MaterialCommunityIcons;
export type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Fixed metric hues (validated for CVD separation on dark surfaces). Every use is
 * paired with a text label so identity never relies on color alone.
 */
export const FIT = {
  protein: '#3987e5',
  carbs: '#d95926',
  fat: '#199e70',
  water: '#3987e5',
  steps: '#199e70',
  workout: '#d95926',
  sleep: '#8A8AFF',
  weight: '#c98500',
};

export const MEAL_TYPES: Array<{ value: string; label: string; icon: IconName }> = [
  { value: 'breakfast', label: 'Breakfast', icon: 'weather-sunset-up' },
  { value: 'lunch', label: 'Lunch', icon: 'white-balance-sunny' },
  { value: 'dinner', label: 'Dinner', icon: 'weather-night' },
  { value: 'snack', label: 'Snack', icon: 'food-apple-outline' },
];

export const WORKOUT_TYPES: Array<{ value: string; label: string; icon: IconName }> = [
  { value: 'walking', label: 'Walk', icon: 'walk' },
  { value: 'running', label: 'Run', icon: 'run-fast' },
  { value: 'cycling', label: 'Cycle', icon: 'bike' },
  { value: 'strength', label: 'Strength', icon: 'dumbbell' },
  { value: 'hiit', label: 'HIIT', icon: 'lightning-bolt' },
  { value: 'yoga', label: 'Yoga', icon: 'meditation' },
  { value: 'swimming', label: 'Swim', icon: 'swim' },
  { value: 'sports', label: 'Sports', icon: 'soccer' },
  { value: 'cardio', label: 'Cardio', icon: 'heart-pulse' },
  { value: 'other', label: 'Other', icon: 'arm-flex-outline' },
];

export const workoutMeta = (type?: string) => WORKOUT_TYPES.find((item) => item.value === type) || WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
export const mealMeta = (type?: string) => MEAL_TYPES.find((item) => item.value === type) || MEAL_TYPES[3];

export const num = (value: unknown) => Math.round(Number(value) || 0);
export const fmt = (value: unknown) => num(value).toLocaleString();
export const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
export const ratio = (value: unknown, target: unknown) => clamp01((Number(value) || 0) / (Number(target) || 1));
export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
export const errorMessage = (error: any, fallback: string) => error?.response?.data?.message || fallback;

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const shortDay = (isoDay: string) => {
  const date = new Date(`${isoDay}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDay : date.toLocaleDateString(undefined, { weekday: 'narrow' });
};

export const shortDate = (value: string | Date) => {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

type PageProps = {
  title: string;
  subtitle?: string;
  navigation?: any;
  right?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
  scrollRef?: React.RefObject<ScrollView | null>;
};

export const FitnessPage = ({ title, subtitle, navigation, right, children, refreshing, onRefresh, footer, scrollRef }: PageProps) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={[styles.page, { backgroundColor: colors.background.primary }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: 8, borderBottomColor: colors.border.primary, backgroundColor: colors.background.primary }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={10}
          onPress={() => navigation?.goBack()}
          style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Icon name="chevron-left" size={24} color={colors.text.primary} />
        </Pressable>
        <View style={styles.headerText}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <ScrollView
        ref={scrollRef as any}
        style={{ backgroundColor: colors.background.primary }}
        contentContainerStyle={[styles.content, { paddingBottom: 210 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
      >
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background.primary, borderTopColor: colors.border.primary }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
};

export const HeaderIconButton = ({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) => {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={10} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface.secondary, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={20} color={colors.text.primary} />
    </Pressable>
  );
};

export const Card = ({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) => {
  const { colors } = useTheme();
  const cardStyle = [styles.card, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }, style];
  if (!onPress) return <View style={cardStyle}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, { opacity: pressed ? 0.85 : 1 }]}>{children}</Pressable>;
};

export const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>{title}</Text>
      {action && onAction ? <Pressable hitSlop={8} onPress={onAction}><Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text></Pressable> : null}
    </View>
  );
};

export const Ring = ({ size = 120, stroke = 12, progress, color, children }: { size?: number; stroke?: number; progress: number; color: string; children?: React.ReactNode }) => {
  const { colors } = useTheme();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = clamp01(progress);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.border.primary} strokeWidth={stroke} fill="none" />
        {value > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - value)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
};

export const ProgressBar = ({ value, target, color, height = 8 }: { value?: number; target?: number; color?: string; height?: number }) => {
  const { colors } = useTheme();
  const progress = ratio(value, target);
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: colors.border.primary }]}>
      <View style={{ height: '100%', width: `${progress * 100}%`, borderRadius: height / 2, backgroundColor: color || colors.primary }} />
    </View>
  );
};

export const Chip = ({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: selected ? colors.primary : colors.surface.secondary, borderColor: selected ? colors.primary : colors.border.primary, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? '#001014' : colors.text.secondary} /> : null}
      <Text style={[styles.chipText, { color: selected ? '#001014' : colors.text.primary }]}>{label}</Text>
    </Pressable>
  );
};

export type Option = { label: string; value: string; icon?: IconName; hint?: string };

export const ChipGroup = ({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) => (
  <View style={styles.chipGroup}>
    {options.map((option) => <Chip key={option.value} label={option.label} icon={option.icon} selected={value === option.value} onPress={() => onChange(option.value)} />)}
  </View>
);

/** Large, descriptive choice cards for onboarding-style selections. */
export const OptionCards = ({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) => {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 10 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.optionCard,
              { backgroundColor: colors.surface.primary, borderColor: selected ? colors.primary : colors.border.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            {option.icon ? (
              <View style={[styles.optionIcon, { backgroundColor: selected ? colors.primary : colors.surface.secondary }]}>
                <Icon name={option.icon} size={22} color={selected ? '#001014' : colors.text.secondary} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, { color: colors.text.primary }]}>{option.label}</Text>
              {option.hint ? <Text style={[styles.optionHint, { color: colors.text.secondary }]}>{option.hint}</Text> : null}
            </View>
            <Icon name={selected ? 'check-circle' : 'circle-outline'} size={22} color={selected ? colors.primary : colors.text.tertiary} />
          </Pressable>
        );
      })}
    </View>
  );
};

export const Segmented = ({ options, value, onChange }: { options: Option[]; value: string; onChange: (value: string) => void }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: colors.surface.secondary, borderColor: colors.border.primary }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.segmentText, { color: selected ? '#001014' : colors.text.secondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

type ButtonProps = {
  label: string;
  onPress: () => void | Promise<void>;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loadingLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Button = ({ label, onPress, icon, variant = 'primary', loadingLabel, disabled, style }: ButtonProps) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const background = variant === 'primary' ? colors.primary : variant === 'danger' ? 'transparent' : variant === 'ghost' ? 'transparent' : colors.surface.secondary;
  const foreground = variant === 'primary' ? '#001014' : variant === 'danger' ? colors.status.error : variant === 'ghost' ? colors.primary : colors.text.primary;
  const border = variant === 'danger' ? colors.status.error : variant === 'ghost' ? 'transparent' : variant === 'primary' ? colors.primary : colors.border.primary;
  const handlePress = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try { await onPress(); } finally { setLoading(false); }
  };
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading || disabled}
      onPress={handlePress}
      style={({ pressed }) => [styles.button, { backgroundColor: background, borderColor: border, opacity: disabled ? 0.5 : pressed || loading ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={foreground} /> : icon ? <Icon name={icon} size={18} color={foreground} /> : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{loading && loadingLabel ? loadingLabel : label}</Text>
    </Pressable>
  );
};

type FieldProps = {
  label: string;
  value: string | number | undefined;
  onChangeText: (value: string) => void;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  placeholder?: string;
  suffix?: string;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const Field = ({ label, value, onChangeText, keyboardType = 'default', placeholder, suffix, multiline, style }: FieldProps) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, style]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: focused ? colors.primary : colors.border.primary, backgroundColor: colors.surface.primary }]}>
        <TextInput
          value={value === undefined || value === null ? '' : String(value)}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.tertiary}
          keyboardType={keyboardType}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && { minHeight: 72, textAlignVertical: 'top' }, { color: colors.text.primary }]}
        />
        {suffix ? <Text style={[styles.suffix, { color: colors.text.tertiary }]}>{suffix}</Text> : null}
      </View>
    </View>
  );
};

export const Stepper = ({ value, onChange, step = 1, min = 0, max = 9999, decimals = 0, suffix }: { value: number; onChange: (value: number) => void; step?: number; min?: number; max?: number; decimals?: number; suffix?: string }) => {
  const { colors } = useTheme();
  const factor = 10 ** decimals;
  const update = (delta: number) => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * factor) / factor)));
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityLabel="Decrease" onPress={() => update(-step)} style={[styles.stepButton, { backgroundColor: colors.surface.secondary, borderColor: colors.border.primary }]}>
        <Icon name="minus" size={22} color={colors.text.primary} />
      </Pressable>
      <View style={styles.stepValue}>
        <Text style={[styles.stepNumber, { color: colors.text.primary }]}>{value.toFixed(decimals)}</Text>
        {suffix ? <Text style={[styles.stepSuffix, { color: colors.text.secondary }]}>{suffix}</Text> : null}
      </View>
      <Pressable accessibilityLabel="Increase" onPress={() => update(step)} style={[styles.stepButton, { backgroundColor: colors.surface.secondary, borderColor: colors.border.primary }]}>
        <Icon name="plus" size={22} color={colors.text.primary} />
      </Pressable>
    </View>
  );
};

export const StatTile = ({ icon, label, value, unit, color, style }: { icon?: IconName; label: string; value: string; unit?: string; color?: string; style?: StyleProp<ViewStyle> }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }, style]}>
      {icon ? <Icon name={icon} size={18} color={color || colors.primary} /> : null}
      <Text style={[styles.statValue, { color: colors.text.primary }]}>
        {value}{unit ? <Text style={[styles.statUnit, { color: colors.text.secondary }]}> {unit}</Text> : null}
      </Text>
      <Text style={[styles.statLabel, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
};

export const EmptyState = ({ icon, title, message, action, onAction }: { icon: IconName; title: string; message?: string; action?: string; onAction?: () => void }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface.secondary }]}><Icon name={icon} size={28} color={colors.text.tertiary} /></View>
      <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>{title}</Text>
      {message ? <Text style={[styles.emptyMessage, { color: colors.text.secondary }]}>{message}</Text> : null}
      {action && onAction ? <Button label={action} onPress={onAction} variant="secondary" style={{ marginTop: 12, alignSelf: 'stretch' }} /> : null}
    </View>
  );
};

export const Muted = ({ children, style }: { children: React.ReactNode; style?: any }) => {
  const { colors } = useTheme();
  return <Text style={[styles.muted, { color: colors.text.secondary }, style]}>{children}</Text>;
};

type ChartPoint = { label: string; value: number; detail?: string };

const useWidth = () => {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return { width, onLayout };
};

/**
 * Single-series bar chart. Tapping a bar shows its exact value in the caption row
 * (the touch equivalent of a hover tooltip). An optional dashed target line.
 */
export const BarChart = ({ data, target, color, height = 140, unit = '', emptyLabel = 'No data yet' }: { data: ChartPoint[]; target?: number; color?: string; height?: number; unit?: string; emptyLabel?: string }) => {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(target || 0, ...data.map((item) => item.value), 1) * 1.1;
  const hasData = data.some((item) => item.value > 0);
  const barGap = data.length > 14 ? 2 : 6;
  const barWidth = width ? Math.max(2, (width - barGap * (data.length - 1)) / data.length) : 0;
  const active = selected !== null ? data[selected] : null;
  const labelEvery = Math.ceil(data.length / 7);
  return (
    <View>
      <Text style={[styles.chartCaption, { color: active ? colors.text.primary : colors.text.tertiary }]}>
        {active ? `${active.detail || active.label}: ${fmt(active.value)}${unit}` : hasData ? 'Tap a bar for details' : emptyLabel}
      </Text>
      <View onLayout={onLayout} style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: barGap }}>
        {width > 0 && target ? (
          <View pointerEvents="none" style={[styles.targetLine, { bottom: (target / max) * height, borderColor: colors.text.tertiary }]} />
        ) : null}
        {data.map((item, index) => {
          const barHeight = item.value > 0 ? Math.max(4, (item.value / max) * height) : 0;
          const isActive = selected === index;
          return (
            <Pressable
              key={`${item.label}-${index}`}
              accessibilityLabel={`${item.detail || item.label} ${fmt(item.value)}${unit}`}
              onPress={() => setSelected(isActive ? null : index)}
              style={{ width: barWidth, height, justifyContent: 'flex-end' }}
            >
              <View style={{ height: barHeight, borderTopLeftRadius: 4, borderTopRightRadius: 4, backgroundColor: color || colors.primary, opacity: selected === null || isActive ? 1 : 0.4 }} />
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.axis, { borderTopColor: colors.border.primary, gap: barGap }]}>
        {data.map((item, index) => (
          <Text key={`${item.label}-axis-${index}`} style={[styles.axisLabel, { width: barWidth, color: colors.text.tertiary }]} numberOfLines={1}>
            {index % labelEvery === 0 ? item.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
};

/** Single-series line chart with markers, an optional dashed target and tap-to-inspect. */
export const LineChart = ({ data, target, color, height = 160, unit = '', decimals = 1 }: { data: ChartPoint[]; target?: number; color?: string; height?: number; unit?: string; decimals?: number }) => {
  const { colors } = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const stroke = color || colors.primary;
  const values = data.map((item) => item.value);
  const all = target ? [...values, target] : values;
  const minValue = Math.min(...all);
  const maxValue = Math.max(...all);
  const pad = Math.max((maxValue - minValue) * 0.15, 0.5);
  const low = minValue - pad;
  const high = maxValue + pad;
  const inset = 8;
  const x = (index: number) => (data.length === 1 ? width / 2 : inset + (index / (data.length - 1)) * (width - inset * 2));
  const y = (value: number) => inset + (1 - (value - low) / (high - low)) * (height - inset * 2);
  const active = selected !== null ? data[selected] : data[data.length - 1];
  const handleTouch = (locationX: number) => {
    if (!width || !data.length) return;
    const index = data.length === 1 ? 0 : Math.round(((locationX - inset) / (width - inset * 2)) * (data.length - 1));
    setSelected(Math.min(data.length - 1, Math.max(0, index)));
  };
  return (
    <View>
      <Text style={[styles.chartCaption, { color: colors.text.primary }]}>
        {active ? `${active.detail || active.label}: ${active.value.toFixed(decimals)}${unit}` : ''}
      </Text>
      <View
        onLayout={onLayout}
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(event) => handleTouch(event.nativeEvent.locationX)}
        onResponderMove={(event) => handleTouch(event.nativeEvent.locationX)}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <Line key={fraction} x1={0} x2={width} y1={height * fraction} y2={height * fraction} stroke={colors.border.primary} strokeWidth={1} />
            ))}
            {target ? <Line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke={colors.text.tertiary} strokeWidth={1.5} strokeDasharray="5 5" /> : null}
            {selected !== null ? <Line x1={x(selected)} x2={x(selected)} y1={0} y2={height} stroke={colors.text.tertiary} strokeWidth={1} /> : null}
            {data.length > 1 ? (
              <Polyline points={data.map((item, index) => `${x(index)},${y(item.value)}`).join(' ')} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null}
            {data.map((item, index) => (
              <Circle key={index} cx={x(index)} cy={y(item.value)} r={selected === index || data.length <= 12 ? 4 : 0} fill={stroke} stroke={colors.surface.primary} strokeWidth={2} />
            ))}
          </Svg>
        ) : null}
      </View>
      {data.length ? (
        <View style={styles.lineAxis}>
          <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{data[0].label}</Text>
          {target ? <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>- - target {target}{unit}</Text> : null}
          <Text style={[styles.axisLabel, { color: colors.text.tertiary }]}>{data[data.length - 1].label}</Text>
        </View>
      ) : null}
    </View>
  );
};

export const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 1 },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16 },
  footer: { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  sectionAction: { fontSize: 14, fontWeight: '700' },
  track: { overflow: 'hidden', width: '100%' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { fontSize: 14, fontWeight: '600' },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 16, padding: 14 },
  optionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '700' },
  optionHint: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3, marginBottom: 14 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segmentText: { fontSize: 14, fontWeight: '700' },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, marginTop: 8 },
  buttonText: { fontSize: 15, fontWeight: '700' },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, paddingVertical: 12, fontSize: 16 },
  suffix: { fontSize: 14, marginLeft: 6 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  stepNumber: { fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] },
  stepSuffix: { fontSize: 18, fontWeight: '600' },
  statTile: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 12, gap: 4 },
  statValue: { fontSize: 18, fontWeight: '800', fontVariant: ['tabular-nums'] },
  statUnit: { fontSize: 12, fontWeight: '600' },
  statLabel: { fontSize: 12 },
  empty: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  muted: { fontSize: 14, lineHeight: 20 },
  chartCaption: { fontSize: 13, fontWeight: '600', marginBottom: 8, fontVariant: ['tabular-nums'] },
  targetLine: { position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5, borderStyle: 'dashed' },
  axis: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 6 },
  axisLabel: { fontSize: 11, textAlign: 'center' },
  lineAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
