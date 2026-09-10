import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import api from '../lib/api';

type Note = {
  _id: string;
  title: string;
  content: string;
  updatedAt?: string;
};

const formatDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const Notes = () => {
  const navigation = useNavigation();
  const { colors: themeColors } = useTheme();
  const { width } = useWindowDimensions();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const updateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/notes');
      if (response.data.success) {
        setNotes(response.data.notes || []);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
      Alert.alert('Notes', 'Failed to load notes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    return () => {
      if (updateTimeout.current) clearTimeout(updateTimeout.current);
    };
  }, [loadNotes]);

  const filteredNotes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return notes;
    return notes.filter(
      note =>
        note.title.toLowerCase().includes(query) ||
        note.content.toLowerCase().includes(query),
    );
  }, [notes, searchQuery]);

  const handleCreateNote = useCallback(async () => {
    try {
      setSaving(true);
      const response = await api.post('/notes', { title: 'Untitled Note', content: '' });
      if (response.data.success) {
        const note = response.data.note as Note;
        setNotes(current => [note, ...current]);
        setSelectedNote(note);
      }
    } catch (error) {
      console.error('Error creating note:', error);
      Alert.alert('Notes', 'Failed to create note.');
    } finally {
      setSaving(false);
    }
  }, []);

  const handleUpdateNote = useCallback(
    (field: 'title' | 'content', value: string) => {
      if (!selectedNote) return;
      const updated = { ...selectedNote, [field]: value, updatedAt: new Date().toISOString() };
      setSelectedNote(updated);
      setNotes(current => current.map(note => (note._id === updated._id ? updated : note)));

      if (updateTimeout.current) clearTimeout(updateTimeout.current);
      updateTimeout.current = setTimeout(async () => {
        try {
          const response = await api.put(`/notes/${updated._id}`, { [field]: value });
          if (response.data.success) {
            const savedNote = response.data.note as Note;
            setSelectedNote(current => (current?._id === savedNote._id ? savedNote : current));
            setNotes(current => current.map(note => (note._id === savedNote._id ? savedNote : note)));
          }
        } catch (error) {
          console.error('Error updating note:', error);
          Alert.alert('Notes', 'Failed to save note.');
          loadNotes();
        }
      }, 700);
    },
    [loadNotes, selectedNote],
  );

  const handleDeleteNote = useCallback(() => {
    if (!selectedNote) return;
    Alert.alert('Delete note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setSaving(true);
            const response = await api.delete(`/notes/${selectedNote._id}`);
            if (response.data.success) {
              setNotes(current => current.filter(note => note._id !== selectedNote._id));
              setSelectedNote(null);
            }
          } catch (error) {
            console.error('Error deleting note:', error);
            Alert.alert('Notes', 'Failed to delete note.');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  }, [selectedNote]);

  const shareNote = useCallback(() => {
    if (!selectedNote) return;
    const caption =
      selectedNote.title && selectedNote.title !== 'Untitled Note'
        ? `From my notes: ${selectedNote.title}`
        : selectedNote.content.slice(0, 180);
    (navigation as any).navigate('Home', {
      screen: 'HomeMain',
      params: { composerCaption: caption },
    });
  }, [navigation, selectedNote]);

  const renderNote = ({ item }: { item: Note }) => {
    const active = selectedNote?._id === item._id;
    return (
      <TouchableOpacity
        onPress={() => setSelectedNote(item)}
        style={[
          styles.noteCard,
          {
            backgroundColor: active
              ? `${themeColors.primary}22`
              : themeColors.surface.secondary,
            borderColor: active ? `${themeColors.primary}88` : themeColors.border.primary,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text numberOfLines={1} style={[styles.noteTitle, { color: themeColors.text.primary }]}>
          {item.title || 'Untitled Note'}
        </Text>
        <Text numberOfLines={2} style={[styles.notePreview, { color: themeColors.text.secondary }]}>
          {item.content || 'No content'}
        </Text>
        <Text style={[styles.noteDate, { color: themeColors.text.tertiary }]}>
          {formatDate(item.updatedAt)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background.primary }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: themeColors.border.primary }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: themeColors.surface.secondary }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-back" size={19} color={themeColors.text.primary} />
            <Text style={[styles.backText, { color: themeColors.text.primary }]}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={[styles.heading, { color: themeColors.text.primary }]}>Notes</Text>
            <Text style={[styles.subtitle, { color: themeColors.text.secondary }]}>
              Capture ideas and keep them close
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.noteCount, { color: themeColors.text.secondary }]}>
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </Text>
          </View>
        </View>

        <View style={[styles.body, width >= 768 && styles.bodyWide]}>
          <View
            style={[
              styles.sidebar,
              width < 768 && styles.sidebarNarrow,
              { borderRightColor: themeColors.border.primary },
            ]}
          >
            <View style={[styles.search, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}>
              <Icon name="search" size={19} color={themeColors.text.tertiary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by title or content..."
                placeholderTextColor={themeColors.text.tertiary}
                style={[styles.searchInput, { color: themeColors.text.primary }]}
                accessibilityLabel="Search notes"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search">
                  <Icon name="close" size={18} color={themeColors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={themeColors.primary} />
                <Text style={[styles.helper, { color: themeColors.text.secondary }]}>Loading notes...</Text>
              </View>
            ) : (
              <FlatList
                data={filteredNotes}
                renderItem={renderNote}
                keyExtractor={item => item._id}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={[styles.emptySmall, { color: themeColors.text.secondary }]}>
                    {searchQuery ? 'No notes found' : 'No notes yet. Create one!'}
                  </Text>
                }
              />
            )}
          </View>

          <View style={[styles.editor, width < 768 && styles.editorNarrow]}>
            {selectedNote ? (
              <>
                <View style={[styles.toolbar, { borderBottomColor: themeColors.border.primary }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={[styles.updated, { color: themeColors.text.tertiary, marginRight: 8 }]}>
                      {selectedNote.updatedAt ? formatDate(selectedNote.updatedAt) : ''}
                    </Text>
                    {saving ? (
                      <ActivityIndicator size="small" color={themeColors.primary} />
                    ) : (
                      <Text style={[styles.savedText, { color: themeColors.text.tertiary }]}>Saved</Text>
                    )}
                  </View>
                  <View style={styles.toolbarActions}>
                    <TouchableOpacity onPress={shareNote} style={[styles.actionButton, { borderColor: `${themeColors.primary}66` }]}>
                      <Icon name="share" size={16} color={themeColors.primary} />
                      <Text style={[styles.actionText, { color: themeColors.primary }]}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleDeleteNote} style={[styles.actionButton, { borderColor: `${themeColors.status.error}66` }]}>
                      <Icon name="delete-outline" size={17} color={themeColors.status.error} />
                      <Text style={[styles.actionText, { color: themeColors.status.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <FlatList
                  data={[selectedNote]}
                  keyExtractor={item => item._id}
                  contentContainerStyle={styles.editorContent}
                  renderItem={() => (
                    <>
                      <TextInput
                        value={selectedNote.title || ''}
                        onChangeText={value => handleUpdateNote('title', value)}
                        placeholder="Note title..."
                        placeholderTextColor={themeColors.text.tertiary}
                        style={[styles.titleInput, { color: themeColors.text.primary, borderBottomColor: themeColors.border.primary }]}
                        accessibilityLabel="Note title"
                      />
                      <TextInput
                        value={selectedNote.content || ''}
                        onChangeText={value => handleUpdateNote('content', value)}
                        placeholder="Start writing your note..."
                        placeholderTextColor={themeColors.text.tertiary}
                        multiline
                        textAlignVertical="top"
                        style={[styles.contentInput, { color: themeColors.text.primary }]}
                        accessibilityLabel="Note content"
                      />
                    </>
                  )}
                />
              </>
            ) : (
              <View style={styles.emptyEditor}>
                <Text style={styles.emptyIcon}>📝</Text>
                <Text style={[styles.emptyTitle, { color: themeColors.text.primary }]}>No note selected</Text>
                <Text style={[styles.helper, { color: themeColors.text.secondary }]}>
                  Select a note or create a new one to start writing
                </Text>
              </View>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={handleCreateNote}
          disabled={saving}
          style={[styles.fab, { backgroundColor: themeColors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Create new note"
        >
          <Icon name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  backText: { fontSize: 14, fontWeight: '600' },
  headerCopy: { flex: 1 },
  heading: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  headerRight: { minWidth: 70, alignItems: 'flex-end' },
  noteCount: { fontSize: 13, fontWeight: '700' },
  body: { flex: 1 },
  bodyWide: { flexDirection: 'row' },
  sidebar: { flex: 0.92, borderRightWidth: 1 },
  sidebarNarrow: { flex: 0, maxHeight: 300, borderRightWidth: 0, borderBottomWidth: 1 },
  search: { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, borderWidth: 1, borderRadius: 11 },
  searchInput: { flex: 1, minHeight: 42, paddingHorizontal: 9, fontSize: 14 },
  listContent: { paddingHorizontal: 12, paddingBottom: 20, gap: 9 },
  noteCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  noteTitle: { fontSize: 15, fontWeight: '700' },
  notePreview: { fontSize: 13, lineHeight: 18, marginTop: 6, color: '#444' },
  noteDate: { fontSize: 11, marginTop: 8 },
  editor: { flex: 1.08 },
  editorNarrow: { flex: 1 },
  toolbar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, borderBottomWidth: 1, gap: 8 },
  toolbarActions: { flexDirection: 'row', gap: 8 },
  updated: { fontSize: 12 },
  savedText: { fontSize: 12, fontWeight: '600' },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  actionText: { fontSize: 13, fontWeight: '700' },
  editorContent: { padding: 18, paddingBottom: 140 },
  titleInput: { fontSize: 26, fontWeight: '800', paddingVertical: 10, borderBottomWidth: 2, marginBottom: 18 },
  contentInput: { minHeight: 300, fontSize: 16, lineHeight: 25, paddingVertical: 8, backgroundColor: 'transparent' },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  helper: { fontSize: 14, textAlign: 'center' },
  emptySmall: { textAlign: 'center', padding: 24, lineHeight: 20 },
  emptyEditor: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyIcon: { fontSize: 54, marginBottom: 12 },
  emptyTitle: { fontSize: 21, fontWeight: '800', marginBottom: 7 },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

export default Notes;
