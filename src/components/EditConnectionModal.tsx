import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

const RELATIONSHIP_OPTIONS = [
    'Friend', 'Best Friend', 'Family', 'Parent', 'Child', 'Sibling', 'Relative',
    'Partner', 'Spouse', 'Fiance', 'Dating', 'Ex-Partner', 'Neighbor',
    'Colleague', 'Manager', 'Mentor', 'Mentee', 'Classmate', 'Teacher', 'Student',
    'Business Partner', 'Client', 'Customer', 'Professional Contact',
    'Teammate', 'Club Member', 'Community Member', 'Roommate', 'Healthcare Provider',
    'Caregiver', 'Emergency Contact', 'Other',
];

type ThemeColors = {
    primary: string;
    surface: { primary: string; secondary: string };
    border: { secondary: string };
    text: { primary: string; secondary: string; inverse: string };
};

type EditConnectionModalProps = {
    visible: boolean;
    initialRelationshipTypes: string[];
    colors: ThemeColors;
    loading?: boolean;
    onCancel: () => void;
    onSave: (relationshipTypes: string[]) => void;
};

export default function EditConnectionModal({
    visible,
    initialRelationshipTypes,
    colors,
    loading = false,
    onCancel,
    onSave,
}: EditConnectionModalProps) {
    const [selected, setSelected] = React.useState<string[]>(initialRelationshipTypes);

    React.useEffect(() => {
        if (visible) setSelected(initialRelationshipTypes);
    }, [visible, initialRelationshipTypes]);

    const toggle = (value: string) => {
        setSelected(current => current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value]);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: colors.surface.primary }]}>
                    <View style={styles.header}>
                        <View style={styles.headerCopy}>
                            <Text style={[styles.title, { color: colors.text.primary }]}>Edit connection</Text>
                            <Text style={[styles.description, { color: colors.text.secondary }]}>
                                Update how this connection is categorized.
                            </Text>
                        </View>
                        <Pressable onPress={onCancel} hitSlop={10} accessibilityLabel="Close edit connection">
                            <Text style={[styles.close, { color: colors.text.secondary }]}>X</Text>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Relationship type</Text>
                        <Text style={[styles.sectionDescription, { color: colors.text.secondary }]}>
                            Choose one or more relationship types.
                        </Text>
                        <View style={styles.options}>
                            {RELATIONSHIP_OPTIONS.map(option => (
                                <Pressable
                                    key={option}
                                    style={styles.option}
                                    onPress={() => toggle(option)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: selected.includes(option) }}
                                >
                                    <View style={[
                                        styles.checkbox,
                                        { borderColor: colors.border.secondary },
                                        selected.includes(option) && { backgroundColor: colors.primary, borderColor: colors.primary },
                                    ]}>
                                        {selected.includes(option) && <Text style={styles.checkmark}>x</Text>}
                                    </View>
                                    <Text style={[styles.optionText, { color: colors.text.primary }]}>{option}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <View style={[styles.futureSetting, { borderColor: colors.border.secondary }]}>
                            <Text style={[styles.futureSettingTitle, { color: colors.text.primary }]}>Connection settings</Text>
                            <Text style={[styles.futureSettingText, { color: colors.text.secondary }]}>
                                Share expression, share typing, and live transcription settings will be available here.
                            </Text>
                        </View>
                    </ScrollView>

                    <View style={[styles.actions, { borderTopColor: colors.border.secondary }]}>
                        <Pressable onPress={onCancel} disabled={loading} style={styles.cancelButton}>
                            <Text style={{ color: colors.text.secondary }}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => onSave([...new Set(selected.filter(Boolean))])}
                            disabled={loading || selected.length === 0}
                            style={[styles.saveButton, { backgroundColor: colors.primary }, (loading || selected.length === 0) && styles.disabledButton]}
                        >
                            {loading
                                ? <ActivityIndicator size="small" color={colors.text.inverse} />
                                : <Text style={[styles.saveText, { color: colors.text.inverse }]}>Save changes</Text>}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 },
    card: { borderRadius: 16, maxHeight: '90%', overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'flex-start', padding: 22, paddingBottom: 12 },
    headerCopy: { flex: 1 },
    title: { fontSize: 20, fontWeight: '700' },
    description: { marginTop: 5, lineHeight: 19 },
    close: { fontSize: 28, lineHeight: 24, marginLeft: 12 },
    scroll: { paddingHorizontal: 22 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 8 },
    sectionDescription: { marginTop: 4, marginBottom: 14 },
    options: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    option: { width: '48%', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
    optionText: { flex: 1 },
    futureSetting: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 20, marginBottom: 8 },
    futureSettingTitle: { fontWeight: '700' },
    futureSettingText: { marginTop: 4, lineHeight: 18 },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 18, borderTopWidth: 1, padding: 16, marginTop: 12 },
    cancelButton: { paddingVertical: 10, paddingHorizontal: 4 },
    saveButton: { borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16, minWidth: 110, alignItems: 'center' },
    saveText: { fontWeight: '700' },
    disabledButton: { opacity: 0.6 },
});
