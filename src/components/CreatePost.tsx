import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary, Asset, ImageLibraryOptions } from 'react-native-image-picker';
import api from '../lib/api';

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
            <Icon name="photo-camera" size={22} color={themeColors.primary} />
            <Text style={styles.buttonText}>Photo/Video</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, { backgroundColor: inputBg }]} onPress={() => { openModal(); pickMedia('video'); }}>
            <Icon name="videocam" size={22} color={themeColors.primary} />
            <Text style={styles.buttonText}>Live Video</Text>
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
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: inputBg }]} onPress={() => pickMedia('image')}>
                  <Icon name="photo-camera" size={22} color={themeColors.primary} />
                  <Text style={styles.attachmentButtonText}>Add Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.attachmentButton, { backgroundColor: inputBg }]} onPress={() => pickMedia('video')}>
                  <Icon name="videocam" size={22} color={themeColors.primary} />
                  <Text style={styles.attachmentButtonText}>Add Video</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    margin: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  profilePicWrapper: {
    marginRight: 10,
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
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    color: '#AEAEB2',
    fontSize: 14,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 0.48,
    justifyContent: 'center',
  },
  buttonText: {
    marginLeft: 6,
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
    borderRadius: 16,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: '#D1D1D6',
    fontSize: 14,
  },
  captionInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: '#D1D1D6',
    borderRadius: 8,
    backgroundColor: '#F2F2F2',
    padding: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  attachmentPreview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  attachmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flex: 0.48,
    justifyContent: 'center',
  },
  attachmentButtonText: {
    marginLeft: 6,
    color: '#29b1a9',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#29b1a9',
    borderRadius: 20,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#D1D1D6',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flex: 0.48,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    color: '#29b1a9',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
  },
});

export default CreatePost; 