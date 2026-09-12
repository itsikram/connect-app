import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import useComposerLiveTranscribe, {
  mergeTranscriptText,
} from '../hooks/useComposerLiveTranscribe';

type VoiceTextInputProps = TextInputProps & {
  voiceEnabled?: boolean;
  wrapperStyle?: ViewStyle;
  rightAccessory?: React.ReactNode;
};

const VoiceTextInput = forwardRef<TextInput, VoiceTextInputProps>(
  (
    {
      onChangeText,
      value,
      voiceEnabled = true,
      wrapperStyle,
      rightAccessory,
      ...props
    },
    ref,
  ) => {
    const { colors } = useTheme();
    const { settings } = useSettings();
    const [language, setLanguage] = useState<'bn-BD' | 'en-US'>(
      settings.language === 'bn' ? 'bn-BD' : 'en-US',
    );
    const baseTextRef = useRef(String(value || ''));
    const transcriptUpdateRef = useRef(false);

    const applyText = useCallback(
      (text: string) => {
        baseTextRef.current = text;
        onChangeText?.(text);
      },
      [onChangeText],
    );

    const transcribe = useComposerLiveTranscribe({
      onFinal: text => {
        const next = mergeTranscriptText(baseTextRef.current, text);
        transcriptUpdateRef.current = true;
        applyText(next);
      },
      onInterim: text => {
        const next = mergeTranscriptText(baseTextRef.current, text);
        transcriptUpdateRef.current = true;
        onChangeText?.(next);
      },
    });

    useEffect(() => {
      setLanguage(settings.language === 'bn' ? 'bn-BD' : 'en-US');
    }, [settings.language]);

    useEffect(() => {
      if (transcriptUpdateRef.current) {
        transcriptUpdateRef.current = false;
        return;
      }
      baseTextRef.current = String(value || '');
    }, [value, transcribe.listening]);

    const start = async (nextLanguage: 'bn-BD' | 'en-US') => {
      setLanguage(nextLanguage);
      const started = await transcribe.start(nextLanguage);
      if (!started) {
        Alert.alert(
          'Microphone unavailable',
          'Allow microphone access and try again.',
        );
      }
    };

    const toggleVoice = () => {
      if (transcribe.listening) {
        transcribe.stop();
      } else {
        // Start capture directly; language selection must not delay microphone activation.
        void start(language);
      }
    };

    if (!voiceEnabled) {
      return (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          {...props}
        />
      );
    }

    return (
      <View
        style={[{ flex: 1, minWidth: 0, position: 'relative' }, wrapperStyle]}
      >
        <TextInput
          ref={ref}
          value={value}
          onChangeText={text => {
            transcriptUpdateRef.current = false;
            baseTextRef.current = text;
            onChangeText?.(text);
          }}
          {...props}
          style={[
            { flex: 1, paddingRight: rightAccessory ? 82 : 42 },
            props.style,
          ]}
        />
        <TouchableOpacity
          onPress={toggleVoice}
          accessibilityRole="button"
          accessibilityLabel={
            transcribe.listening
              ? 'Stop voice input'
              : `Start ${
                  language.startsWith('bn') ? 'Bangla' : 'English'
                } voice input`
          }
          style={{
            position: 'absolute',
            right: rightAccessory ? 38 : 2,
            top: 0,
            bottom: 0,
            paddingHorizontal: 8,
            justifyContent: 'center',
          }}
        >
          <Icon
            name={transcribe.listening ? 'stop' : 'mic'}
            size={20}
            color={transcribe.listening ? colors.status.error : colors.primary}
          />
        </TouchableOpacity>
        {rightAccessory ? (
          <View
            style={{
              position: 'absolute',
              right: 2,
              top: 0,
              bottom: 0,
              justifyContent: 'center',
            }}
          >
            {rightAccessory}
          </View>
        ) : null}
      </View>
    );
  },
);

VoiceTextInput.displayName = 'VoiceTextInput';

export default VoiceTextInput;
