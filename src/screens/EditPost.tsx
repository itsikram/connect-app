import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    TextInput,
    Alert,
    StatusBar,
    StyleSheet,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import KeyboardSafeView from '../components/KeyboardSafeView';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSelector } from 'react-redux';
import { useTheme } from '../contexts/ThemeContext';
import * as ImagePicker from 'expo-image-picker';
import api from '../lib/api';
import { RootState } from '../store';
import CacheManager from '../utils/cacheManager';
import { emitPostUpdated } from '../utils/postEvents';
import VoiceTextInput from '../components/VoiceTextInput';
import { AUDIENCE_OPTIONS, getAudienceOption } from '../constants/audience';
import { useModernToast } from '../contexts/ModernToastContext';

interface Post {
    _id: string;
    caption?: string;
    content?: string;
    photos?: string | string[];
    type?: string;
    feelings?: string;
    location?: string;
    audience?: number;
    author: {
        _id: string;
        fullName: string;
        profilePic?: string;
        isActive?: boolean;
    };
    createdAt: string;
    updatedAt: string;
}

const resolvePhotoUrl = (photos?: string | string[]) => {
    if (!photos) return '';
    return Array.isArray(photos) ? photos[0] || '' : photos;
};

const EditPost = () => {
    const route = useRoute();
    const navigation = useNavigation();
    const { postId } = route.params as { postId: string };
    
    const { colors: themeColors, isDarkMode } = useTheme();
    const myProfile = useSelector((state: RootState) => state.profile);
    const { showToast } = useModernToast();
    
    const [post, setPost] = useState<Post | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Form fields
    const [caption, setCaption] = useState('');
    const [feelings, setFeelings] = useState('');
    const [location, setLocation] = useState('');
    const [audience, setAudience] = useState(3);
    const [isAudiencePickerVisible, setIsAudiencePickerVisible] = useState(false);
    const [currentImage, setCurrentImage] = useState<string>('');
    
    // Image editing states
    const [newImageUri, setNewImageUri] = useState<string | null>(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [imageRemoved, setImageRemoved] = useState(false);
    
    // Feelings options
    const feelingsOptions = [
        'happy', 'sad', 'excited', 'grateful', 'blessed', 'loved', 'thankful',
        'amazing', 'wonderful', 'fantastic', 'great', 'awesome',
        'tired', 'stressed', 'worried', 'anxious', 'confused', 'frustrated',
    ];

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: themeColors.background.primary,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.border.primary,
            backgroundColor: themeColors.surface.header,
            elevation: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
        },
        headerTitle: {
            color: themeColors.text.primary,
            fontSize: 20,
            fontWeight: '700',
            marginLeft: 16,
        },
        cancelButton: {
            padding: 8,
            borderRadius: 20,
            backgroundColor: themeColors.gray[100],
        },
        saveButton: {
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: themeColors.primary,
            borderRadius: 20,
            marginLeft: 'auto',
        },
        saveButtonText: {
            color: themeColors.text.inverse,
            fontWeight: '600',
            fontSize: 16,
        },
        content: {
            flex: 1,
            padding: 20,
        },
        authorSection: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 20,
        },
        authorInfo: {
            flex: 1,
            marginLeft: 12,
        },
        authorName: {
            color: themeColors.text.primary,
            fontSize: 16,
            fontWeight: '600',
        },
        formSection: {
            marginBottom: 24,
        },
        sectionTitle: {
            color: themeColors.text.primary,
            fontSize: 18,
            fontWeight: '600',
            marginBottom: 12,
        },
        inputContainer: {
            marginBottom: 16,
        },
        label: {
            color: themeColors.text.primary,
            fontSize: 14,
            fontWeight: '500',
            marginBottom: 8,
        },
        textInput: {
            backgroundColor: themeColors.surface.secondary,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: themeColors.text.primary,
            borderWidth: 1,
            borderColor: themeColors.border.primary,
        },
        multilineInput: {
            minHeight: 100,
            textAlignVertical: 'top',
        },
        imageContainer: {
            marginBottom: 16,
        },
        currentImage: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: themeColors.gray[100],
        },
        imagePlaceholder: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: themeColors.gray[100],
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: themeColors.border.primary,
            borderStyle: 'dashed',
        },
        placeholderText: {
            color: themeColors.text.secondary,
            fontSize: 16,
            marginTop: 8,
        },
        feelingsContainer: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
        },
        feelingChip: {
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 16,
            backgroundColor: themeColors.gray[100],
            borderWidth: 1,
            borderColor: themeColors.border.primary,
        },
        feelingChipSelected: {
            backgroundColor: themeColors.primary + '20',
            borderColor: themeColors.primary,
        },
        feelingChipText: {
            color: themeColors.text.primary,
            fontSize: 14,
            fontWeight: '500',
        },
        feelingChipTextSelected: {
            color: themeColors.primary,
        },
        loadingContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: themeColors.background.primary,
        },
        loadingText: {
            color: themeColors.text.primary,
            marginTop: 16,
            fontSize: 16,
        },
        errorContainer: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: themeColors.background.primary,
            padding: 20,
        },
        errorText: {
            color: themeColors.text.primary,
            fontSize: 18,
            textAlign: 'center',
            marginTop: 16,
            marginBottom: 20,
        },
        retryButton: {
            backgroundColor: themeColors.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 24,
        },
        retryButtonText: {
            color: themeColors.text.inverse,
            fontWeight: '600',
            fontSize: 16,
        },
        imageActions: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
        },
        imageActionButton: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: themeColors.surface.secondary,
            borderWidth: 1,
            borderColor: themeColors.border.primary,
        },
        imageActionButtonText: {
            color: themeColors.text.primary,
            fontSize: 14,
            fontWeight: '500',
            marginLeft: 6,
        },
        removeButton: {
            backgroundColor: themeColors.status.error + '20',
            borderColor: themeColors.status.error,
        },
        removeButtonText: {
            color: themeColors.status.error,
        },
        newImagePreview: {
            width: '100%',
            height: 200,
            borderRadius: 12,
            backgroundColor: themeColors.gray[100],
            marginTop: 12,
        },
        imageStatusText: {
            color: themeColors.text.secondary,
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
            fontStyle: 'italic',
        },
        audienceButton: {
            flexDirection: 'row',
            alignItems: 'center',
            alignSelf: 'flex-start',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 20,
            backgroundColor: themeColors.surface.secondary,
            borderWidth: 1,
            borderColor: themeColors.border.primary,
            marginTop: 8,
        },
        audienceButtonText: {
            color: themeColors.text.primary,
            fontSize: 14,
            fontWeight: '600',
            marginLeft: 6,
            marginRight: 4,
        },
        modalOverlay: {
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'flex-end',
        },
        modalContent: {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 34,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: '700',
            marginBottom: 12,
        },
        audienceOption: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 12,
        },
        audienceOptionCopy: {
            flex: 1,
            marginLeft: 12,
        },
    });

    const fetchPost = async () => {
        try {
            setError(null);
            const response = await api.get(`/post/single?postId=${postId}`);
            if (response.status === 200) {
                const postData = response.data.post || response.data;
                setPost(postData);
                setCaption(postData.caption || postData.content || '');
                setFeelings(postData.feelings || '');
                setLocation(postData.location || '');
                setAudience(Number(postData.audience) || 3);
                setCurrentImage(resolvePhotoUrl(postData.photos));
            }
        } catch (err: any) {
            console.error('Error fetching post:', err);
            setError(err?.response?.data?.message || 'Failed to load post');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!post || !myProfile?._id) return;
        
        const hasPhoto = Boolean(newImageUri || (currentImage && !imageRemoved));
        if (!caption.trim() && !hasPhoto) {
            Alert.alert('Error', 'Please add a caption or photo before saving');
            return;
        }

        setSaving(true);
        try {
            let newImageUrl = null;
            
            // Handle image changes
            if (newImageUri) {
                // Upload new image
                newImageUrl = await uploadNewImage();
            } else if (imageRemoved) {
                // Image was removed
                newImageUrl = '';
            }
            
            // Prepare update data
            const updateData: any = {
                postId: post._id,
                caption: caption.trim(),
                feelings: feelings.trim() || '',
                location: location.trim() || '',
                audience,
            };
            
            // Add image URL if it was changed
            if (newImageUrl !== null) {
                updateData.photos = newImageUrl;
            }

            const response = await api.post('/post/update', updateData);

            if (response.status === 200) {
                const updatedPost = response.data?.post || {
                    ...post,
                    caption: caption.trim(),
                    feelings: feelings.trim() || '',
                    location: location.trim() || '',
                    audience,
                    photos: newImageUrl !== null ? newImageUrl : post.photos,
                };
                CacheManager.updateCachedPost(updatedPost);
                emitPostUpdated(updatedPost);
                showToast({
                    type: 'success',
                    title: 'Post updated',
                    message: 'Your changes have been saved.',
                });
                navigation.goBack();
            }
        } catch (err: any) {
            console.error('Error updating post:', err);
            Alert.alert('Error', err?.response?.data?.message || 'Failed to update post');
        } finally {
            setSaving(false);
        }
    };

    const handleFeelingSelect = (feeling: string) => {
        if (feelings === feeling) {
            setFeelings('');
        } else {
            setFeelings(feeling);
        }
    };

    const pickNewImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.7,
                allowsEditing: true,
            });
            
            if (!result.canceled && result.assets && result.assets[0]) {
                const asset = result.assets[0];
                if (asset.uri) {
                    setNewImageUri(asset.uri);
                    setImageRemoved(false);
                }
            }
        } catch (error) {
            console.log('ImagePicker Error:', error);
            Alert.alert('Error', 'Failed to pick image');
        }
    };

    const removeImage = () => {
        Alert.alert(
            'Remove Image',
            'Are you sure you want to remove this image?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                        setImageRemoved(true);
                        setNewImageUri(null);
                    },
                },
            ]
        );
    };

    const uploadNewImage = async (): Promise<string | null> => {
        if (!newImageUri) return null;
        
        setIsUploadingImage(true);
        try {
            const formData = new FormData();
            const fileData = {
                uri: newImageUri,
                name: 'upload.jpg',
                type: 'image/jpeg',
            } as any;
            
            formData.append('image', fileData);
            
            const uploadRes = await api.post('/upload/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            if (uploadRes.data && uploadRes.data.secure_url) {
                return uploadRes.data.secure_url;
            } else {
                throw new Error('Invalid upload response');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            throw error;
        } finally {
            setIsUploadingImage(false);
        }
    };

    useEffect(() => {
        fetchPost();
    }, [postId]);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar 
                    barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
                    backgroundColor={themeColors.surface.header} 
                />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={themeColors.primary} />
                    <Text style={styles.loadingText}>Loading post...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (error || !post) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar 
                    barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
                    backgroundColor={themeColors.surface.header} 
                />
                <View style={styles.errorContainer}>
                    <Icon name="error-outline" size={64} color={themeColors.status.error} />
                    <Text style={styles.errorText}>
                        {error || 'Post not found'}
                    </Text>
                    <TouchableOpacity
                        onPress={fetchPost}
                        style={styles.retryButton}
                    >
                        <Text style={styles.retryButtonText}>
                            Try Again
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar 
                barStyle={isDarkMode ? 'light-content' : 'dark-content'} 
                backgroundColor={themeColors.surface.header} 
            />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.cancelButton}
                >
                    <Icon name="close" size={24} color={themeColors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Edit Post</Text>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={saving || isUploadingImage}
                    style={[styles.saveButton, { opacity: (saving || isUploadingImage) ? 0.6 : 1 }]}
                >
                    {(saving || isUploadingImage) ? (
                        <ActivityIndicator size="small" color={themeColors.text.inverse} />
                    ) : (
                        <Text style={styles.saveButtonText}>Save</Text>
                    )}
                </TouchableOpacity>
            </View>

            <KeyboardSafeView nested>
                <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
                    {/* Author Info */}
                    <View style={styles.authorSection}>
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: themeColors.primary,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            <Text style={{
                                color: themeColors.text.inverse,
                                fontSize: 16,
                                fontWeight: '600',
                            }}>
                                {myProfile?.fullName?.charAt(0) || 'U'}
                            </Text>
                        </View>
                        <View style={styles.authorInfo}>
                            <Text style={styles.authorName}>
                                {myProfile?.fullName || 'Unknown User'}
                            </Text>
                            <TouchableOpacity
                                style={styles.audienceButton}
                                onPress={() => setIsAudiencePickerVisible(true)}
                            >
                                <Icon name={getAudienceOption(audience).icon} size={16} color={themeColors.primary} />
                                <Text style={styles.audienceButtonText}>{getAudienceOption(audience).label}</Text>
                                <Icon name="arrow-drop-down" size={18} color={themeColors.text.secondary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Current Image */}
                    {currentImage && !imageRemoved && (
                        <View style={styles.imageContainer}>
                            <Text style={styles.label}>Current Image</Text>
                            <Image
                                source={{ uri: currentImage }}
                                style={styles.currentImage}
                                resizeMode="cover"
                            />
                            <View style={styles.imageActions}>
                                <TouchableOpacity
                                    onPress={pickNewImage}
                                    style={styles.imageActionButton}
                                    disabled={isUploadingImage}
                                >
                                    <Icon 
                                        name="photo-camera" 
                                        size={16} 
                                        color={themeColors.primary} 
                                    />
                                    <Text style={styles.imageActionButtonText}>
                                        Change Image
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={removeImage}
                                    style={[styles.imageActionButton, styles.removeButton]}
                                >
                                    <Icon 
                                        name="delete" 
                                        size={16} 
                                        color={themeColors.status.error} 
                                    />
                                    <Text style={[styles.imageActionButtonText, styles.removeButtonText]}>
                                        Remove
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* New Image Preview */}
                    {newImageUri && (
                        <View style={styles.imageContainer}>
                            <Text style={styles.label}>New Image Preview</Text>
                            <Image
                                source={{ uri: newImageUri }}
                                style={styles.newImagePreview}
                                resizeMode="cover"
                            />
                            <Text style={styles.imageStatusText}>
                                This image will replace the current one
                            </Text>
                        </View>
                    )}

                    {/* No Image State */}
                    {(!currentImage || imageRemoved) && !newImageUri && (
                        <View style={styles.imageContainer}>
                            <Text style={styles.label}>Add Image</Text>
                            <TouchableOpacity
                                onPress={pickNewImage}
                                style={styles.imagePlaceholder}
                                disabled={isUploadingImage}
                            >
                                <Icon 
                                    name="add-photo-alternate" 
                                    size={48} 
                                    color={themeColors.text.secondary} 
                                />
                                <Text style={styles.placeholderText}>
                                    Tap to add an image
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Caption */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>What's on your mind?</Text>
                        <View style={styles.inputContainer}>
                            <VoiceTextInput
                                style={[styles.textInput, styles.multilineInput]}
                                value={caption}
                                onChangeText={setCaption}
                                placeholder="Write something..."
                                placeholderTextColor={themeColors.text.secondary}
                                multiline
                                maxLength={500}
                            />
                            <Text style={{
                                color: themeColors.text.secondary,
                                fontSize: 12,
                                textAlign: 'right',
                                marginTop: 4,
                            }}>
                                {caption.length}/500
                            </Text>
                        </View>
                    </View>

                    {/* Feelings */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>How are you feeling?</Text>
                        <View style={styles.inputContainer}>
                            <VoiceTextInput
                                style={styles.textInput}
                                value={feelings}
                                onChangeText={setFeelings}
                                placeholder="e.g., happy, excited, grateful..."
                                placeholderTextColor={themeColors.text.secondary}
                            />
                        </View>
                        <View style={styles.feelingsContainer}>
                            {feelingsOptions.slice(0, 12).map((feeling) => (
                                <TouchableOpacity
                                    key={feeling}
                                    onPress={() => handleFeelingSelect(feeling)}
                                    style={[
                                        styles.feelingChip,
                                        feelings === feeling && styles.feelingChipSelected,
                                    ]}
                                >
                                    <Text style={[
                                        styles.feelingChipText,
                                        feelings === feeling && styles.feelingChipTextSelected,
                                    ]}>
                                        {feeling}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.formSection}>
                        <Text style={styles.sectionTitle}>Where are you?</Text>
                        <View style={styles.inputContainer}>
                            <VoiceTextInput
                                style={styles.textInput}
                                value={location}
                                onChangeText={setLocation}
                                placeholder="e.g., New York, NY"
                                placeholderTextColor={themeColors.text.secondary}
                            />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardSafeView>

            <Modal
                visible={isAudiencePickerVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsAudiencePickerVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsAudiencePickerVisible(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: themeColors.surface.primary }]}>
                        <Text style={[styles.modalTitle, { color: themeColors.text.primary }]}>Select Audience</Text>
                        {AUDIENCE_OPTIONS.map((option) => {
                            const active = audience === option.value;
                            return (
                                <TouchableOpacity
                                    key={option.value}
                                    style={styles.audienceOption}
                                    onPress={() => {
                                        setAudience(option.value);
                                        setIsAudiencePickerVisible(false);
                                    }}
                                >
                                    <Icon name={option.icon} size={22} color={themeColors.primary} />
                                    <View style={styles.audienceOptionCopy}>
                                        <Text style={{ color: themeColors.text.primary, fontSize: 16, fontWeight: '600' }}>
                                            {option.label}
                                        </Text>
                                        <Text style={{ color: themeColors.text.secondary, fontSize: 13 }}>
                                            {option.desc}
                                        </Text>
                                    </View>
                                    {active ? <Icon name="check" size={20} color={themeColors.primary} /> : null}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

export default EditPost;
