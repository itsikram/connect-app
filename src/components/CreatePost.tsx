import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, Asset, ImageLibraryOptions } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import api from '../lib/api';
// Modern components
import { ModernCard, ModernButton, ModernInput } from './modern';
import { useModernToast } from '../contexts/ModernToastContext';

type CreatePostProps = {
  onPostCreated?: (post: any) => void;
};
type PostData = {
  caption: string;
  urls: string | null;
  type: 'image' | 'video' | null;
  location: string;
  feelings: string;
};

const CreatePost = ({ onPostCreated }: CreatePostProps) => {
  const { user } = useContext(AuthContext);
  const { colors: themeColors, isDarkMode } = useTheme();
  const { showToast } = useModernToast();
  const navigation = useNavigation();
  
  const [isModalVisible, setModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isFeelingsPickerVisible, setIsFeelingsPickerVisible] = useState(false);
  const [postData, setPostData] = useState<PostData>({
    caption: '',
    urls: null,
    type: null,
    location: '',
    feelings: '',
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
  ];

  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setPostData({ caption: '', urls: null, type: null, location: '', feelings: '' });
  };

  const handleCaptionChange = (text: string) => setPostData((prev) => ({ ...prev, caption: text }));
  const handleLocationChange = (text: string) => setPostData((prev) => ({ ...prev, location: text }));
  const handleFeelingsChange = (value: string) => setPostData((prev) => ({ ...prev, feelings: value }));
  const openFeelingsPicker = () => setIsFeelingsPickerVisible(true);
  const closeFeelingsPicker = () => setIsFeelingsPickerVisible(false);
  const selectFeeling = (value: string) => {
    handleFeelingsChange(value);
    closeFeelingsPicker();
  };

  const pickMedia = async (mediaType: 'image' | 'video') => {
    const options: ImageLibraryOptions = {
      mediaType: mediaType === 'image' ? 'photo' : 'video',
      quality: 0.7,
      selectionLimit: 1,
    };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
        showToast({
          type: 'error',
          title: 'Failed to Select Media',
          message: response.errorMessage || 'Please try selecting a different file.',
        });
        return;
      }
      const asset: Asset | undefined = response.assets && response.assets[0];
      if (asset && asset.uri) {
        setPostData((prev) => ({ ...prev, urls: asset.uri ?? null, type: mediaType }));
      }
    });
  };

  const handlePostSubmit = useCallback(async () => {
    if (!postData.caption && !postData.urls) return;
    setIsUploading(true);
    try {
      let uploadedUrl = postData.urls;
      if (postData.urls && typeof postData.urls === 'string' && postData.urls.startsWith('file://')) {
        // Validate file URI
        if (!postData.urls || postData.urls.trim() === '') {
          throw new Error('Invalid file URI');
        }
        // Upload file
        const formData = new FormData();
        const fileData = {
          uri: postData.urls,
          name: `upload.${postData.type === 'image' ? 'jpg' : 'mp4'}`,
          type: postData.type === 'image' ? 'image/jpeg' : 'video/mp4',
        } as any;
        
        // Validate file type
        if (!postData.type || (postData.type !== 'image' && postData.type !== 'video')) {
          throw new Error('Invalid file type');
        }
        
        // Validate MIME type
        const expectedMimeType = postData.type === 'image' ? 'image/jpeg' : 'video/mp4';
        if (fileData.type !== expectedMimeType) {
          throw new Error(`Invalid MIME type: expected ${expectedMimeType}, got ${fileData.type}`);
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
        
        const uploadRes = await api.post(uploadEndpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
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
      // Create post
      const postFormData = new FormData();
      postFormData.append('caption', postData.caption);
      postFormData.append('photos', uploadedUrl || '');
      postFormData.append('feelings', postData.feelings);
      postFormData.append('location', postData.location);
      const res = await api.post('/post/create', postFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.status === 200) {
        if (onPostCreated) onPostCreated(res.data.post);
        closeModal();
        showToast({
          type: 'success',
          title: 'Post Created!',
          message: 'Your post has been shared successfully.',
        });
      }
    } catch (e: any) {
      console.log('Error creating post:', e);
      showToast({
        type: 'error',
        title: 'Failed to Create Post',
        message: e?.response?.data?.message || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  }, [postData, onPostCreated]);

  const profileName = user ? `${user.firstName || ''} ${user.surname || ''}` : '';
  const textInputPlaceholder = `What's On Your Mind ${user?.firstName || 'there'}?`;

  // Theme colors
  const cardBg = themeColors.surface.primary;
  const modalBg = themeColors.surface.primary;
  const textColor = themeColors.text.primary;
  const inputBg = themeColors.surface.secondary;
  const inputText = themeColors.text.primary;
  const borderColor = themeColors.border.primary;

  return (
    <ModernCard variant="elevated" padding="medium" margin="small">
      <View style={styles.topRow}>
        <View style={styles.profilePicWrapper}>
          <Image source={user?.profile?.profilePic ? { uri: user.profile.profilePic } : require('../assets/image/logo.png')} style={styles.profilePic} />
        </View>
        <TouchableOpacity 
          style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: borderColor }]} 
          onPress={openModal}
          activeOpacity={0.7}
        >
          <Text style={[styles.inputPlaceholder, { color: textColor }]}>{textInputPlaceholder}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomRow}>
        <ModernButton
          title="Photo/Video"
          onPress={() => { openModal(); pickMedia('image'); }}
          variant="modern"
          size="small"
          icon={<Icon name="photo-camera" size={20} color={themeColors.primary} />}
          style={{ flex: 1, marginRight: 8 }}
        />
        <ModernButton
          title="Camera"
          onPress={() => (navigation as any).navigate('Camera')}
          variant="modern"
          size="small"
          icon={<Icon name="camera-alt" size={20} color={themeColors.primary} />}
          style={{ flex: 1, marginRight: 8 }}
        />
        <ModernButton
          title="Live Video"
          onPress={() => { openModal(); pickMedia('video'); }}
          variant="modern"
          size="small"
          icon={<Icon name="videocam" size={20} color={themeColors.primary} />}
          style={{ flex: 1 }}
        />
      </View>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <TouchableOpacity style={[styles.modalContent, { backgroundColor: modalBg }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 }]}>
              <Text style={[styles.modalTitle, { color: textColor, fontSize: 20, fontWeight: '600', fontFamily: 'Inter-SemiBold' }]}>Create a Post</Text>
              <ModernButton
                title=""
                onPress={closeModal}
                variant="ghost"
                size="small"
                icon={<Icon name="close" size={20} color={textColor} />}
                style={{ width: 40, height: 40, padding: 0 }}
              />
            </View>
            <View style={styles.modalBody}>
              <View style={styles.cpmHeader}>
                <Image source={user?.profile?.profilePic ? { uri: user.profile.profilePic } : require('../assets/image/logo.png')} style={styles.profilePic} />
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
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: inputText, borderColor }]}
                    placeholder="Location..."
                    placeholderTextColor={isDarkMode ? themeColors.gray[400] : themeColors.gray[600]}
                    value={postData.location}
                    onChangeText={handleLocationChange}
                  />
                </View>
              </View>
              <TextInput
                style={[styles.captionInput, { backgroundColor: inputBg, color: inputText, borderColor }]}
                placeholder={textInputPlaceholder}
                placeholderTextColor={isDarkMode ? themeColors.gray[400] : themeColors.gray[600]}
                value={postData.caption}
                onChangeText={handleCaptionChange}
                multiline
              />
              {postData.urls && postData.type === 'image' && (
                <Image source={{ uri: postData.urls }} style={styles.attachmentPreview} />
              )}
              {postData.urls && postData.type === 'video' && (
                <Text style={{ color: themeColors.primary, marginVertical: 8 }}>Video selected</Text>
              )}
              <View style={styles.attachmentRow}>
                <ModernButton
                  title="Add Photo"
                  onPress={() => pickMedia('image')}
                  variant="glass"
                  size="small"
                  icon={<Icon name="photo-camera" size={18} color={themeColors.primary} />}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <ModernButton
                  title="Camera"
                  onPress={() => { closeModal(); (navigation as any).navigate('Camera'); }}
                  variant="glass"
                  size="small"
                  icon={<Icon name="camera-alt" size={18} color={themeColors.primary} />}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <ModernButton
                  title="Add Video"
                  onPress={() => pickMedia('video')}
                  variant="glass"
                  size="small"
                  icon={<Icon name="videocam" size={18} color={themeColors.primary} />}
                  style={{ flex: 1 }}
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={isFeelingsPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={closeFeelingsPicker}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeFeelingsPicker}>
          <View style={[styles.modalContent, { backgroundColor: modalBg }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Select Feeling</Text>
            <FlatList
              data={defaultFeelings}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectFeeling(item.value)}
                  style={{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center' }}
                >
                  {item.emoji ? <Text style={{ fontSize: 18, marginRight: 8 }}>{item.emoji}</Text> : null}
                  <Text style={{ color: textColor, fontSize: 16 }}>{item.label}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: borderColor }} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </ModernCard>
  );
};

const styles = StyleSheet.create({
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
    marginBottom: 2,
  },
  profilePicWrapper: {
    marginRight: 12,
  },
  profilePic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E5EA',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputPlaceholder: {
    color: '#6C757D',
    fontSize: 15,
    fontWeight: '400',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#212529',
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
  feelingsContainer: {
    flex: 1,
    marginRight: 8,
  },
  locationContainer: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
  },
  input: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    fontSize: 14,
  },
  captionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#E9ECEF',
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
    borderColor: '#E9ECEF',
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
    borderColor: '#E9ECEF',
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
    borderColor: '#E9ECEF',
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#29b1a9',
    fontWeight: '600',
    fontSize: 14,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
});

export default CreatePost; 