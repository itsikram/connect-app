import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, ViewStyle, TextInputProps } from 'react-native';
import api from '../lib/api';
import { useTheme } from '../contexts/ThemeContext';
import VoiceTextInput from './VoiceTextInput';

type Profile = {
  _id?: string;
  fullName?: string;
  displayName?: string;
  username?: string;
  profilePic?: string;
};

type Props = TextInputProps & {
  myProfileId?: string;
  wrapperStyle?: ViewStyle;
  voiceEnabled?: boolean;
  rightAccessory?: React.ReactNode;
};

const getName = (profile?: Profile | null) =>
  profile?.fullName || profile?.displayName || profile?.username || 'User';

const getMentionQuery = (value: string) => {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
};

const mentionTokenPattern = /@\[([^\]]+)\]\(([a-f\d]{24})\)/gi;

const toDisplayValue = (value: string) =>
  String(value || '').replace(mentionTokenPattern, '@$1');

const toStoredValue = (value: string, sourceValue: string) => {
  const sourceTokens: Array<{ name: string; id: string }> = [];
  let sourceMatch: RegExpExecArray | null;
  while ((sourceMatch = mentionTokenPattern.exec(String(sourceValue || '')))) {
    sourceTokens.push({ name: sourceMatch[1].trim(), id: sourceMatch[2] });
  }
  mentionTokenPattern.lastIndex = 0;
  let storedValue = String(value || '');
  sourceTokens.forEach(({ name, id }) => {
    storedValue = storedValue.replace(`@${name}`, `@[${name}](${id})`);
  });
  return storedValue;
};

const MentionTextInput = forwardRef<TextInput, Props>(({
  value = '',
  onChangeText,
  myProfileId,
  wrapperStyle,
  voiceEnabled = true,
  rightAccessory,
  ...props
}, ref) => {
  const { colors, isDarkMode } = useTheme();
  const [connects, setConnects] = useState<Profile[]>([]);
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const query = getMentionQuery(String(value));
  const mentionActive = query !== null;

  useEffect(() => {
    if (!myProfileId || query === null) return;
    let cancelled = false;
    api.get('/connects/getConnects', { params: { profile: myProfileId } })
      .then(response => {
        if (!cancelled) {
          const profiles = Array.isArray(response.data)
            ? response.data.filter((profile): profile is Profile => Boolean(profile?._id))
            : [];
          setConnects(profiles);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setConnects([]);
          console.error('Unable to load profile connects for mentions:', error);
        }
      });
    return () => { cancelled = true; };
  }, [myProfileId, mentionActive]);

  useEffect(() => setActiveQuery(query), [query]);

  const matches = useMemo(() => {
    const normalized = String(activeQuery || '').toLowerCase();
    return connects.filter(profile =>
      !normalized ||
      `${getName(profile)} ${profile?.username || ''}`.toLowerCase().includes(normalized),
    ).slice(0, 8);
  }, [activeQuery, connects]);

  const selectProfile = (profile?: Profile | null) => {
    if (!profile?._id) return;
    const text = toDisplayValue(String(value));
    const start = text.search(/(?:^|\s)@[^\s@]*$/);
    if (start < 0) return;
    const mentionStart = start + (text[start] === ' ' ? 1 : 0);
    const name = getName(profile).trim();
    const nextDisplayValue = `${text.slice(0, mentionStart)}@${name} ${text.slice(text.length)}`;
    const nextValue = toStoredValue(nextDisplayValue, String(value))
      .replace(`@${name}`, `@[${name}](${profile._id})`);
    if (typeof onChangeText === 'function') onChangeText(nextValue);
    setActiveQuery(null);
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.inputWrapper, wrapperStyle]}>
      <VoiceTextInput
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        {...props}
        value={toDisplayValue(String(value))}
        voiceEnabled={voiceEnabled}
        rightAccessory={rightAccessory}
        onChangeText={text => {
          setActiveQuery(getMentionQuery(text));
          onChangeText?.(toStoredValue(text, String(value)));
        }}
      />
      {activeQuery !== null && matches.length > 0 ? (
        <View style={[styles.suggestions, {
          backgroundColor: colors.surface.elevated || colors.surface.primary,
          borderColor: colors.border.primary,
          shadowColor: isDarkMode ? '#000' : '#334155',
        }]}>
          {matches.map(profile => (
            <TouchableOpacity
              key={profile._id}
              onPress={() => selectProfile(profile)}
              style={[styles.suggestion, { backgroundColor: colors.surface.elevated || colors.surface.primary }]}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${getName(profile)}`}
            >
              <Text style={[styles.name, { color: colors.text.primary }]}>{getName(profile)}</Text>
              {profile.username ? <Text style={[styles.username, { color: colors.text.secondary }]}>@{profile.username}</Text> : null}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
});

const styles = {
  suggestions: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: '100%' as const,
    marginTop: 6,
    maxHeight: 240,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden' as const,
    zIndex: 30,
  },
  inputWrapper: {
    flex: 1,
    minWidth: 0,
    position: 'relative' as const,
    zIndex: 1000,
    elevation: 1000,
    overflow: 'visible' as const,
  },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.18)',
  },
  name: { color: '#111827', fontSize: 14, fontWeight: '600' as const },
  username: { color: '#6b7280', fontSize: 12, marginTop: 2 },
};

MentionTextInput.displayName = 'MentionTextInput';
export default MentionTextInput;
