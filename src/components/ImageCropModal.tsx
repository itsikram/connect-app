import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImagePicker from 'react-native-image-crop-picker';
import { useTheme } from '../contexts/ThemeContext';

interface ImageCropModalProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (uri: string) => void;
  type: 'profile' | 'cover';
  aspectRatio?: [number, number];
}

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  visible,
  onClose,
  onImageSelected,
  type,
  aspectRatio
}) => {
  const { colors: themeColors } = useTheme();

  const handleCameraPress = () => {
    const cropAspectRatio = aspectRatio || (type === 'profile' ? [1, 1] : [16, 9]);
    
    ImagePicker.openCamera({
      width: type === 'profile' ? 300 : 800,
      height: type === 'profile' ? 300 : 450,
      cropping: true,
      cropperCircleOverlay: type === 'profile',
      aspectRatio: cropAspectRatio,
      compressImageQuality: 0.8,
      includeBase64: false,
    }).then(image => {
      onImageSelected(image.path);
      onClose();
    }).catch(error => {
      console.log('Camera error:', error);
      if (error.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', 'Failed to take photo');
      }
    });
  };

  const handleGalleryPress = () => {
    const cropAspectRatio = aspectRatio || (type === 'profile' ? [1, 1] : [16, 9]);
    
    ImagePicker.openPicker({
      width: type === 'profile' ? 300 : 800,
      height: type === 'profile' ? 300 : 450,
      cropping: true,
      cropperCircleOverlay: type === 'profile',
      aspectRatio: cropAspectRatio,
      compressImageQuality: 0.8,
      includeBase64: false,
    }).then(image => {
      onImageSelected(image.path);
      onClose();
    }).catch(error => {
      console.log('Gallery error:', error);
      if (error.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Error', 'Failed to select image');
      }
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: themeColors.surface.secondary }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.text.primary }]}>
              Select {type === 'profile' ? 'Profile' : 'Cover'} Picture
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color={themeColors.text.secondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.options}>
            <TouchableOpacity
              style={[styles.option, { backgroundColor: themeColors.surface.primary }]}
              onPress={handleCameraPress}
            >
              <View style={[styles.optionIcon, { backgroundColor: themeColors.primary }]}>
                <Icon name="photo-camera" size={24} color={themeColors.text.inverse} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text.primary }]}>
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.option, { backgroundColor: themeColors.surface.primary }]}
              onPress={handleGalleryPress}
            >
              <View style={[styles.optionIcon, { backgroundColor: themeColors.primary }]}>
                <Icon name="photo-library" size={24} color={themeColors.text.inverse} />
              </View>
              <Text style={[styles.optionText, { color: themeColors.text.primary }]}>
                Choose from Gallery
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.note, { color: themeColors.text.tertiary }]}>
            {type === 'profile' 
              ? 'Your profile picture will be displayed as a circle'
              : 'Your cover photo will be displayed with a 16:9 aspect ratio'
            }
          </Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 4,
  },
  options: {
    gap: 16,
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ImageCropModal;
