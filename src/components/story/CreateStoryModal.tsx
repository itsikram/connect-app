import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import api, { storyAPI } from '../../lib/api';
import UserPP from '../UserPP';

const FALLBACK_BG = 'linear-gradient(135deg, #00D4FF 0%, #6366F1 100%)';

const AUDIENCE_OPTIONS = [
  { id: 1, icon: 'public', title: 'Public', desc: 'Anyone can see this story' },
  { id: 2, icon: 'people', title: 'Friends', desc: 'Only your friends can see this' },
  { id: 3, icon: 'lock', title: 'Only Me', desc: 'Only you can see this story' },
] as const;

interface CreateStoryModalProps {
  visible: boolean;
  onClose: () => void;
  profileData?: any;
  onStoryCreated?: (data?: any) => void;
}

const CreateStoryModal: React.FC<CreateStoryModalProps> = ({
  visible,
  onClose,
  profileData,
  onStoryCreated,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useToast();

  const [localPreview, setLocalPreview] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [storyBg, setStoryBg] = useState('');
  const [audience, setAudience] = useState(1);
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [hasStoryRing, setHasStoryRing] = useState(false);

  const profileId = profileData?._id;
  const profileName = profileData?.fullName
    || [profileData?.user?.firstName, profileData?.user?.surname].filter(Boolean).join(' ').trim()
    || 'You';

  const reset = useCallback(() => {
    setLocalPreview('');
    setUploadedUrl('');
    setStoryBg('');
    setAudience(1);
    setShowAudienceMenu(false);
    setIsUploading(false);
    setIsSubmitting(false);
    setUploadError('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!visible || !profileId) return;
    api
      .get('/profile/hasStory', { params: { profileId } })
      .then((res) => {
        setHasStoryRing(res.data?.hasStory === 'yes');
      })
      .catch(() => {});
  }, [visible, profileId]);

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setUploadError('Photo library permission is required to add a story.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const uri = result.assets[0].uri;
      const mime = result.assets[0].mimeType || 'image/jpeg';
      const name = result.assets[0].fileName || `story_${Date.now()}.jpg`;

      setUploadError('');
      setLocalPreview(uri);
      setUploadedUrl('');
      setStoryBg('');
      setIsUploading(true);

      const file: any = {
        uri,
        type: mime,
        name,
      };
      const formData = new FormData();
      formData.append('image', file);
      formData.append('type', mime);

      const uploadRes = await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const nextUrl = uploadRes.data?.secure_url || uploadRes.data?.url;
      if (uploadRes.status !== 200 || !nextUrl) {
        throw new Error('Upload failed');
      }

      setUploadedUrl(nextUrl);
      setStoryBg(FALLBACK_BG);
    } catch (err: any) {
      console.log('Story upload failed:', err);
      setUploadError(err?.response?.data?.message || 'Could not upload image. Please try again.');
      setUploadedUrl('');
      setStoryBg('');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = () => {
    setLocalPreview('');
    setUploadedUrl('');
    setStoryBg('');
    setUploadError('');
  };

  const handleSubmit = async () => {
    if (!uploadedUrl || !storyBg || isUploading || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await storyAPI.createStory({
        image: uploadedUrl,
        storyBg,
        audience,
      });
      if (res.status === 200) {
        showSuccess('Story added successfully!');
        DeviceEventEmitter.emit('story:created');
        onStoryCreated?.(res.data);
        handleClose();
      }
    } catch (err: any) {
      console.log('Create story failed:', err);
      showError(err?.response?.data?.message || 'Could not add story. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewSrc = localPreview || uploadedUrl;
  const canSubmit = Boolean(uploadedUrl && storyBg) && !isUploading && !isSubmitting;
  const selectedAudience = AUDIENCE_OPTIONS.find((opt) => opt.id === audience) || AUDIENCE_OPTIONS[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface.primary,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border.secondary }]}>
            <Text style={[styles.title, { color: colors.text.primary }]}>Add to Story</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={[styles.closeBtn, { backgroundColor: colors.surface.secondary }]}
              hitSlop={8}
              accessibilityLabel="Close"
            >
              <Icon name="close" size={20} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.profileRow}>
              <UserPP image={profileData?.profilePic} size={42} hasStory={hasStoryRing} />
              <Text style={[styles.profileName, { color: colors.text.primary }]} numberOfLines={1}>
                {profileName}
              </Text>
              <TouchableOpacity
                style={[styles.audienceBtn, { backgroundColor: colors.surface.secondary }]}
                onPress={() => setShowAudienceMenu((prev) => !prev)}
              >
                <Icon name={selectedAudience.icon} size={16} color={colors.primary} />
                <Text style={[styles.audienceLabel, { color: colors.text.primary }]}>
                  {selectedAudience.title}
                </Text>
                <Icon name="expand-more" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {showAudienceMenu ? (
              <View style={[styles.audienceMenu, { backgroundColor: colors.surface.secondary, borderColor: colors.border.secondary }]}>
                {AUDIENCE_OPTIONS.map((opt) => {
                  const active = audience === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.audienceOption, active && { backgroundColor: colors.primary + '18' }]}
                      onPress={() => {
                        setAudience(opt.id);
                        setShowAudienceMenu(false);
                      }}
                    >
                      <Icon name={opt.icon} size={20} color={active ? colors.primary : colors.text.secondary} />
                      <View style={styles.audienceOptionCopy}>
                        <Text style={[styles.audienceOptionTitle, { color: colors.text.primary }]}>{opt.title}</Text>
                        <Text style={[styles.audienceOptionDesc, { color: colors.text.secondary }]}>{opt.desc}</Text>
                      </View>
                      {active ? <Icon name="check" size={18} color={colors.primary} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : null}

            <Text style={[styles.hint, { color: colors.text.secondary }]}>
              Share a photo story. It appears in the story row for 24 hours.
            </Text>

            {previewSrc ? (
              <View style={[styles.previewWrap, { backgroundColor: colors.surface.secondary }]}>
                {isUploading ? (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.uploadText, { color: colors.text.primary }]}>Uploading image…</Text>
                  </View>
                ) : null}
                <Image source={{ uri: previewSrc }} style={styles.previewImage} resizeMode="contain" />
                {!isUploading ? (
                  <TouchableOpacity style={styles.removeBtn} onPress={removeAttachment} accessibilityLabel="Remove image">
                    <Icon name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.dropzone, { backgroundColor: colors.surface.secondary, borderColor: colors.border.secondary }]}
                onPress={pickImage}
                activeOpacity={0.8}
              >
                <View style={[styles.plusCircle, { backgroundColor: colors.primary + '22' }]}>
                  <Icon name="add" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.dropzoneTitle, { color: colors.text.primary }]}>Add photo to your story</Text>
                <Text style={[styles.dropzoneHint, { color: colors.text.secondary }]}>Choose an image from your library</Text>
              </TouchableOpacity>
            )}

            {previewSrc ? (
              <TouchableOpacity
                style={[styles.changePhoto, { backgroundColor: colors.surface.secondary }]}
                onPress={pickImage}
                disabled={isUploading}
              >
                <Icon name="photo-library" size={18} color={colors.primary} />
                <Text style={[styles.changePhotoText, { color: colors.text.primary }]}>Choose another photo</Text>
              </TouchableOpacity>
            ) : null}

            {uploadError ? (
              <Text style={styles.errorText}>{uploadError}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: colors.primary },
                !canSubmit && styles.submitDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isUploading || isSubmitting ? (
                <ActivityIndicator size="small" color={colors.text.inverse || '#04222a'} />
              ) : (
                <Icon name="add-circle" size={20} color={colors.text.inverse || '#04222a'} />
              )}
              <Text style={[styles.submitText, { color: colors.text.inverse || '#04222a' }]}>
                {isUploading ? 'Uploading…' : isSubmitting ? 'Sharing…' : 'Share to story'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 16,
    paddingBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  profileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  audienceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 16,
  },
  audienceLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  audienceMenu: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  audienceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  audienceOptionCopy: {
    flex: 1,
  },
  audienceOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  audienceOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  dropzone: {
    minHeight: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginBottom: 12,
  },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  dropzoneTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  dropzoneHint: {
    fontSize: 13,
    marginTop: 4,
  },
  previewWrap: {
    height: 280,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    gap: 8,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
  },
  changePhoto: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 12,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF5A5A',
    fontSize: 13,
    marginBottom: 10,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CreateStoryModal;
