import React, { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, ViewStyle, TextInputProps } from 'react-native';
import api from '../lib/api';
import VoiceTextInput from './VoiceTextInput';

type Profile = {
  _id: string;
  fullName?: string;
  displayName?: string;
  username?: string;
  profilePic?: string;
};

type Props = TextInputProps & {
  myProfileId?: string;
  wrapperStyle?: ViewStyle;
  voiceEnabled?: boolean;
};

const getName = (profile: Profile) =>
  profile.fullName || profile.displayName || profile.username || 'User';

const getMentionQuery = (value: string) => {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/);
  return match ? match[1] : null;
};

const MentionTextInput = forwardRef<TextInput, Props>(({
  value = '',
  onChangeText,
  myProfileId,
  wrapperStyle,
  voiceEnabled = true,
  ...props
}, ref) => {
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
        if (!cancelled) setConnects(Array.isArray(response.data) ? response.data : []);
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
      `${getName(profile)} ${profile.username || ''}`.toLowerCase().includes(normalized),
    ).slice(0, 8);
  }, [activeQuery, connects]);

  const selectProfile = (profile: Profile) => {
    const text = String(value);
    const start = text.search(/(?:^|\s)@[^\s@]*$/);
    if (start < 0) return;
    const mentionStart = start + (text[start] === ' ' ? 1 : 0);
    const name = getName(profile).replace(/\s+/g, '');
    onChangeText?.(`${text.slice(0, mentionStart)}@${name} ${text.slice(text.length)}`);
    setActiveQuery(null);
    inputRef.current?.focus();
  };

  return (
    <View style={[{ flex: 1, minWidth: 0, position: 'relative', zIndex: 20 }, wrapperStyle]}>
      <VoiceTextInput
        ref={(node) => {
          inputRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        {...props}
        value={value}
        voiceEnabled={voiceEnabled}
        onChangeText={text => {
          setActiveQuery(getMentionQuery(text));
          onChangeText?.(text);
        }}
      />
      {activeQuery !== null && matches.length > 0 ? (
        <View style={styles.suggestions}>
          {matches.map(profile => (
            <TouchableOpacity
              key={profile._id}
              onPress={() => selectProfile(profile)}
              style={styles.suggestion}
              accessibilityRole="button"
              accessibilityLabel={`Mention ${getName(profile)}`}
            >
              <Text style={styles.name}>{getName(profile)}</Text>
              {profile.username ? <Text style={styles.username}>@{profile.username}</Text> : null}
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
    bottom: 44,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden' as const,
  },
  suggestion: { paddingHorizontal: 12, paddingVertical: 10 },
  name: { color: '#111827', fontSize: 14, fontWeight: '600' as const },
  username: { color: '#6b7280', fontSize: 12, marginTop: 2 },
};

MentionTextInput.displayName = 'MentionTextInput';
export default MentionTextInput;
