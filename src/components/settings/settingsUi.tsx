import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';

export const SettingsSectionHeader = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      {description ? (
        <Text style={[styles.description, { color: colors.text.secondary }]}>
          {description}
        </Text>
      ) : null}
    </View>
  );
};

export const SettingsField = ({
  label,
  help,
  children,
}: {
  label?: string;
  help?: string;
  children: React.ReactNode;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      {label ? (
        <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
      ) : null}
      {children}
      {help ? (
        <Text style={[styles.help, { color: colors.text.secondary }]}>{help}</Text>
      ) : null}
    </View>
  );
};

export const SettingsInput = ({
  value,
  onChangeText,
  placeholder,
  icon,
  prefix,
  secureTextEntry,
  editable = true,
  keyboardType = 'default',
  autoCapitalize,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon?: string;
  prefix?: string;
  secureTextEntry?: boolean;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.inputRow,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.primary,
          opacity: editable ? 1 : 0.7,
        },
      ]}
    >
      {prefix ? (
        <Text style={[styles.prefix, { color: colors.text.secondary }]}>{prefix}</Text>
      ) : icon ? (
        <Icon name={icon} size={18} color={colors.gray[400]} style={styles.inputIcon} />
      ) : null}
      <TextInput
        style={[styles.input, { color: colors.text.primary }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.gray[400]}
        secureTextEntry={secureTextEntry}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
};

export const SettingsPicker = ({
  value,
  onValueChange,
  options,
  variant = 'dropdown',
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  variant?: 'dropdown' | 'list';
}) => {
  const { colors } = useTheme();
  const [open, setOpen] = useState(variant === 'list');
  const selected = options.find((option) => option.value === value);

  const renderOptions = () =>
    options.map((option) => {
      const isSelected = option.value === value;
      return (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.pickerOption,
            {
              backgroundColor: isSelected ? colors.primary + '1F' : 'transparent',
              borderColor: isSelected ? colors.primary : colors.border.primary,
            },
          ]}
          onPress={() => {
            onValueChange(option.value);
            if (variant !== 'list') setOpen(false);
          }}
        >
          <Text style={[styles.pickerOptionLabel, { color: colors.text.primary }]}>
            {option.label}
          </Text>
          {isSelected ? (
            <Icon name="check" size={18} color={colors.primary} />
          ) : null}
        </TouchableOpacity>
      );
    });

  if (variant === 'list') {
    return <View style={styles.pickerList}>{renderOptions()}</View>;
  }

  return (
    <View
      style={[
        styles.pickerWrap,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.primary,
        },
      ]}
    >
      <TouchableOpacity style={styles.pickerHeader} onPress={() => setOpen((prev) => !prev)}>
        <Text style={[styles.pickerValue, { color: colors.text.primary }]}>
          {selected?.label || 'Select'}
        </Text>
        <Icon
          name={open ? 'expand-less' : 'expand-more'}
          size={22}
          color={colors.text.secondary}
        />
      </TouchableOpacity>
      {open ? <View style={styles.pickerList}>{renderOptions()}</View> : null}
    </View>
  );
};

export const SettingsSwitchRow = ({
  label,
  help,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  help?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.switchRow,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.primary,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.switchCopy}>
        <Text style={[styles.switchLabel, { color: colors.text.primary }]}>{label}</Text>
        {help ? (
          <Text style={[styles.help, { color: colors.text.secondary, marginTop: 4 }]}>
            {help}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.gray[300], true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : colors.gray[400]}
      />
    </View>
  );
};

export const SettingsPrimaryButton = ({
  title,
  onPress,
  loading,
  disabled,
  loadingTitle,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  loadingTitle?: string;
}) => {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.primaryButton,
        { backgroundColor: colors.primary, opacity: isDisabled ? 0.6 : 1 },
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text.inverse} style={{ marginRight: 8 }} />
      ) : null}
      <Text style={[styles.buttonText, { color: colors.text.inverse }]}>
        {loading ? loadingTitle || 'Saving…' : title}
      </Text>
    </TouchableOpacity>
  );
};

export const SettingsDangerButton = ({
  title,
  onPress,
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.dangerButton,
        { backgroundColor: colors.status.error, opacity: isDisabled ? 0.6 : 1 },
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text.inverse} style={{ marginRight: 8 }} />
      ) : null}
      <Text style={[styles.buttonText, { color: colors.text.inverse }]}>{title}</Text>
    </TouchableOpacity>
  );
};

export const SettingsSecondaryButton = ({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[
        styles.secondaryButton,
        {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.primary,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.secondaryButtonText, { color: colors.text.primary }]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  help: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  prefix: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  pickerWrap: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pickerHeader: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerValue: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    marginRight: 8,
  },
  pickerList: {
    paddingBottom: 4,
  },
  pickerOption: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerOptionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    marginRight: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  switchCopy: {
    flex: 1,
    minWidth: 0,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 8,
  },
  dangerButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 12,
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
