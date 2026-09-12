import React, { useState, useContext, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, Image, Modal, StyleSheet, ActivityIndicator, FlatList, ScrollView } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import api from '../lib/api';
import { ModernButton } from './modern';
import { useModernToast } from '../contexts/ModernToastContext';
import ProfileImage from './ProfileImage';
import { useFeedTokens } from '../theme/feedTokens';
import KeyboardSafeView from './KeyboardSafeView';
import VoiceTextInput from './VoiceTextInput';
import MentionTextInput from './MentionTextInput';
import { generatePostCaption } from '../services/aiAgentService';
import { useSettings } from '../contexts/SettingsContext';

type CreatePostProps = {
  onPostCreated?: (post: any) => void;
  seedCaption?: string;
  seedNonce?: number;
};
type PostData = {
  caption: string;
  urls: string | null;
  gallery: string[];
  type: 'image' | 'video' | null;
  uploadAsWatch: boolean;
  imageDataUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  imageAssets?: Array<{
    uri: string;
    fileName?: string;
    mimeType?: string;
    base64?: string;
  }>;
  location: string;
  feelings: string;
  audience: number;
};

type TagProfile = {
  _id: string;
  fullName?: string;
  displayName?: string;
  username?: string;
  profilePic?: string;
};

const CreatePost = ({ onPostCreated, seedCaption, seedNonce }: CreatePostProps) => {
  const { user } = useContext(AuthContext);
  const { colors: themeColors, isDarkMode } = useTheme();
  const { settings } = useSettings();
  const { showToast } = useModernToast();
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isWritingCaption, setIsWritingCaption] = useState(false);
  // uploadProgress is a number between 0 and 1 while uploading, null otherwise
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isFeelingsPickerVisible, setIsFeelingsPickerVisible] = useState(false);
  const [isAudiencePickerVisible, setIsAudiencePickerVisible] = useState(false);
  const [isTagPickerVisible, setIsTagPickerVisible] = useState(false);
  const [tagProfiles, setTagProfiles] = useState<TagProfile[]>([]);
  const [isLoadingTagProfiles, setIsLoadingTagProfiles] = useState(false);
  const [postData, setPostData] = useState<PostData>({
    caption: '',
    urls: null,
    gallery: [],
    type: null,
    uploadAsWatch: false,
    imageDataUrl: undefined,
    mediaMimeType: undefined,
    mediaFileName: undefined,
      imageAssets: undefined,
    location: '',
    feelings: '',
    audience: 3, // Default: Only Me
  });

  const defaultFeelings: { label: string; value: string; emoji?: string }[] = [
    { label: 'None', value: '' },
    { label: 'Happy', value: 'happy', emoji: '😊' },
    { label: 'Sad', value: 'sad', emoji: '😢' },
    { label: 'Excited', value: 'excited', emoji: '🤩' },
    { label: 'Angry', value: 'angry', emoji: '😡' },
    { label: 'Blessed', value: 'blessed', emoji: '🙏' },
    { label: 'Loved', value: 'loved', emoji: '❤️' },
    { label: 'Grateful', value: 'grateful', emoji: '🥰' },
    { label: 'Bored', value: 'bored', emoji: '🥱' },
    { label: 'Tired', value: 'tired', emoji: '😴' },
    { label: 'Calm', value: 'calm', emoji: '😌' },
    { label: 'Confident', value: 'confident', emoji: '😎' },
    { label: 'Curious', value: 'curious', emoji: '🤔' },
    { label: 'Hopeful', value: 'hopeful', emoji: '🌟' },
    { label: 'Proud', value: 'proud', emoji: '🦁' },
    { label: 'Relaxed', value: 'relaxed', emoji: '😊' },
    { label: 'Silly', value: 'silly', emoji: '🤪' },
    { label: 'Surprised', value: 'surprised', emoji: '😮' },
    { label: 'Worried', value: 'worried', emoji: '😟' },
    { label: 'Motivated', value: 'motivated', emoji: '💪' },
  ];

  const audienceOptions: { label: string; value: number; icon: string }[] = [
    { label: 'Public', value: 1, icon: 'public' },
    { label: 'Connects', value: 2, icon: 'people' },
    { label: 'Only Me', value: 3, icon: 'lock' },
  ];

  const openModal = (prefill?: string) => {
    if (typeof prefill === 'string') {
      setPostData((prev) => ({ ...prev, caption: prefill }));
    }
    setModalVisible(true);
  };
  const closeModal = () => {
    if (isUploading) return;
    setModalVisible(false);
    setPostData({
      caption: '',
      urls: null,
      gallery: [],
      type: null,
      uploadAsWatch: false,
      imageDataUrl: undefined,
      mediaMimeType: undefined,
      mediaFileName: undefined,
      imageAssets: undefined,
      location: '',
      feelings: '',
      audience: 3,
    });
  };

  const handleCaptionChange = (text: string) => setPostData((prev) => ({ ...prev, caption: text }));
  const handleLocationChange = (text: string) => setPostData((prev) => ({ ...prev, location: text }));
  const handleFeelingsChange = (value: string) => setPostData((prev) => ({ ...prev, feelings: value }));
  const handleAudienceChange = (value: number) => setPostData((prev) => ({ ...prev, audience: value }));

  const removeSelectedImage = (index: number) => {
    setPostData((prev) => {
      const remaining = (prev.imageAssets || []).filter((_, assetIndex) => assetIndex !== index);
      return {
        ...prev,
        urls: remaining[0]?.uri || null,
        imageAssets: remaining,
        gallery: [],
        type: remaining.length ? 'image' : null,
      };
    });
  };

  const handleWriteCaption = useCallback(async () => {
    if (isWritingCaption || isUploading) return;

    setIsWritingCaption(true);
    try {
      const currentCaption = postData.caption.trim();
      const hint = currentCaption
        ? `Improve this current caption while preserving its meaning, tone, and key details. Use the attached image as additional context when available. Current caption draft: "${currentCaption}"`
        : postData.type === 'image'
          ? 'Write a warm caption for the attached photo.'
          : postData.type === 'video'
            ? 'Write a short caption for a video I just uploaded.'
            : 'Write a short natural caption for Connect.';

        const caption = await generatePostCaption(
          hint,
          undefined,
          postData.type === 'image' ? postData.imageDataUrl : undefined,
          settings.language === 'bn' ? 'bn' : 'eng',
        );
      if (caption) {
        setPostData((prev) => ({ ...prev, caption }));
      }
    } catch (error) {
      console.warn('Caption generation failed:', error);
      showToast({
        type: 'error',
        title: 'Caption not ready',
        message: 'We could not generate a caption right now, so the draft stayed as-is.',
      });
    } finally {
      setIsWritingCaption(false);
    }
  }, [isUploading, isWritingCaption, postData.caption, postData.imageDataUrl, postData.type, settings.language, showToast]);
  const openFeelingsPicker = () => setIsFeelingsPickerVisible(true);
  const closeFeelingsPicker = () => setIsFeelingsPickerVisible(false);
  const openAudiencePicker = () => setIsAudiencePickerVisible(true);
  const closeAudiencePicker = () => setIsAudiencePickerVisible(false);
  const openTagPicker = async () => {
    setIsTagPickerVisible(true);
    if (tagProfiles.length || isLoadingTagProfiles) return;

    const profileId = user?.profile?._id || user?._id;
    if (!profileId) return;

    setIsLoadingTagProfiles(true);
    try {
      const response = await api.get('/connects/getConnects', { params: { profile: profileId } });
      setTagProfiles(
        Array.isArray(response.data)
          ? response.data.filter((profile): profile is TagProfile => Boolean(profile?._id))
          : [],
      );
    } catch (error) {
      console.error('Unable to load profiles for post tags:', error);
      showToast({
        type: 'error',
        title: 'Profiles unavailable',
        message: 'We could not load your connected profiles right now.',
      });
    } finally {
      setIsLoadingTagProfiles(false);
    }
  };
  const closeTagPicker = () => setIsTagPickerVisible(false);
  const selectTagProfile = (profile: TagProfile) => {
    const displayName = profile.fullName || profile.displayName || profile.username || 'User';
    const mention = `@[${displayName}](${profile._id})`;
    setPostData((prev) => ({
      ...prev,
      caption: `${prev.caption}${prev.caption ? ' ' : ''}${mention} `,
    }));
    closeTagPicker();
  };
  const selectFeeling = (value: string) => {
    handleFeelingsChange(value);
    closeFeelingsPicker();
  };
  const selectAudience = (value: number) => {
    handleAudienceChange(value);
    closeAudiencePicker();
  };

  useEffect(() => {
    if (!seedNonce) return;
    openModal(seedCaption || '');
  }, [seedNonce]);

  const pickMedia = async (mediaType: 'image' | 'video') => {
    // Prevent starting another pick while uploading
    if (isUploading) {
      showToast({ type: 'info', title: 'Please wait', message: 'Upload in progress' });
      return;
    }

    // If a video is already selected, don't allow adding images
    if (mediaType === 'image' && postData.type === 'video') {
      showToast({ type: 'error', title: 'Cannot add image', message: 'Video already selected. A video post is treated as a watch item.' });
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'image' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.Videos,
        quality: 0.7,
        base64: mediaType === 'image',
        allowsEditing: mediaType === 'video',
        allowsMultipleSelection: mediaType === 'image',
      });
      
      if (!result.canceled && result.assets && result.assets[0]) {
        const assets = result.assets;
        const asset = assets[0];
        if (asset.uri) {
          setPostData((prev) => ({
            ...prev,
            urls: mediaType === 'image' && prev.type === 'image'
              ? (prev.imageAssets?.[0]?.uri || prev.urls || asset.uri)
              : asset.uri,
            gallery: [],
            type: mediaType,
            uploadAsWatch: mediaType === 'video' ? prev.uploadAsWatch : false,
            imageDataUrl:
              mediaType === 'image' && asset.base64
                ? `data:image/jpeg;base64,${asset.base64}`
                : undefined,
            mediaMimeType: asset.mimeType || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4'),
            mediaFileName: asset.fileName || `upload.${mediaType === 'image' ? 'jpg' : 'mp4'}`,
            imageAssets: mediaType === 'image'
              ? [
                  ...(prev.type === 'image' ? prev.imageAssets || [] : []),
                  ...assets.map((selectedAsset) => ({
                  uri: selectedAsset.uri,
                  fileName: selectedAsset.fileName,
                  mimeType: selectedAsset.mimeType,
                  base64: selectedAsset.base64,
                  })),
                ]
              : undefined,
          }));
        }
      }
    } catch (error) {
      console.log('ImagePicker Error: ', error);
      showToast({
        type: 'error',
        title: 'Failed to Select Media',
        message: error.message || 'Please try selecting a different file.',
      });
    }
  };

  const handlePostSubmit = useCallback(async () => {
    if (!postData.caption && !postData.urls) return;
    setIsUploading(true);
    try {
      let uploadedUrl = postData.urls;
      let uploadedImageUrls: string[] = [];
      const imageAssets = postData.type === 'image' && postData.imageAssets?.length
        ? postData.imageAssets
        : postData.urls && postData.type === 'image'
          ? [{ uri: postData.urls, fileName: postData.mediaFileName, mimeType: postData.mediaMimeType }]
          : [];
      if (postData.type === 'image' && imageAssets.length) {
        for (const imageAsset of imageAssets) {
          if (!imageAsset.uri || /^https?:\/\//i.test(imageAsset.uri)) {
            uploadedImageUrls.push(imageAsset.uri);
            continue;
          }
          const formData = new FormData();
          const fileData = {
            uri: imageAsset.uri,
            name: imageAsset.fileName || 'upload.jpg',
            type: imageAsset.mimeType || 'image/jpeg',
          } as any;
          formData.append('image', fileData);
          const uploadRes = await api.post('/upload/', formData, {
            onUploadProgress: (progressEvent: any) => {
              if (progressEvent?.total) setUploadProgress(progressEvent.loaded / progressEvent.total);
            },
          });
          const imageUrl = uploadRes.data.secure_url || uploadRes.data.url;
          if (uploadRes.status !== 200 || !imageUrl) throw new Error('Image upload successful but no URL returned');
          uploadedImageUrls.push(imageUrl);
        }
        uploadedUrl = uploadedImageUrls[0] || '';
      } else if (postData.urls && typeof postData.urls === 'string' && !/^https?:\/\//i.test(postData.urls)) {
        // Validate file URI
        if (!postData.urls || postData.urls.trim() === '') {
          throw new Error('Invalid file URI');
        }
        // Upload file
        const formData = new FormData();
        const fileData = {
          uri: postData.urls,
          name: postData.mediaFileName || `upload.${postData.type === 'image' ? 'jpg' : 'mp4'}`,
          type: postData.mediaMimeType || (postData.type === 'image' ? 'image/jpeg' : 'video/mp4'),
        } as any;
        
        // Validate file type
        if (!postData.type || (postData.type !== 'image' && postData.type !== 'video')) {
          throw new Error('Invalid file type');
        }
        
        // Validate MIME type while allowing formats returned by the device picker.
        const expectedMimePrefix = postData.type === 'image' ? 'image/' : 'video/';
        if (!fileData.type.startsWith(expectedMimePrefix)) {
          throw new Error(`Invalid MIME type: expected ${expectedMimePrefix}*, got ${fileData.type}`);
        }
        
        let uploadEndpoint = '/upload/';
        let fieldName = 'image';
        
        if (postData.type === 'video') {
          uploadEndpoint = '/upload/video';
          fieldName = 'attachment';
        } else if (postData.type === 'image') {
          uploadEndpoint = '/upload/';
          fieldName = 'image';
        }
        
        formData.append(fieldName, fileData);
        
        console.log('Uploading to:', uploadEndpoint);
        console.log('Field name:', fieldName);
        console.log('File data:', fileData);
        
        setUploadProgress(0);
        const uploadRes = await api.post(uploadEndpoint, formData, {
          onUploadProgress: (progressEvent: any) => {
            try {
              if (progressEvent && progressEvent.total) {
                setUploadProgress(progressEvent.loaded / progressEvent.total);
              }
            } catch (err) {
              // ignore progress errors
            }
          },
        });
        if (uploadRes.status === 200) {
          uploadedUrl = uploadRes.data.secure_url || uploadRes.data.url;
          if (!uploadedUrl) {
            throw new Error('Upload successful but no URL returned');
          }
          console.log('Upload successful:', uploadRes.data);
        } else {
          console.log('Upload failed with status:', uploadRes.status);
          throw new Error(`Upload failed with status: ${uploadRes.status}`);
        }
      }
      const isWatchPost = postData.type === 'video' && postData.uploadAsWatch;
      let res;

      if (isWatchPost) {
        res = await api.post('/watch/create', {
          caption: postData.caption,
          videoUrl: uploadedUrl || '',
          feeling: postData.feelings,
          audience: postData.audience,
        });
      } else {
        const postFormData = new FormData();
        postFormData.append('caption', postData.caption);
        postFormData.append('photos', uploadedUrl || '');
        postFormData.append('gallery', JSON.stringify(postData.type === 'image' ? uploadedImageUrls.slice(1) : []));
        postFormData.append('type', postData.type || 'post');
        postFormData.append('feelings', postData.feelings);
        postFormData.append('location', postData.location);
        postFormData.append('audience', String(postData.audience || 3));
        res = await api.post('/post/create', postFormData);
      }

      if (res.status === 200) {
        if (!isWatchPost && onPostCreated) onPostCreated(res.data.post);
        closeModal();
        showToast({
          type: 'success',
          title: 'Post Created!',
          message: 'Your post has been shared successfully.',
        });
      }
    } catch (e: any) {
      console.log('Error creating post:', e);
      const providerBlocked = e?.response?.data?.code === 'MEDIA_PROVIDER_BLOCKED';
      showToast({
        type: 'error',
        title: 'Failed to Create Post',
        message: providerBlocked
          ? 'Media uploads are temporarily unavailable. Please try again after the storage provider review is resolved.'
          : e?.response?.data?.message ||
            e?.response?.data?.error ||
            'Something went wrong. Please try again.',
      });
    } finally {
      // clear progress UI
      setUploadProgress(null);
      setIsUploading(false);
    }
  }, [postData, onPostCreated]);

  const profileName = user ? `${user.firstName || ''} ${user.surname || ''}` : '';
  const textInputPlaceholder = `What's On Your Mind ${user?.firstName || 'there'}?`;

  // Theme colors
  const feed = useFeedTokens();
  const cardBg = themeColors.surface.primary;
  const modalBg = themeColors.surface.primary;
  const textColor = themeColors.text.primary;
  const inputBg = themeColors.surface.secondary;
  const inputText = themeColors.text.primary;
  const borderColor = themeColors.border.primary;

  return (
    <View style={[styles.composerCard, { backgroundColor: feed.composerBg, borderColor: feed.cardBorder }]}>
      <View style={[styles.topRow, { borderBottomColor: feed.postDivider }]}>
        <View style={styles.profilePicWrapper}>
          {user?.profile?.profilePic ? (
            <ProfileImage uri={user.profile.profilePic} pixelSize={80} style={[styles.profilePic, { backgroundColor: feed.composerField }]} />
          ) : (
            <Image source={require('../assets/images/logo.png')} style={[styles.profilePic, { backgroundColor: feed.composerField }]} />
          )}
        </View>
        <TouchableOpacity
          style={[styles.inputWrapper, { backgroundColor: feed.composerField, borderColor: feed.postBorder }]}
          onPress={() => openModal()}
          activeOpacity={0.7}
        >
          <Text style={[styles.inputPlaceholder, { color: feed.postTextMuted }]} numberOfLines={1}>{textInputPlaceholder}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomRow}>
        <TouchableOpacity
          style={styles.composerAction}
          onPress={() => { openModal(); pickMedia('image'); }}
          activeOpacity={0.75}
        >
          <Icon name="photo-library" size={22} color="#45bd62" />
          <Text style={[styles.composerActionText, { color: feed.postText }]}>Photo/video</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.composerAction}
          onPress={() => { openModal(); pickMedia('video'); }}
          activeOpacity={0.75}
        >
          <Icon name="videocam" size={22} color="#f3425f" />
          <Text style={[styles.composerActionText, { color: feed.postText }]}>Live Video</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardSafeView force>
        <View style={styles.modalOverlay}>
          <Pressable style={[StyleSheet.absoluteFill, styles.pickerBackdrop]} onPress={closeModal} />
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]} numberOfLines={1}>Create a Post</Text>
              <TouchableOpacity
                onPress={closeModal}
                style={[styles.closeButton, { backgroundColor: feed.chipBg, borderColor: feed.postBorder }]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Icon name="close" size={22} color={textColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.cpmHeader}>
                {user?.profile?.profilePic ? (
                  <ProfileImage uri={user.profile.profilePic} pixelSize={80} style={styles.profilePic} />
                ) : (
                  <Image source={require('../assets/images/logo.png')} style={styles.profilePic} />
                )}
                <Text style={[styles.profileName, { color: textColor }]}>{profileName}</Text>
              </View>
              <View style={styles.feelingsLocationRow}>
                <View style={styles.feelingsContainer}>
                  <Text style={[styles.label, { color: textColor }]}>Feelings:</Text>
                  <TouchableOpacity
                    onPress={openFeelingsPicker}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, flexDirection: 'row', alignItems: 'center' }]}
                  >
                    <Icon name="mood" size={18} color={themeColors.primary} />
                    <Text style={{ marginLeft: 8, color: inputText }}>
                      {postData.feelings
                        ? defaultFeelings.find(f => f.value === postData.feelings)?.label || postData.feelings
                        : 'Select feeling'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.locationContainer}>
                  <Text style={[styles.label, { color: textColor }]}>Location:</Text>
                  <VoiceTextInput
                    style={[styles.input, { backgroundColor: inputBg, color: inputText, borderColor }]}
                    placeholder="Location..."
                    placeholderTextColor={isDarkMode ? themeColors.gray[400] : themeColors.gray[600]}
                    value={postData.location}
                    onChangeText={handleLocationChange}
                  />
                </View>
              </View>
              <View style={styles.tagAudienceRow}>
                <View style={styles.tagContainer}>
                  <Text style={[styles.label, { color: textColor }]}>Tag:</Text>
                  <TouchableOpacity
                    onPress={openTagPicker}
                    style={[
                      styles.metaPill,
                      {
                        backgroundColor: postData.caption.includes('@[')
                          ? `${themeColors.primary}22`
                          : inputBg,
                        borderColor: postData.caption.includes('@[')
                          ? themeColors.primary
                          : borderColor,
                      },
                    ]}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel="Tag profiles"
                  >
                    <Icon name="person-add" size={17} color={themeColors.primary} />
                    <Text numberOfLines={1} style={[styles.metaPillText, { color: inputText }]}>
                      {postData.caption.includes('@[') ? 'Profiles tagged' : 'Tag profiles'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.audienceContainer}>
                  <Text style={[styles.label, { color: textColor }]}>Audience:</Text>
                  <TouchableOpacity
                    onPress={openAudiencePicker}
                    style={[styles.input, { backgroundColor: inputBg, borderColor, flexDirection: 'row', alignItems: 'center' }]}
                  >
                    <Icon name={audienceOptions.find(a => a.value === postData.audience)?.icon || 'public'} size={18} color={themeColors.primary} />
                    <Text numberOfLines={1} style={{ marginLeft: 8, color: inputText }}>
                      {audienceOptions.find(a => a.value === postData.audience)?.label || 'Public'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.captionActionRow}>
                <Text style={[styles.label, { color: textColor }]}>Caption:</Text>
              </View>
              <MentionTextInput
                myProfileId={user?.profile?._id || user?._id}
                style={[styles.captionInput, { backgroundColor: inputBg, color: inputText, borderColor }]}
                placeholder={textInputPlaceholder}
                placeholderTextColor={isDarkMode ? themeColors.gray[400] : themeColors.gray[600]}
                value={postData.caption}
                onChangeText={handleCaptionChange}
                multiline
                rightAccessory={
                  <TouchableOpacity
                    onPress={handleWriteCaption}
                    disabled={isWritingCaption || isUploading}
                    accessibilityRole="button"
                    accessibilityLabel={isWritingCaption ? 'Writing caption with AI' : 'Write caption with AI'}
                    hitSlop={8}
                    style={{ paddingHorizontal: 8 }}
                  >
                    <Icon
                      name="auto-awesome"
                      size={20}
                      color={isWritingCaption ? themeColors.gray[400] : themeColors.primary}
                    />
                  </TouchableOpacity>
                }
              />
              {postData.type === 'image' && postData.urls && (
                <View style={styles.attachmentGalleryPreview}>
                  {(postData.imageAssets?.length
                    ? postData.imageAssets
                    : [{ uri: postData.urls }]
                  ).map((asset, index) => (
                    <View
                      key={`${asset.uri}-${index}`}
                      style={[
                        styles.attachmentGalleryItem,
                        (postData.imageAssets?.length || 1) === 1 &&
                          styles.attachmentGallerySingleItem,
                      ]}
                    >
                      <Image
                        source={{ uri: asset.uri }}
                        style={[
                          styles.attachmentGalleryImage,
                          (postData.imageAssets?.length || 1) === 1 &&
                            styles.attachmentGallerySingleImage,
                        ]}
                      />
                      <TouchableOpacity
                        style={styles.removePreviewButton}
                        onPress={() => removeSelectedImage(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove image ${index + 1}`}
                        disabled={isUploading}
                      >
                        <Icon name="close" size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              {postData.type === 'image' && postData.urls && (
                <TouchableOpacity
                  style={[styles.addMoreImagesButton, { borderColor, backgroundColor: inputBg }]}
                  onPress={() => pickMedia('image')}
                  disabled={isUploading}
                  accessibilityRole="button"
                  accessibilityLabel="Add more images"
                >
                  <Icon name="add-photo-alternate" size={20} color={themeColors.primary} />
                  <Text style={[styles.addMoreImagesText, { color: textColor }]}>Add more images</Text>
                </TouchableOpacity>
              )}
              {postData.urls && postData.type === 'video' && (
                <View style={{ marginVertical: 8 }}>
                  {isUploading ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <ActivityIndicator size="small" color={themeColors.primary} />
                        <Text style={{ color: themeColors.primary, marginLeft: 8, fontWeight: '600' }}>
                          {uploadProgress === null ? 'Uploading video...' : 'Uploading video'}
                        </Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: themeColors.gray?.[300] || '#eee', borderRadius: 6, overflow: 'hidden' }}>
                        <View
                          style={{
                            width: `${Math.min(100, Math.max(0, Math.round((uploadProgress || 0) * 100)))}%`,
                            height: '100%',
                            backgroundColor: themeColors.primary,
                          }}
                        />
                      </View>
                      <Text style={{ color: themeColors.primary, marginTop: 6 }}>
                        {uploadProgress === null ? 'Preparing upload...' : `${Math.round(uploadProgress * 100)}% uploaded`}
                      </Text>
                    </>
                  ) : (
                    <Text style={{ color: themeColors.primary }}>Video selected</Text>
                  )}
                </View>
              )}
              {postData.type === 'video' && (
                <TouchableOpacity
                  onPress={() => setPostData((prev) => ({ ...prev, uploadAsWatch: !prev.uploadAsWatch }))}
                  disabled={isUploading}
                  style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: postData.uploadAsWatch, disabled: isUploading }}
                >
                  <Icon
                    name={postData.uploadAsWatch ? 'check-box' : 'check-box-outline-blank'}
                    size={24}
                    color={postData.uploadAsWatch ? themeColors.primary : themeColors.text.secondary}
                  />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={{ color: textColor, fontWeight: '600' }}>Upload as Watch</Text>
                    <Text style={{ color: themeColors.text.secondary, fontSize: 12 }}>
                      Share this video in Watch
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              <View style={styles.attachmentRow}>
                <ModernButton
                  title="Add Photo"
                  onPress={() => pickMedia('image')}
                  variant="glass"
                  size="small"
                  icon={<Icon name="photo-camera" size={18} color={themeColors.primary} />}
                  style={{ flex: 1, marginRight: 8 }}
                  disabled={isUploading || postData.type === 'video'}
                />
                <ModernButton
                  title="Add Video"
                  onPress={() => pickMedia('video')}
                  variant="glass"
                  size="small"
                  icon={<Icon name="videocam" size={18} color={themeColors.primary} />}
                  style={{ flex: 1 }}
                  disabled={isUploading}
                />
              </View>
              <ModernButton
                title={isUploading ? "Posting..." : "Post Now"}
                onPress={handlePostSubmit}
                disabled={isUploading}
                loading={isUploading}
                variant="primary"
                fullWidth
                icon={!isUploading ? <Icon name="send" size={20} color="#FFFFFF" /> : undefined}
                style={{ marginTop: 16 }}
              />
            </View>
            </ScrollView>
          </View>
          {isAudiencePickerVisible ? (
            <View style={[StyleSheet.absoluteFill, styles.pickerOverlay]}>
              <Pressable style={[StyleSheet.absoluteFill, styles.pickerBackdrop]} onPress={closeAudiencePicker} />
              <View style={[styles.modalContent, styles.pickerContent, { backgroundColor: modalBg }]}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Select Audience</Text>
                <FlatList
                  data={audienceOptions}
                  keyExtractor={(item) => item.value.toString()}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => selectAudience(item.value)}
                      style={{ paddingVertical: 14, flexDirection: 'row', alignItems: 'center' }}
                      activeOpacity={0.7}
                    >
                      <Icon name={item.icon} size={20} color={themeColors.primary} style={{ marginRight: 12 }} />
                      <Text style={{ color: textColor, fontSize: 16 }}>{item.label}</Text>
                      {postData.audience === item.value && (
                        <Icon name="check" size={20} color={themeColors.primary} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: borderColor }} />}
                />
              </View>
            </View>
          ) : null}
          {isFeelingsPickerVisible ? (
            <View style={[StyleSheet.absoluteFill, styles.pickerOverlay]}>
              <Pressable style={[StyleSheet.absoluteFill, styles.pickerBackdrop]} onPress={closeFeelingsPicker} />
              <View style={[styles.modalContent, styles.pickerContent, { backgroundColor: modalBg }]}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Select Feeling</Text>
                <FlatList
                  data={defaultFeelings}
                  keyExtractor={(item) => item.value}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => selectFeeling(item.value)}
                      style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
                      activeOpacity={0.7}
                    >
                      {item.emoji ? <Text style={{ fontSize: 18, marginRight: 8 }}>{item.emoji}</Text> : null}
                      <Text style={{ color: textColor, fontSize: 16 }}>{item.label}</Text>
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: borderColor }} />}
                />
              </View>
            </View>
          ) : null}
          {isTagPickerVisible ? (
            <View style={[StyleSheet.absoluteFill, styles.pickerOverlay]}>
              <Pressable style={[StyleSheet.absoluteFill, styles.pickerBackdrop]} onPress={closeTagPicker} />
              <View style={[styles.modalContent, styles.pickerContent, { backgroundColor: modalBg }]}>
                <Text style={[styles.modalTitle, { color: textColor }]}>Tag profiles</Text>
                {isLoadingTagProfiles ? (
                  <ActivityIndicator color={themeColors.primary} />
                ) : (
                  <FlatList
                    data={tagProfiles}
                    keyExtractor={(item) => item._id}
                    ListEmptyComponent={
                      <Text style={[styles.emptyPickerText, { color: themeColors.gray[500] }]}>
                        No connected profiles to tag yet.
                      </Text>
                    }
                    renderItem={({ item }) => {
                      const displayName = item.fullName || item.displayName || item.username || 'User';
                      return (
                        <TouchableOpacity
                          onPress={() => selectTagProfile(item)}
                          style={styles.tagProfileOption}
                          activeOpacity={0.7}
                        >
                          {item.profilePic ? (
                            <ProfileImage uri={item.profilePic} pixelSize={64} style={styles.tagProfileImage} />
                          ) : (
                            <View style={[styles.tagProfileFallback, { backgroundColor: `${themeColors.primary}22` }]}>
                              <Icon name="person" size={20} color={themeColors.primary} />
                            </View>
                          )}
                          <View style={styles.tagProfileCopy}>
                            <Text style={{ color: textColor, fontSize: 16, fontWeight: '600' }}>{displayName}</Text>
                            {item.username ? (
                              <Text style={{ color: themeColors.gray[500], marginTop: 2 }}>@{item.username}</Text>
                            ) : null}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                    ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: borderColor }} />}
                  />
                )}
              </View>
            </View>
          ) : null}
        </View>
        </KeyboardSafeView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  composerCard: {
    padding: 10,
    borderRadius: 12,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  container: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    margin: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  profilePicWrapper: {
    marginRight: 12,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 40,
  },
  inputPlaceholder: {
    fontSize: 14,
    fontWeight: '400',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  composerAction: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  composerActionText: {
    marginTop: 4,
    fontWeight: '600',
    fontSize: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flex: 1,
    justifyContent: 'center',
  },
  buttonText: {
    marginLeft: 8,
    color: '#29b1a9',
    fontWeight: '600',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerOverlay: {
    zIndex: 20,
    elevation: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBackdrop: {
    zIndex: 0,
  },
  modalContent: {
    width: '95%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    maxHeight: '90%',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    zIndex: 1,
  },
  pickerContent: {
    zIndex: 1,
    elevation: 21,
  },
  tagProfileOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  tagProfileImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  tagProfileFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagProfileCopy: {
    flex: 1,
    marginLeft: 12,
  },
  emptyPickerText: {
    paddingVertical: 18,
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {},
  cpmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileName: {
    marginLeft: 10,
    fontWeight: 'bold',
    fontSize: 16,
  },
  feelingsLocationRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  tagAudienceRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 8,
  },
  tagContainer: {
    flex: 1,
  },
  metaPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metaPillText: {
    marginLeft: 6,
    flexShrink: 1,
    fontSize: 14,
  },
  captionActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feelingsContainer: {
    flex: 1,
    marginRight: 8,
  },
  locationContainer: {
    flex: 1,
  },
  audienceContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
  },
  input: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#F1F3F4',
    fontSize: 14,
  },
  captionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#F1F3F4',
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    textAlignVertical: 'top',
  },
  attachmentPreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  attachmentGalleryPreview: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  attachmentGalleryImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  attachmentGalleryItem: {
    width: '49%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  attachmentGallerySingleImage: {
    borderRadius: 8,
  },
  attachmentGallerySingleItem: {
    width: '100%',
    height: 200,
  },
  removePreviewButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  addMoreImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 42,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
  addMoreImagesText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 18,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  attachmentButtonText: {
    marginLeft: 8,
    color: '#29b1a9',
    fontWeight: '600',
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#29b1a9',
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2,
    shadowColor: '#29b1a9',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F3F4',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#F1F3F4',
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#29b1a9',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderWidth: 1,
  },
});

export default CreatePost; 