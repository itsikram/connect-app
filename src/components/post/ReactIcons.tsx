import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';

export const REACT_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactType = (typeof REACT_TYPES)[number];

export const REACT_LABELS: Record<string, string> = {
  like: 'Like',
  love: 'Love',
  haha: 'Haha',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
};

export const getReactLabel = (type?: string | false | null) =>
  (type && REACT_LABELS[type]) || 'Like';

export const uniquePlacedReacts = (reacts: any[] = []) =>
  REACT_TYPES.filter((key) => reacts.some((react) => react?.type === key));

type IconProps = { size?: number };

export const LikeReactIcon = ({ size = 28 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Circle cx="8" cy="8" r="8" fill="#0B84FF" />
    <Path
      fill="#FFFFFF"
      d="M12.162 7.338c.176.123.338.245.338.674 0 .43-.229.604-.474.725a.73.73 0 01.089.546c-.077.344-.392.611-.672.69.121.194.159.385.015.62-.185.295-.346.407-1.058.407H7.5c-.988 0-1.5-.546-1.5-1V7.665c0-1.23 1.467-2.275 1.467-3.13L7.361 3.47c-.005-.065.008-.224.058-.27.08-.079.301-.2.635-.2.218 0 .363.041.534.123.581.277.732.978.732 1.542 0 .271-.414 1.083-.47 1.364 0 0 .867-.192 1.879-.199 1.061-.006 1.749.19 1.749.842 0 .261-.219.523-.316.666zM3.6 7h.8a.6.6 0 01.6.6v3.8a.6.6 0 01-.6.6h-.8a.6.6 0 01-.6-.6V7.6a.6.6 0 01.6-.6z"
    />
  </Svg>
);

export const LoveReactIcon = ({ size = 28 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Circle cx="8" cy="8" r="8" fill="#FF3B5C" />
    <Path
      fill="#FFFFFF"
      d="M10.473 4C8.275 4 8 5.824 8 5.824S7.726 4 5.528 4c-2.114 0-2.73 2.222-2.472 3.41C3.736 10.55 8 12.75 8 12.75s4.265-2.2 4.945-5.34c.257-1.188-.36-3.41-2.472-3.41"
    />
  </Svg>
);

export const HahaReactIcon = ({ size = 28 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Circle cx="8" cy="8" r="8" fill="#F5C84B" />
    <Path fill="#6A3318" d="M3 8.008C3 10.023 4.006 14 8 14c3.993 0 5-3.977 5-5.992C13 7.849 11.39 7 8 7c-3.39 0-5 .849-5 1.008" />
    <Path fill="#E84D6A" d="M4.541 12.5c.804.995 1.907 1.5 3.469 1.5 1.563 0 2.655-.505 3.459-1.5-.551-.588-1.599-1.5-3.459-1.5s-2.917.912-3.469 1.5" />
    <Path
      fill="#2A3755"
      d="M6.213 4.144c.263.188.502.455.41.788-.071.254-.194.369-.422.371-.78.011-1.708.255-2.506.612-.065.029-.197.088-.332.085-.124-.003-.251-.058-.327-.237-.067-.157-.073-.388.276-.598.545-.33 1.257-.48 1.909-.604a7.077 7.077 0 00-1.315-.768c-.427-.194-.38-.457-.323-.6.127-.317.609-.196 1.078.026a9 9 0 011.552.925zm3.577 0a8.953 8.953 0 011.55-.925c.47-.222.95-.343 1.078-.026.057.143.104.406-.323.6a7.029 7.029 0 00-1.313.768c.65.123 1.363.274 1.907.604.349.21.342.44.276.598-.077.18-.203.234-.327.237-.135.003-.267-.056-.332-.085-.797-.357-1.725-.6-2.504-.612-.228-.002-.351-.117-.422-.37-.091-.333.147-.6.41-.788z"
    />
  </Svg>
);

export const WowReactIcon = ({ size = 28 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Circle cx="8" cy="8" r="8" fill="#F7B64A" />
    <Path
      fill="#2A3755"
      d="M2.8 4.4c.9-.8 2.2-1.1 3.3-.6.2.1.3.4.1.6-.1.2-.4.3-.6.1-.8-.4-1.7-.2-2.4.4-.2.2-.5.1-.6-.1-.1-.2 0-.5.2-.6zm7.1-.6c1.1-.5 2.4-.2 3.3.6.2.2.3.4.2.6-.1.2-.4.3-.6.1-.7-.6-1.6-.8-2.4-.4-.2.1-.5 0-.6-.1-.2-.2-.1-.5.1-.6z"
    />
    <Ellipse cx="5.1" cy="7.1" rx="1.7" ry="2.05" fill="#fff" />
    <Ellipse cx="10.9" cy="7.1" rx="1.7" ry="2.05" fill="#fff" />
    <Circle cx="5.1" cy="7.45" r="0.75" fill="#2A3755" />
    <Circle cx="10.9" cy="7.45" r="0.75" fill="#2A3755" />
    <Ellipse cx="8" cy="12.15" rx="1.55" ry="1.85" fill="#6A3318" />
  </Svg>
);

export const SadReactIcon = ({ size = 28 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Circle cx="8" cy="8" r="8" fill="#F7B64A" />
    <Circle cx="5.2" cy="6.5" r="1.05" fill="#2A3755" />
    <Circle cx="10.8" cy="6.5" r="1.05" fill="#2A3755" />
    <Path
      fill="none"
      stroke="#6A3318"
      strokeWidth="1.15"
      strokeLinecap="round"
      d="M5.2 11.7c.8-1.15 1.8-1.7 2.8-1.7s2 .55 2.8 1.7"
    />
    <Path fill="#54C7EC" d="M4.15 8.55s.95 1.7.95 2.4c0 .65-.42 1.15-.95 1.15s-.95-.5-.95-1.15c0-.7.95-2.4.95-2.4z" />
  </Svg>
);

export const AngryReactIcon = ({ size = 28 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16">
    <Circle cx="8" cy="8" r="8" fill="#E86A1F" />
    <Path
      fill="#2A3755"
      d="M2.35 4.15l5.05 2.15c.28.12.4.46.22.7-.17.24-.5.32-.78.2L2.05 5.2c-.28-.12-.4-.46-.22-.7.18-.24.5-.47.52-.35zm11.3 0c.28.12.16.46-.12.7l-4.8 2c-.28.12-.6.04-.77-.2-.18-.24-.06-.58.22-.7l5.05-2.15c.28-.12.6.05.42.35z"
    />
    <Circle cx="5.1" cy="7.7" r="1.05" fill="#2A3755" />
    <Circle cx="10.9" cy="7.7" r="1.05" fill="#2A3755" />
    <Path
      fill="#2A3755"
      d="M4.55 11.25c.95.95 2 1.45 3.45 1.45s2.5-.5 3.45-1.45c-.65-.5-1.75-1.15-3.45-1.15s-2.8.65-3.45 1.15z"
    />
  </Svg>
);

const ICON_MAP: Record<string, React.FC<IconProps>> = {
  like: LikeReactIcon,
  love: LoveReactIcon,
  haha: HahaReactIcon,
  wow: WowReactIcon,
  sad: SadReactIcon,
  angry: AngryReactIcon,
};

export const ReactIcon = ({ type, size = 28 }: { type?: string | false | null; size?: number }) => {
  const Comp = ICON_MAP[type || 'like'] || LikeReactIcon;
  return <Comp size={size} />;
};

export const CurrentReactIcon = ({ reactType, size = 18 }: { reactType?: string | false | null; size?: number }) => (
  <ReactIcon type={reactType || 'like'} size={size} />
);

export const PlacedReactIcons = ({ placedReacts = [] }: { placedReacts?: string[] }) => (
  <View style={styles.placedRow}>
    {REACT_TYPES.filter((key) => placedReacts.includes(key)).map((key) => (
      <View key={key} style={styles.placedIcon}>
        <ReactIcon type={key} size={20} />
      </View>
    ))}
  </View>
);

export const ReactPicker = ({
  reactType,
  onSelect,
  backgroundColor,
  borderColor,
}: {
  reactType?: string | false | null;
  onSelect: (type: string) => void;
  backgroundColor: string;
  borderColor: string;
}) => (
  <View style={[styles.picker, { backgroundColor, borderColor }]}>
    {REACT_TYPES.map((key) => (
      <TouchableOpacity
        key={key}
        onPress={() => onSelect(key)}
        style={[styles.pickerCell, reactType === key && styles.pickerCellActive]}
        activeOpacity={0.75}
        accessibilityLabel={REACT_LABELS[key]}
      >
        <ReactIcon type={key} size={28} />
      </TouchableOpacity>
    ))}
  </View>
);

const styles = StyleSheet.create({
  placedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  placedIcon: {
    width: 20,
    height: 30,
    marginRight: -3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  pickerCell: {
    width: 34,
    height: 34,
    padding: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerCellActive: {
    backgroundColor: 'rgba(11, 132, 255, 0.12)',
  },
});
