import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { AUDIENCE_OPTIONS } from '../../constants/audience';

type EditAudienceModalProps = {
  visible: boolean;
  selected: number;
  saving?: boolean;
  onSelect: (value: number) => void;
  onClose: () => void;
  onSave: () => void;
};

const EditAudienceModal: React.FC<EditAudienceModalProps> = ({
  visible,
  selected,
  saving = false,
  onSelect,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={saving ? undefined : onClose}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          style={[styles.sheet, { backgroundColor: colors.surface.primary, borderColor: colors.border.primary }]}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.border.primary }]} />
          </View>
          <Text style={[styles.title, { color: colors.text.primary }]}>Edit Audience</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>Who can see this post?</Text>

          {AUDIENCE_OPTIONS.map((option) => {
            const active = selected === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  {
                    borderColor: active ? colors.primary : colors.border.primary,
                    backgroundColor: active ? colors.primary + '14' : 'transparent',
                  },
                ]}
                onPress={() => onSelect(option.value)}
                disabled={saving}
              >
                <View style={[styles.optionIcon, { backgroundColor: colors.primary + '15' }]}>
                  <Icon name={option.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.optionCopy}>
                  <Text style={[styles.optionTitle, { color: colors.text.primary }]}>{option.label}</Text>
                  <Text style={[styles.optionDesc, { color: colors.text.secondary }]}>{option.desc}</Text>
                </View>
                {active ? <Icon name="check-circle" size={22} color={colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: colors.border.primary }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.buttonText, { color: colors.text.primary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={onSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text.inverse} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.text.inverse }]}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  handleWrap: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionCopy: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 13,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {},
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditAudienceModal;
