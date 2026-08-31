import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import moment from 'moment';
import api, { storyAPI } from '../../lib/api';
import ProfileImage from '../ProfileImage';
import UserPP from '../UserPP';
import {
  getReactEmoji,
  getReactLabel,
  profileDisplayName,
  sameProfileId,
} from '../../utils/reactTypes';

const ACCENT = '#00D4FF';
const SHEET_BG = '#1E1F20';
const CARD_BG = '#242526';
const TEXT = '#E4E6EA';
const MUTED = '#B0B3B8';

const isPopulatedComment = (item: any) =>
  item && typeof item === 'object' && (item._id || item.body || item.author);

const commentText = (item: any) =>
  item?.text || item?.body || item?.content || item?.message || '';

const StoryReactorRow = ({
  reactor,
  onOpenProfile,
}: {
  reactor: any;
  onOpenProfile: (profileId: string) => void;
}) => {
  const seed = typeof reactor?.profile === 'object' ? reactor.profile : null;
  const [profile, setProfile] = useState<any>(seed);
  const profileId = String(seed?._id || reactor?.profile || '');

  useEffect(() => {
    if (!profileId) return;
    if (seed?.profilePic || seed?.fullName) {
      setProfile(seed);
      return;
    }
    let cancelled = false;
    api
      .get('/profile', { params: { profileId } })
      .then((res) => {
        if (!cancelled && res.status === 200) setProfile(res.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [profileId, seed]);

  if (!profile) {
    return (
      <View style={styles.reactorRow}>
        <View style={styles.reactorAvatarPlaceholder} />
        <Text style={styles.reactorName}>Loading…</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.reactorRow}
      onPress={() => onOpenProfile(profile._id || profileId)}
      activeOpacity={0.75}
    >
      <UserPP image={profile.profilePic} size={40} />
      <Text style={styles.reactorName} numberOfLines={1}>
        {profileDisplayName(profile)}
      </Text>
      <Text style={styles.reactorEmoji}>{getReactEmoji(reactor?.type)}</Text>
      <Text style={styles.reactorType}>{getReactLabel(reactor?.type)}</Text>
    </TouchableOpacity>
  );
};

interface StoryEngagementSheetProps {
  storyId: string;
  comments: any[];
  reacts: any[];
  myProfile: any;
  activeTab: 'comments' | 'reacts';
  loading?: boolean;
  onTabChange: (tab: 'comments' | 'reacts') => void;
  onCommentsChange: (comments: any[]) => void;
  onClose: () => void;
  onOpenProfile: (profileId: string) => void;
  onInputFocus?: () => void;
  onInputBlur?: () => void;
}

const StoryEngagementSheet: React.FC<StoryEngagementSheetProps> = ({
  storyId,
  comments,
  reacts,
  myProfile,
  activeTab,
  loading = false,
  onTabChange,
  onCommentsChange,
  onClose,
  onOpenProfile,
  onInputFocus,
  onInputBlur,
}) => {
  const myId = myProfile?._id;
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);

  const commentList = useMemo(
    () => (Array.isArray(comments) ? comments.filter(isPopulatedComment) : []),
    [comments]
  );
  const reactList = useMemo(
    () => (Array.isArray(reacts) ? reacts.filter(Boolean) : []),
    [reacts]
  );

  const authorName = (item: any) => profileDisplayName(item?.author);

  const submit = async () => {
    const body = draft.trim();
    if (!body || submitting || !storyId || !myId) return;
    setSubmitting(true);
    try {
      if (replyingTo?._id) {
        const res = await api.post('/comment/addReply', {
          replyMsg: body,
          authorId: myId,
          commentId: replyingTo._id,
        });
        if (res.status === 200 && res.data) {
          const newReply = {
            ...res.data,
            author: res.data.author || myProfile,
            text: res.data.text || res.data.body || body,
          };
          onCommentsChange(
            commentList.map((comment) => {
              if (!sameProfileId(comment._id, replyingTo._id)) return comment;
              const existing = Array.isArray(comment.replies) ? comment.replies : [];
              if (existing.some((reply: any) => sameProfileId(reply?._id, newReply._id))) {
                return comment;
              }
              return { ...comment, replies: [...existing, newReply] };
            })
          );
          setDraft('');
          setReplyingTo(null);
          Keyboard.dismiss();
        }
      } else {
        const res = await storyAPI.addComment(storyId, body);
        if (res.status === 200 && res.data) {
          const next = {
            ...res.data,
            author: res.data.author || myProfile,
            reacts: res.data.reacts || [],
            replies: res.data.replies || [],
            text: res.data.text || res.data.body || body,
          };
          const exists = commentList.some((c) => sameProfileId(c._id, next._id));
          onCommentsChange(exists ? commentList.map((c) => (sameProfileId(c._id, next._id) ? next : c)) : [...commentList, next]);
          setDraft('');
          Keyboard.dismiss();
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = (comment: any) => {
    if (!comment?._id || deletingId) return;
    Alert.alert('Delete comment', 'Delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(comment._id);
          try {
            const res = await api.post('/comment/deleteComment', {
              commentId: comment._id,
              postId: storyId,
              parentType: 'story',
            });
            if (res.status === 200) {
              onCommentsChange(commentList.filter((item) => !sameProfileId(item._id, comment._id)));
              if (sameProfileId(replyingTo?._id, comment._id)) setReplyingTo(null);
            }
          } catch (e) {
            console.log(e);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const placeholder = !myId
    ? 'Log in to comment'
    : replyingTo
      ? `Reply to ${authorName(replyingTo)}…`
      : 'Write a public comment…';

  return (
    <View style={styles.sheet}>
      <View style={styles.handleRow}>
        <View style={styles.handle} />
        <TouchableOpacity onPress={onClose} hitSlop={10} style={styles.sheetClose}>
          <Icon name="close" size={20} color={MUTED} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.tab, activeTab === 'comments' && styles.tabActive]}
          onPress={() => onTabChange('comments')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'comments' }}
        >
          <Icon name="chat-bubble" size={16} color={activeTab === 'comments' ? ACCENT : MUTED} />
          <Text style={[styles.tabLabel, activeTab === 'comments' && styles.tabLabelActive]}>Comments</Text>
          <View style={[styles.countBadge, activeTab === 'comments' && styles.countBadgeActive]}>
            <Text style={[styles.countText, activeTab === 'comments' && styles.countTextActive]}>
              {commentList.length}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reacts' && styles.tabActive]}
          onPress={() => onTabChange('reacts')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'reacts' }}
        >
          <Icon name="favorite" size={16} color={activeTab === 'reacts' ? ACCENT : MUTED} />
          <Text style={[styles.tabLabel, activeTab === 'reacts' && styles.tabLabelActive]}>Reacts</Text>
          <View style={[styles.countBadge, activeTab === 'reacts' && styles.countBadgeActive]}>
            <Text style={[styles.countText, activeTab === 'reacts' && styles.countTextActive]}>
              {reactList.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {activeTab === 'comments' ? (
        <View style={styles.tabPane}>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
            ) : commentList.length === 0 ? (
              <Text style={styles.empty}>No comments yet</Text>
            ) : (
              commentList.map((comment) => {
                const replies = Array.isArray(comment.replies)
                  ? comment.replies.filter(isPopulatedComment)
                  : [];
                const mine = sameProfileId(comment.author, myId);
                const authorId = comment.author?._id || comment.author;
                return (
                  <View key={comment._id || comment.createdAt} style={styles.commentBlock}>
                    <TouchableOpacity
                      onPress={() => authorId && onOpenProfile(String(authorId))}
                      activeOpacity={0.8}
                    >
                      <ProfileImage
                        uri={comment.author?.profilePic}
                        pixelSize={72}
                        style={styles.commentAvatar}
                      />
                    </TouchableOpacity>
                    <View style={styles.commentMain}>
                      <View style={styles.commentBubble}>
                        <Text style={styles.commentAuthor}>{authorName(comment)}</Text>
                        <Text style={styles.commentBody}>{commentText(comment)}</Text>
                      </View>
                      <View style={styles.commentMeta}>
                        <Text style={styles.commentTime}>
                          {comment.createdAt ? moment(comment.createdAt).fromNow() : ''}
                        </Text>
                        {myId ? (
                          <TouchableOpacity onPress={() => setReplyingTo(comment)} hitSlop={8}>
                            <Text style={styles.metaAction}>Reply</Text>
                          </TouchableOpacity>
                        ) : null}
                        {mine ? (
                          <TouchableOpacity
                            onPress={() => deleteComment(comment)}
                            disabled={deletingId === comment._id}
                            hitSlop={8}
                          >
                            <Text style={styles.deleteAction}>
                              {deletingId === comment._id ? 'Deleting' : 'Delete'}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                      {replies.map((reply: any) => (
                        <View key={reply._id || reply.createdAt} style={styles.replyRow}>
                          <ProfileImage
                            uri={reply.author?.profilePic}
                            pixelSize={56}
                            style={styles.replyAvatar}
                          />
                          <View style={styles.replyBubble}>
                            <Text style={styles.commentAuthor}>{authorName(reply)}</Text>
                            <Text style={styles.commentBody}>{commentText(reply)}</Text>
                            <Text style={styles.commentTime}>
                              {reply.createdAt ? moment(reply.createdAt).fromNow() : ''}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <View style={styles.composer}>
            {replyingTo ? (
              <View style={styles.replyChip}>
                <Text style={styles.replyChipText} numberOfLines={1}>
                  Replying to {authorName(replyingTo)}
                </Text>
                <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Icon name="close" size={16} color={MUTED} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              <UserPP image={myProfile?.profilePic} size={34} />
              <TextInput
                style={styles.input}
                value={draft}
                onChangeText={setDraft}
                placeholder={placeholder}
                placeholderTextColor={MUTED}
                editable={!!myId && !submitting}
                onFocus={onInputFocus}
                onBlur={onInputBlur}
                returnKeyType="send"
                onSubmitEditing={submit}
              />
              <TouchableOpacity
                style={[styles.sendBtn, (!draft.trim() || submitting || !myId) && styles.sendBtnDisabled]}
                onPress={submit}
                disabled={!draft.trim() || submitting || !myId}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#04222a" />
                ) : (
                  <Icon name="send" size={16} color="#04222a" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
          ) : reactList.length === 0 ? (
            <Text style={styles.empty}>No reacts yet</Text>
          ) : (
            reactList.map((item, index) => (
              <StoryReactorRow
                key={`${item.profile?._id || item.profile || index}-${item.type || 'react'}`}
                reactor={item}
                onOpenProfile={onOpenProfile}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    height: 360,
  },
  handleRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  sheetClose: {
    position: 'absolute',
    right: 12,
    top: 6,
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: ACCENT,
  },
  tabLabel: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: TEXT,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: 'rgba(176,179,184,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(0,212,255,0.18)',
  },
  countText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  countTextActive: {
    color: ACCENT,
  },
  tabPane: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  empty: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 14,
    paddingVertical: 28,
  },
  commentBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 8,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: CARD_BG,
  },
  commentMain: {
    flex: 1,
  },
  commentBubble: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  commentAuthor: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  commentBody: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 19,
  },
  commentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  commentTime: {
    color: MUTED,
    fontSize: 11,
  },
  metaAction: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  deleteAction: {
    color: '#FF5A5A',
    fontSize: 12,
    fontWeight: '600',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
    marginLeft: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CARD_BG,
  },
  replyBubble: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  replyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyChipText: {
    color: MUTED,
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: CARD_BG,
    color: TEXT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.45,
  },
  reactorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reactorAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BG,
  },
  reactorName: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
  },
  reactorEmoji: {
    fontSize: 20,
  },
  reactorType: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
});

export default StoryEngagementSheet;
