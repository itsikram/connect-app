import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../contexts/ThemeContext';
import api from '../lib/api';
import VoiceTextInput from '../components/VoiceTextInput';

type Task = {
  _id: string;
  text: string;
  completed: boolean;
  reminderTime?: string;
  reminderTimezone?: string;
};

type Filter = 'all' | 'active' | 'completed';

const Tasks = () => {
  const navigation = useNavigation();
  const { colors: themeColors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [reminderTime, setReminderTime] = useState<Date | null>(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [taskReminderPickerId, setTaskReminderPickerId] = useState<string | null>(null);
  const reminderTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks');
      if (response.data.success) {
        setTasks(response.data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      Alert.alert('Tasks', 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        if (filter === 'active') return !task.completed;
        if (filter === 'completed') return task.completed;
        return true;
      }),
    [filter, tasks]
  );
  const activeTasksCount = tasks.filter((task) => !task.completed).length;
  const completedTasksCount = tasks.filter((task) => task.completed).length;

  const handleAddTask = useCallback(async () => {
    const text = newTask.trim();
    if (!text) return;
    try {
      const response = await api.post('/tasks', {
        text,
        reminderTime: reminderTime ? `${String(reminderTime.getHours()).padStart(2, '0')}:${String(reminderTime.getMinutes()).padStart(2, '0')}` : null,
        reminderTimezone: reminderTime ? reminderTimezone : null,
      });
      if (response.data.success) {
        setTasks((current) => [response.data.task, ...current]);
        setNewTask('');
        setReminderTime(null);
      }
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Tasks', 'Failed to create task.');
    }
  }, [newTask, reminderTime, reminderTimezone]);

  const handleToggleTask = useCallback(async (id: string) => {
    const task = tasks.find((item) => item._id === id);
    if (!task) return;
    const completed = !task.completed;
    setTasks((current) => current.map((item) => item._id === id ? { ...item, completed } : item));
    try {
      const response = await api.put(`/tasks/${id}`, { completed });
      if (response.data.success) {
        setTasks((current) => current.map((item) => item._id === id ? response.data.task : item));
      }
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Tasks', 'Failed to update task.');
      loadTasks();
    }
  }, [loadTasks, tasks]);

  const handleTaskReminderChange = useCallback(async (id: string, value: Date | null) => {
    const time = value
      ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
      : null;
    try {
      const response = await api.put(`/tasks/${id}`, {
        reminderTime: time,
        reminderTimezone: time ? reminderTimezone : null,
      });
      if (response.data.success) {
        setTasks((current) => current.map((task) => task._id === id ? response.data.task : task));
      }
    } catch (error) {
      console.error('Error updating task reminder:', error);
      Alert.alert('Tasks', 'Failed to update task reminder.');
      loadTasks();
    }
  }, [loadTasks, reminderTimezone]);

  const handleDeleteTask = useCallback(async (id: string) => {
    try {
      const response = await api.delete(`/tasks/${id}`);
      if (response.data.success) {
        setTasks((current) => current.filter((task) => task._id !== id));
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      Alert.alert('Tasks', 'Failed to delete task.');
    }
  }, []);

  const handleClearCompleted = useCallback(async () => {
    try {
      const response = await api.delete('/tasks/completed/all');
      if (response.data.success) {
        setTasks((current) => current.filter((task) => !task.completed));
      }
    } catch (error) {
      console.error('Error clearing completed tasks:', error);
      Alert.alert('Tasks', 'Failed to clear completed tasks.');
    }
  }, []);

  const title = filter === 'completed' ? 'No completed tasks' : filter === 'active' ? 'No active tasks' : 'No tasks yet';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: themeColors.background.primary }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={[styles.backButton, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-back" size={18} color={themeColors.text.primary} />
              <Text style={[styles.backText, { color: themeColors.text.primary }]}>Back</Text>
            </TouchableOpacity>
            <Text style={[styles.heading, { color: themeColors.text.primary }]}>Tasks</Text>
          </View>

          {tasks.length > 0 && (
            <View style={styles.stats}>
              <Stat label="Total" value={tasks.length} colors={themeColors} />
              <Stat label="Active" value={activeTasksCount} colors={themeColors} />
              <Stat label="Completed" value={completedTasksCount} colors={themeColors} />
            </View>
          )}

          <View style={styles.inputRow}>
            <VoiceTextInput
              value={newTask}
              onChangeText={setNewTask}
              onSubmitEditing={handleAddTask}
              placeholder="Add a new task..."
              placeholderTextColor={themeColors.text.tertiary}
              style={[styles.input, { color: themeColors.text.primary, backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}
              returnKeyType="done"
              accessibilityLabel="New task"
            />
            <TouchableOpacity onPress={handleAddTask} style={[styles.addButton, { backgroundColor: themeColors.status.success }]} accessibilityRole="button">
              <Text style={styles.addButtonText}>Add Task</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.reminderRow}>
            <TouchableOpacity
              onPress={() => setShowReminderPicker(true)}
              style={[styles.reminderButton, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary }]}
              accessibilityRole="button"
              accessibilityLabel="Set daily reminder time"
            >
              <Icon name="notifications-none" size={18} color={themeColors.text.primary} />
              <Text style={[styles.reminderText, { color: themeColors.text.primary }]}>
                {reminderTime ? `Remind daily at ${reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Set daily reminder'}
              </Text>
            </TouchableOpacity>
            {reminderTime && (
              <TouchableOpacity onPress={() => setReminderTime(null)} accessibilityRole="button" accessibilityLabel="Clear reminder">
                <Text style={[styles.clearReminderText, { color: themeColors.status.error }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {showReminderPicker && (
            <DateTimePicker
              value={reminderTime || new Date()}
              mode="time"
              onChange={(_, value) => {
                setShowReminderPicker(Platform.OS === 'ios');
                if (value) setReminderTime(value);
              }}
            />
          )}

          {tasks.length > 0 && (
            <View style={styles.filters}>
              {(['all', 'active', 'completed'] as Filter[]).map((item) => {
                const count = item === 'all' ? tasks.length : item === 'active' ? activeTasksCount : completedTasksCount;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setFilter(item)}
                    style={[styles.filterButton, { backgroundColor: filter === item ? themeColors.status.success : themeColors.surface.secondary, borderColor: filter === item ? themeColors.status.success : themeColors.border.primary }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === item }}
                  >
                    <Text style={[styles.filterText, { color: filter === item ? '#FFFFFF' : themeColors.text.primary }]}>
                      {item[0].toUpperCase() + item.slice(1)} ({count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={themeColors.primary} />
              <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>Loading tasks...</Text>
            </View>
          ) : filteredTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>{filter === 'active' ? '📋' : '✅'}</Text>
              <Text style={[styles.emptyTitle, { color: themeColors.text.primary }]}>{title}</Text>
              {filter === 'all' && <Text style={[styles.emptyText, { color: themeColors.text.secondary }]}>Add your first task to get started!</Text>}
            </View>
          ) : (
            <>
              <View style={styles.taskList}>
                {filteredTasks.map((task) => (
                  <View key={task._id} style={[styles.taskItem, { backgroundColor: themeColors.surface.secondary, borderColor: themeColors.border.primary, opacity: task.completed ? 0.6 : 1 }]}>
                    <Pressable
                      onPress={() => handleToggleTask(task._id)}
                      style={[styles.checkbox, task.completed && { backgroundColor: themeColors.status.success, borderColor: themeColors.status.success }]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: task.completed }}
                    >
                      {task.completed && <Icon name="check" size={15} color="#FFFFFF" />}
                    </Pressable>
                    <View style={styles.taskDetails}>
                      <Text style={[styles.taskText, { color: themeColors.text.primary }, task.completed && styles.completedText]}>{task.text}</Text>
                      {task.reminderTime && (
                        <Text style={[styles.reminderMeta, { color: themeColors.text.secondary }]}>
                          Daily reminder at {task.reminderTime}
                        </Text>
                      )}
                      <TouchableOpacity
                        onPress={() => setTaskReminderPickerId(task._id)}
                        style={[styles.taskReminderButton, { borderColor: themeColors.border.primary }]}
                        accessibilityRole="button"
                        accessibilityLabel={`Set reminder for ${task.text}`}
                      >
                        <Icon name="schedule" size={14} color={themeColors.text.secondary} />
                        <Text style={[styles.taskReminderButtonText, { color: themeColors.text.secondary }]}>
                          {task.reminderTime || 'Set time'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteTask(task._id)} style={[styles.deleteButton, { backgroundColor: themeColors.status.error + '22', borderColor: themeColors.status.error + '55' }]} accessibilityRole="button">
                      <Text style={[styles.deleteText, { color: themeColors.status.error }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
              {taskReminderPickerId && (() => {
                const task = tasks.find((item) => item._id === taskReminderPickerId);
                if (!task) return null;
                const value = new Date();
                if (task.reminderTime) {
                  const [hours, minutes] = task.reminderTime.split(':').map(Number);
                  value.setHours(hours, minutes, 0, 0);
                }
                return (
                  <DateTimePicker
                    value={value}
                    mode="time"
                    onChange={(_, selected) => {
                      setTaskReminderPickerId(Platform.OS === 'ios' ? task._id : null);
                      if (selected) handleTaskReminderChange(task._id, selected);
                    }}
                  />
                );
              })()}
              {completedTasksCount > 0 && (
                <TouchableOpacity onPress={handleClearCompleted} style={[styles.clearButton, { backgroundColor: themeColors.status.error + '22', borderColor: themeColors.status.error + '55' }]} accessibilityRole="button">
                  <Text style={[styles.deleteText, { color: themeColors.status.error }]}>Clear Completed ({completedTasksCount})</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

type ThemeColors = ReturnType<typeof useTheme>['colors'];

const Stat = ({ label, value, colors }: { label: string; value: number; colors: ThemeColors }) => (
  <View style={[styles.stat, { backgroundColor: colors.surface.secondary, borderColor: colors.border.primary }]}>
    <Text style={[styles.statText, { color: colors.text.primary }]}>{label}: <Text style={styles.statValue}>{value}</Text></Text>
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  backText: { fontSize: 14, fontWeight: '500' },
  heading: { fontSize: 30, fontWeight: '700' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  stat: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  statText: { fontSize: 13 },
  statValue: { fontWeight: '700' },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: -10, marginBottom: 18 },
  reminderButton: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 9 },
  reminderText: { fontSize: 13, fontWeight: '600' },
  clearReminderText: { fontSize: 13, fontWeight: '600' },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  addButton: { justifyContent: 'center', borderRadius: 12, paddingHorizontal: 16 },
  addButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  filterButton: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  filterText: { fontSize: 13, fontWeight: '600' },
  taskList: { gap: 10, marginBottom: 18 },
  taskItem: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 14 },
  checkbox: { width: 21, height: 21, borderRadius: 6, borderWidth: 2, borderColor: '#8E8E93', alignItems: 'center', justifyContent: 'center' },
  taskText: { flex: 1, fontSize: 16 },
  taskDetails: { flex: 1, gap: 3 },
  reminderMeta: { fontSize: 12 },
  taskReminderButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 4 },
  taskReminderButtonText: { fontSize: 12 },
  completedText: { textDecorationLine: 'line-through', opacity: 0.7 },
  deleteButton: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 9, paddingVertical: 6 },
  deleteText: { fontSize: 12, fontWeight: '600' },
  clearButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 52, marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

export default Tasks;
