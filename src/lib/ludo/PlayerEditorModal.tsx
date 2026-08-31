import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { PLAYER_EMOJIS, PLAYER_LETTERS, THEME } from './constants';
import type { FriendUser, Player } from './types';
import ProfileImage from '../../components/ProfileImage';
import KeyboardSafeView from '../../components/KeyboardSafeView';

interface PlayerEditorModalProps {
  show: boolean;
  editingPlayerIndex: number | null;
  player: Player | null;
  editName: string;
  editAvatarUrl: string;
  inviteCopied: boolean;
  friendSearchQuery: string;
  loadingSearch: boolean;
  searchResults: FriendUser[];
  friendList: FriendUser[];
  canReplaceWithComputer: boolean;
  onNameChange: (value: string) => void;
  onAvatarUrlChange: (value: string) => void;
  onFriendSearchChange: (value: string) => void;
  onAssignFriendToSlot: (friend: FriendUser, slotIndex: number) => void;
  onReplaceWithComputer: () => void;
  onCopyInviteLink: (slotIndex?: number) => void;
  onPlaySound?: (type: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const PlayerEditorModal: React.FC<PlayerEditorModalProps> = ({
  show,
  editingPlayerIndex,
  player,
  editName,
  editAvatarUrl,
  inviteCopied,
  friendSearchQuery,
  loadingSearch,
  searchResults,
  friendList,
  canReplaceWithComputer,
  onNameChange,
  onAvatarUrlChange,
  onFriendSearchChange,
  onAssignFriendToSlot,
  onReplaceWithComputer,
  onCopyInviteLink,
  onPlaySound,
  onClose,
  onSave,
}) => {
  if (!show || editingPlayerIndex == null || !player) return null;

  const visibleFriends = friendSearchQuery ? searchResults || [] : friendList || [];
  const seatLetter = PLAYER_LETTERS[editingPlayerIndex] || PLAYER_EMOJIS[editingPlayerIndex] || 'P';
  const accent = player.color || THEME.accent;

  const pickAvatar = async () => {
    onPlaySound?.('buttonClick');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      onAvatarUrlChange(result.assets[0].uri);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardSafeView force style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modal, { borderColor: accent }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            <Text style={styles.title}>Edit Player</Text>

            <View style={styles.previewRow}>
              <View style={[styles.avatarWrap, { borderColor: accent }]}>
                {editAvatarUrl ? (
                  <ProfileImage uri={editAvatarUrl} pixelSize={160} style={styles.avatar} />
                ) : (
                  <Text style={styles.avatarLetter}>{seatLetter}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.muted}>Player #{editingPlayerIndex + 1}</Text>
                <Text style={styles.playerName} numberOfLines={1}>
                  {player.name}
                </Text>
                {player.isBot ? <Text style={styles.botBadge}>CPU</Text> : null}
              </View>
            </View>

            <TextInput
              style={styles.field}
              value={editName}
              onChangeText={onNameChange}
              placeholder="Enter name"
              placeholderTextColor={THEME.muted}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.field}
              value={editAvatarUrl}
              onChangeText={onAvatarUrlChange}
              placeholder="Avatar image URL"
              placeholderTextColor={THEME.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.accentBtn} onPress={pickAvatar}>
              <Text style={styles.accentBtnText}>Upload Picture</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <Text style={styles.sectionTitle}>Pick a user from Connect</Text>
              <View style={styles.search}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search users by name..."
                  placeholderTextColor={THEME.muted}
                  value={friendSearchQuery}
                  onChangeText={onFriendSearchChange}
                  autoCapitalize="none"
                />
              </View>
              {loadingSearch && (
                <View style={styles.empty}>
                  <ActivityIndicator color={THEME.accent} />
                  <Text style={styles.emptyText}>Searching…</Text>
                </View>
              )}
              {!loadingSearch && visibleFriends.length === 0 && (
                <Text style={styles.emptyText}>
                  {friendSearchQuery ? 'No users match your search' : 'No users to show'}
                </Text>
              )}
              <View style={styles.friendList}>
                {visibleFriends.map((f) => {
                  const initial = (f?.fullName || '?').trim().charAt(0).toUpperCase();
                  return (
                    <View key={f._id} style={styles.friend}>
                      <View style={styles.friendLeft}>
                        {f.profilePic ? (
                          <ProfileImage uri={f.profilePic} pixelSize={80} style={styles.friendAvatar} />
                        ) : (
                          <View style={styles.friendAvatarFallback}>
                            <Text style={styles.avatarLetter}>{initial}</Text>
                          </View>
                        )}
                        <Text style={styles.friendName} numberOfLines={1}>
                          {f.fullName || 'Unknown'}
                        </Text>
                      </View>
                      <View style={styles.friendActions}>
                        <TouchableOpacity
                          style={styles.ghostSm}
                          onPress={() => {
                            onPlaySound?.('buttonClick');
                            onNameChange(f.fullName || '');
                            onAvatarUrlChange(f.profilePic || '');
                          }}
                        >
                          <Text style={styles.ghostSmText}>Use</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.primarySm}
                          onPress={() => {
                            onPlaySound?.('buttonClick');
                            onAssignFriendToSlot(f, editingPlayerIndex);
                            onClose();
                          }}
                        >
                          <Text style={styles.primarySmText}>Assign</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {canReplaceWithComputer && (
              <View style={styles.divider}>
                <Text style={styles.sectionTitle}>Player type</Text>
                <TouchableOpacity
                  style={[styles.accentBtn, player.isBot && styles.btnDisabled]}
                  disabled={Boolean(player.isBot)}
                  onPress={() => {
                    onPlaySound?.('buttonClick');
                    onReplaceWithComputer();
                  }}
                >
                  <Text style={styles.accentBtnText}>
                    {player.isBot ? 'Computer Player' : 'Replace with Computer'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider}>
              <Text style={styles.sectionTitle}>Continue on another device</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onPlaySound?.('buttonClick');
                  onCopyInviteLink(editingPlayerIndex);
                }}
              >
                <Text style={styles.primaryBtnText}>Copy Invite Link</Text>
              </TouchableOpacity>
              {inviteCopied ? <Text style={styles.copied}>Copied!</Text> : null}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.ghostBtn} onPress={onClose}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: accent }]}
              onPress={onSave}
            >
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardSafeView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 16, 0.78)',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: THEME.bgElevated,
    borderRadius: THEME.radius,
    borderWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  body: { padding: 18, paddingBottom: 8 },
  title: {
    color: THEME.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#2a3a4c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: { width: '100%', height: '100%' },
  avatarLetter: { color: THEME.text, fontWeight: '800', fontSize: 16 },
  muted: { color: THEME.muted, fontSize: 12 },
  playerName: { color: THEME.text, fontWeight: '700', fontSize: 16, marginTop: 2 },
  botBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    color: THEME.accent2,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: 'rgba(62, 198, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  field: {
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 10,
    color: THEME.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 10,
  },
  accentBtn: {
    backgroundColor: 'rgba(62, 198, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(62, 198, 255, 0.35)',
    borderRadius: 999,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  accentBtnText: { color: THEME.accent2, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
  divider: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  sectionTitle: {
    color: THEME.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  search: {
    backgroundColor: THEME.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: THEME.border,
    marginBottom: 8,
  },
  searchInput: {
    color: THEME.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  empty: { alignItems: 'center', padding: 10, gap: 8 },
  emptyText: { color: THEME.muted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  friendList: { maxHeight: 200 },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.border,
  },
  friendLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, minWidth: 0 },
  friendAvatar: { width: 36, height: 36, borderRadius: 8 },
  friendAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#2a3a4c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendName: { color: THEME.text, fontWeight: '600', flex: 1 },
  friendActions: { flexDirection: 'row', gap: 6 },
  ghostSm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  ghostSmText: { color: THEME.text, fontWeight: '700', fontSize: 12 },
  primarySm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: THEME.accent,
  },
  primarySmText: { color: '#06241f', fontWeight: '700', fontSize: 12 },
  primaryBtn: {
    backgroundColor: THEME.accent,
    borderRadius: 999,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#06241f', fontWeight: '800' },
  copied: { color: THEME.success, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
  },
  ghostBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  ghostBtnText: { color: THEME.text, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { color: '#06241f', fontWeight: '800' },
});
