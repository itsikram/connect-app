import React, { useState, useContext, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { AuthContext } from '../contexts/AuthContext';
import { colors } from '../theme/colors';
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
  const [isModalVisible, setModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [postData, setPostData] = useState<PostData>({
    caption: '',
    urls: null,
    type: null,
    location: '',
    feelings: '',
  });

  const openModal = () => setModalVisible(true);
  const closeModal = () => {
    setModalVisible(false);
    setPostData({ caption: '', urls: null, type: null, location: '', feelings: '' });
  };

  const handleCaptionChange = (text: string) => setPostData((prev) => ({ ...prev, caption: text }));
  const handleLocationChange = (text: string) => setPostData((prev) => ({ ...prev, location: text }));
  const handleFeelingsChange = (value: string) => setPostData((prev) => ({ ...prev, feelings: value }));

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
        // Upload file
        const formData = new FormData();
        formData.append('file', {
          uri: postData.urls,
          name: `upload.${postData.type === 'image' ? 'jpg' : 'mp4'}`,
          type: postData.type === 'image' ? 'image/jpeg' : 'video/mp4',
        } as any);
        formData.append('type', postData.type === 'image' ? 'image/jpeg' : 'video/mp4');
        const uploadRes = await api.post('/upload/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (uploadRes.status === 200) {
          uploadedUrl = uploadRes.data.secure_url;
        }
      }
      // Create post
      const postFormData = new FormData();
      postFormData.append('caption', postData.caption);
      postFormData.append('urls', uploadedUrl || '');
      postFormData.append('feelings', postData.feelings);
      postFormData.append('location', postData.location);
      const res = await api.post('/post/create/', postFormData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.status === 200) {
        if (onPostCreated) onPostCreated(res.data.post);
        closeModal();
      }
    } catch (e) {
      console.log(e);
    } finally {
      setIsUploading(false);
    }
  }, [postData, onPostCreated]);

  const profileName = user ? `${user.firstName || ''} ${user.surname || ''}` : '';
  const textInputPlaceholder = `What's On Your Mind ${profileName}?`;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.profilePicWrapper}>
          {/* Replace with actual profile pic if available */}
          <Image source={user?.profile?.profilePic ? { uri: user.profile.profilePic } : require('../assets/image/logo.png')} style={styles.profilePic} />
        </View>
        <TouchableOpacity style={styles.inputWrapper} onPress={openModal}>
          <Text style={styles.inputPlaceholder}>{textInputPlaceholder}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomRow}>
        <TouchableOpacity style={styles.button} onPress={() => { openModal(); pickMedia('image'); }}>
          <Icon name="photo-camera" size={22} color={colors.primary} />
          <Text style={styles.buttonText}>Photo/Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => { openModal(); pickMedia('video'); }}>
          <Icon name="videocam" size={22} color={colors.primary} />
          <Text style={styles.buttonText}>Live Video</Text>
        </TouchableOpacity>
      </View>
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Post</Text>
              <TouchableOpacity onPress={closeModal}>
                <Icon name="close" size={24} color={colors.gray[700]} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.cpmHeader}>
                <Image source={user?.profile?.profilePic ? { uri: user.profile.profilePic } : require('../assets/image/logo.png')} style={styles.profilePic} />
                <Text style={styles.profileName}>{profileName}</Text>
              </View>
              <View style={styles.feelingsLocationRow}>
                <View style={styles.feelingsContainer}>
                  <Text style={styles.label}>Feelings:</Text>
                  <View style={styles.pickerWrapper}>
                    <TextInput
                      style={styles.input}
                      placeholder="Feelings"
                      value={postData.feelings}
                      onChangeText={handleFeelingsChange}
                    />
                  </View>
                </View>
                <View style={styles.locationContainer}>
                  <Text style={styles.label}>Location:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Location..."
                    value={postData.location}
                    onChangeText={handleLocationChange}
                  />
                </View>
              </View>
              <TextInput
                style={styles.captionInput}
                placeholder={textInputPlaceholder}
                value={postData.caption}
                onChangeText={handleCaptionChange}
                multiline
              />
              {postData.urls && postData.type === 'image' && (
                <Image source={{ uri: postData.urls }} style={styles.attachmentPreview} />
              )}
              {postData.urls && postData.type === 'video' && (
                <Text style={{ color: colors.primary, marginVertical: 8 }}>Video selected</Text>
                // For video preview, use react-native-video if available
              )}
              <View style={styles.attachmentRow}>
                <TouchableOpacity style={styles.attachmentButton} onPress={() => pickMedia('image')}>
                  <Icon name="photo-camera" size={22} color={colors.primary} />
                  <Text style={styles.attachmentButtonText}>Add Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.attachmentButton} onPress={() => pickMedia('video')}>
                  <Icon name="videocam" size={22} color={colors.primary} />
                  <Text style={styles.attachmentButtonText}>Add Video</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                style={[styles.submitButton, isUploading && { backgroundColor: colors.gray[400] }]}
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
          </View>
        </View>
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
    marginBottom: 8,
  },
  profilePicWrapper: {
    marginRight: 10,
  },
  profilePic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray[200],
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    color: colors.gray[500],
    fontSize: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  buttonText: {
    marginLeft: 6,
    color: colors.primary,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    color: colors.gray[600],
    marginBottom: 2,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    backgroundColor: colors.gray[100],
  },
  input: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.gray[100],
    borderWidth: 1,
    borderColor: colors.gray[300],
    fontSize: 14,
  },
  captionInput: {
    minHeight: 60,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    backgroundColor: colors.gray[100],
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
    backgroundColor: colors.gray[100],
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  attachmentButtonText: {
    marginLeft: 6,
    color: colors.primary,
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: colors.primary,
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
});

export default CreatePost; 