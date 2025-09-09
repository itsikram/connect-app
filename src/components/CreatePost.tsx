import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, Asset, ImageLibraryOptions } from 'react-native-image-picker';
import api from '../lib/api';
import { UI } from '../lib/config';

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
      }
    } catch (e) {
      console.log('Error creating post:', e);
      // You might want to show an error message to the user here
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
    <View style={[styles.container, { backgroundColor: cardBg }]}> 
      <View style={styles.topRow}> 
        <View style={styles.profilePicWrapper}>

          <Image source={user?.profile?.profilePic ? { uri: user.profile.profilePic } : require('../assets/image/logo.png')} style={styles.profilePic} />
        </View>
        <TouchableOpacity style={[styles.inputWrapper, { backgroundColor: inputBg }]} onPress={openModal}>
          <Text style={[styles.inputPlaceholder, { color: textColor }]}>{textInputPlaceholder}</Text>
        </TouchableOpacity>
      </View>
        <View style={styles.bottomRow}> 
          <TouchableOpacity style={[styles.button, { backgroundColor: inputBg }]} onPress={() => { openModal(); pickMedia('image'); }}>
            <Icon name="photo-camera" size={UI.icon.lg} color={themeColors.primary} />
            <Text style={[styles.buttonText, { color: themeColors.primary }]}>Photo/Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: inputBg }]} onPress={() => { openModal(); pickMedia('video'); }}>
            <Icon name="videocam" size={UI.icon.lg} color={themeColors.primary} />
            <Text style={[styles.buttonText, { color: themeColors.primary }]}>Live Video</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.actionRow, { borderBottomWidth: 0 }]}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: inputBg }]} 
            onPress={() => { openModal(); openFeelingsPicker(); }}
          >
            <Icon name="mood" size={20} color={themeColors.primary} />
            <Text style={styles.actionButtonText}>Feeling</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: inputBg }]} 
            onPress={() => { openModal(); }}
          >
            <Icon name="location-on" size={20} color={themeColors.primary} />
            <Text style={styles.buttonText}>Check in</Text>
          </TouchableOpacity>
        </View>
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
          <TouchableOpacity style={[styles.modalContent, { backgroundColor: modalBg }]} activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}> 
              <Text style={[styles.modalTitle, { color: textColor }]}>Create a Post</Text>
              <TouchableOpacity onPress={closeModal} style={[styles.closeButton, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                <Icon name="close" size={24} color={textColor} />
              </TouchableOpacity>
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
                    <Icon name="mood" size={UI.icon.md} color={themeColors.primary} />
                    <Text style={{ marginLeft: UI.spacing.sm, color: inputText }}>
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
                <Text style={{ color: themeColors.primary, marginVertical: UI.spacing.sm }}>Video selected</Text>
              )}
              <View style={styles.attachmentRow}>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: inputBg }]} onPress={() => pickMedia('image')}>
                  <Icon name="photo-camera" size={UI.icon.lg} color={themeColors.primary} />
                  <Text style={[styles.attachmentButtonText, { color: themeColors.primary }]}>Add Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: inputBg }]} onPress={() => pickMedia('video')}>
                  <Icon name="videocam" size={UI.icon.lg} color={themeColors.primary} />
                  <Text style={[styles.attachmentButtonText, { color: themeColors.primary }]}>Add Video</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.submitButton, isUploading && { backgroundColor: themeColors.gray[400] }]}
                onPress={handlePostSubmit}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>Post Now</Text>
                )}
              </TouchableOpacity>
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
                  style={{ paddingVertical: UI.spacing.sm + 2, flexDirection: 'row', alignItems: 'center' }}
                >
                  {item.emoji ? <Text style={{ fontSize: UI.icon.lg, marginRight: UI.spacing.sm }}>{item.emoji}</Text> : null}
                  <Text style={{ color: textColor, fontSize: UI.typography.body + 2 }}>{item.label}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: borderColor }} />}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: UI.spacing.md,
    borderRadius: UI.radius.md,
    margin: UI.spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: UI.spacing.xs,
  },
  profilePicWrapper: {
    marginRight: UI.spacing.md,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: UI.radius.pill,
    paddingVertical: UI.spacing.sm + 2,
    paddingHorizontal: UI.spacing.lg,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    color: '#AEAEB2',
    fontSize: UI.typography.body,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: UI.spacing.sm,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: UI.radius.pill,
    paddingVertical: UI.spacing.sm,
    paddingHorizontal: UI.spacing.lg,
    flex: 0.48,
    justifyContent: 'center',
  },
  buttonText: {
    marginLeft: UI.spacing.sm - 2,
    color: '#29b1a9',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    backgroundColor: '#fff',
    borderRadius: UI.radius.lg,
    padding: UI.spacing.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: UI.spacing.md,
    paddingBottom: UI.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: UI.typography.title,
    fontWeight: 'bold',
  },
  modalBody: {},
  cpmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: UI.spacing.sm,
  },
  profileName: {
    marginLeft: UI.spacing.md,
    fontWeight: 'bold',
    fontSize: UI.typography.body + 2,
  },
  feelingsLocationRow: {
    flexDirection: 'row',
    marginBottom: UI.spacing.sm,
  },
  feelingsContainer: {
    flex: 1,
    marginRight: UI.spacing.sm,
  },
  locationContainer: {
    flex: 1,
  },
  label: {
    fontSize: UI.typography.caption,
    color: '#8E8E93',
    marginBottom: 2,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: UI.radius.sm,
    backgroundColor: '#F2F2F2',
  },
  input: {
    padding: UI.spacing.sm,
    borderRadius: UI.radius.sm,
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    fontSize: UI.typography.body,
  },
  captionInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: UI.radius.sm,
    backgroundColor: '#F2F2F2',
    padding: UI.spacing.sm + 2,
    fontSize: UI.typography.body + 1,
    marginBottom: UI.spacing.sm,
  },
  attachmentPreview: {
    width: '100%',
    height: 180,
    borderRadius: UI.radius.sm,
    marginBottom: UI.spacing.sm,
    resizeMode: 'cover',
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: UI.spacing.sm,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: UI.radius.pill,
    paddingVertical: UI.spacing.sm,
    paddingHorizontal: UI.spacing.lg,
    flex: 0.48,
    justifyContent: 'center',
  },
  attachmentButtonText: {
    marginLeft: UI.spacing.sm - 2,
    color: '#29b1a9',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#29b1a9',
    borderRadius: UI.radius.pill,
    paddingVertical: UI.spacing.md,
    alignItems: 'center',
    marginTop: UI.spacing.sm,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: UI.typography.body + 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: UI.spacing.sm,
    paddingVertical: UI.spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D1D1D6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: UI.spacing.sm,
    paddingHorizontal: UI.spacing.lg,
    borderRadius: UI.radius.pill,
    flex: 0.48,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: UI.spacing.sm,
    color: '#29b1a9',
    fontWeight: 'bold',
    fontSize: UI.typography.body,
  },
  closeButton: {
    padding: UI.spacing.xs,
    borderRadius: UI.radius.pill,
  },
});

export default CreatePost; 