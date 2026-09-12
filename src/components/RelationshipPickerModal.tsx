import React, { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, StyleSheet } from 'react-native';

const OPTIONS = ['Friend', 'Family', 'Colleague', 'Classmate', 'Business', 'Other'];

export default function RelationshipPickerModal({ visible, onCancel, onSubmit, colors, loading }: any) {
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState('');
  const toggle = (value: string) => setSelected(current => current.includes(value)
    ? current.filter(item => item !== value) : [...current, value]);
  const submit = () => {
    const values = selected.filter(item => item !== 'Other');
    if (selected.includes('Other') && other.trim()) values.push(other.trim());
    if (values.length) onSubmit([...new Set(values)]);
  };
  return <Modal visible={visible} transparent animationType="fade">
    <View style={styles.backdrop}><View style={[styles.card, { backgroundColor: colors.surface.primary }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Select relationship</Text>
      <Text style={{ color: colors.text.secondary, marginBottom: 16 }}>Choose one or more relationships.</Text>
      <View style={styles.options}>{OPTIONS.map(option => <Pressable key={option} style={styles.option} onPress={() => toggle(option)}>
        <View style={[styles.checkbox, selected.includes(option) && { backgroundColor: colors.primary }]} />
        <Text style={{ color: colors.text.primary }}>{option}</Text>
      </Pressable>)}</View>
      {selected.includes('Other') && <TextInput value={other} onChangeText={setOther} placeholder="Type relationship" maxLength={80}
        placeholderTextColor={colors.text.secondary} style={[styles.input, { color: colors.text.primary, borderColor: colors.border.secondary }]} />}
      <View style={styles.actions}><Pressable onPress={onCancel}><Text style={{ color: colors.text.secondary }}>Cancel</Text></Pressable>
        <Pressable onPress={submit} disabled={loading || !selected.length || (selected.includes('Other') && !other.trim())}><Text style={{ color: colors.primary, fontWeight: '700' }}>{loading ? 'Saving...' : 'Continue'}</Text></Pressable></View>
    </View></View>
  </Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }, card: { borderRadius: 16, padding: 22 }, title: { fontSize: 20, fontWeight: '700', marginBottom: 5 }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, option: { width: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }, checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: '#999' }, input: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 12 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 22 } });
