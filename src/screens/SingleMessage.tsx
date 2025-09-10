import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    Alert,
    Modal,
    Pressable,
    Image,
    ImageBackground,
    Dimensions,
    ScrollView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import { ChatHeaderSkeleton, ChatBubblesSkeleton } from '../components/skeleton/ChatSkeleton';
import UserPP from '../components/UserPP';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSocket } from '../contexts/SocketContext';
import moment from 'moment';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
// VideoCall and AudioCall components moved to App.tsx for global rendering

interface Message {
    _id: string;
    message: string;
    receiverId: string;
    senderId: string;
    room: string;
    attachment?: string;
    timestamp: Date;
    isSeen: boolean;
    parent?: any | null;
    tempId?: string;
    reacts?: string[];
    messageType?: 'text' | 'call';
    callType?: 'audio' | 'video';
    callEvent?: 'missed' | 'ended' | 'declined' | 'started';
}

// Function to validate if a string is a valid image URL
const isValidImageUrl = (url: string): boolean => {
    if (typeof url !== 'string') return false;
    // Basic check for image file extensions
    return /^https?:\/\/.+\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(url);
};


const SingleMessage = () => {
    const route = useRoute();
    const navigation: any = useNavigation();
    const { friend } = route.params as { friend: any };
    const myProfile = useSelector((state: RootState) => state.profile);
    const [room, setRoom] = useState('');
    const { connect, isConnected, emit, on, off, startVideoCall, startAudioCall } = useSocket();
    const { colors: themeColors, isDarkMode } = useTheme();
    const CHAT_BG_STORAGE_KEY = '@chat_background_image';

    // Add state for context menu
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [contextMenuUseBottom, setContextMenuUseBottom] = useState(false);
    const [contextMenuBottom, setContextMenuBottom] = useState(20);
    const [isReactedByMe, setIsReactedByMe] = useState<boolean>(false);

    // Add state for image modal
    const [imageModalVisible, setImageModalVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string>('');
    const [imageScale, setImageScale] = useState(1);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [pendingAttachment, setPendingAttachment] = useState<string | null>(null);
    const [pendingAttachmentLocal, setPendingAttachmentLocal] = useState<string | null>(null);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const swipeableRefs = useRef<Map<string, any>>(new Map());
    const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

    // Add state for info menu
    const [infoMenuVisible, setInfoMenuVisible] = useState(false);
    const [chatBackground, setChatBackground] = useState<string | null>(null);
    const [friendEmotion, setFriendEmotion] = useState<string | null>("");

    // Set up room and socket events when both IDs are available
    useEffect(() => {
        if (!friend?._id || !myProfile?._id) return;

        const newRoom = [friend._id, myProfile._id].sort().join('_');
        setRoom(newRoom);

        // Only emit and set up listeners if socket is connected
        if (isConnected) {
            emit('startChat', { user1: myProfile._id, user2: friend._id });

            // Set up room joined listener
            const handleRoomJoined = ({ room }: { room: string }) => {
                console.log(`Joined room: ${room}`);
                // Note: localStorage is not available in React Native, use AsyncStorage instead
                // localStorage.setItem('roomId', room);
            };

            on('roomJoined', handleRoomJoined);

            // Cleanup listener when component unmounts or dependencies change
            return () => {
                off('roomJoined', handleRoomJoined);
            };
        }
    }, [friend?._id, myProfile?._id, isConnected, emit, on, off]);

    // Listen for incoming messages
    useEffect(() => {
        if (!isConnected) return;


        emit('fetchMessages', myProfile?._id);

        const handlePreviousMessages = (messages: any) => {
            setMessages(messages);
        }

        on('previousMessages', handlePreviousMessages);

        const handleNewMessage = (messageData: any) => {
            console.log('New message received:', messageData, messages);
            let updatedMessage = messageData.updatedMessage;
            // Add the new message to the messages state
            const newMessage: Message = {
                _id: updatedMessage._id || Date.now().toString(),
                message: updatedMessage.message || '',
                receiverId: updatedMessage.receiverId,
                senderId: updatedMessage.senderId,
                tempId: updatedMessage.tempId,
                timestamp: new Date(updatedMessage.timestamp || Date.now()),
                isSeen: false,
                room,
                attachment: updatedMessage.attachment,
                parent: updatedMessage.parent || null,
                messageType: updatedMessage.messageType,
                callType: updatedMessage.callType,
                callEvent: updatedMessage.callEvent,
            };

            if (messageData.chatPage === true) {

                setMessages(prev => {
                    // If a message with the same tempId exists, replace it with the new message
                    const tempId = newMessage.tempId;
                    if (tempId) {
                        const index = prev.findIndex(msg => msg.tempId && msg.tempId === tempId);
                        if (index !== -1) {
                            // Replace the message at the found index
                            const updated = [...prev];
                            updated[index] = newMessage;
                            return updated;
                        }
                    }
                    // Otherwise, append as new
                    return [...prev, newMessage];
                });

                // setMessages(prev => [...prev, newMessage]);
            }
        };

        const handleReceiveTyping = (typingData: any) => {
            console.log('Typing:', typingData);
            setIsTyping(typingData.isTyping);
            setTypingMessage(typingData.type);

            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);

        };

        const handleSeenMessage = (message: any) => {
            console.log('Seen message:', message, messages);

            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg._id === message._id ? { ...msg, isSeen: true } : msg
                )
            );
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        };



        const handleEmotionChange = (emotion: string) => {
            setFriendEmotion(emotion);
        };

        on('emotion_change', handleEmotionChange);

        on('seenMessage', handleSeenMessage);

        on('newMessage', handleNewMessage);
        on('typing', handleReceiveTyping);

        const handleDeleteMessage = (messageId: string) => {
            setMessages(prev => prev.filter(msg => msg._id !== messageId));
        };

        on('deleteMessage', handleDeleteMessage);

        return () => {
            off('newMessage', handleNewMessage);
            off('typing', handleReceiveTyping);
            off('seenMessage', handleSeenMessage);
            off('previousMessages', handlePreviousMessages);
            off('deleteMessage', handleDeleteMessage);
        };
    }, [isConnected, myProfile?._id, on, off]);

    // Early return with skeletons if required data is not available
    if (!friend?._id || !myProfile?._id) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <ChatHeaderSkeleton />
                <ChatBubblesSkeleton count={12} />
            </SafeAreaView>
        );
    }

    // Tab bar hiding is now handled at the app level in App.tsx

    useFocusEffect(
        React.useCallback(() => {
            let isActive = true;
            const loadBackground = async () => {
                try {
                    const saved = await AsyncStorage.getItem(CHAT_BG_STORAGE_KEY);
                    if (isActive) setChatBackground(saved);
                } catch (e) {
                    // noop
                }
            };
            loadBackground();
            return () => { isActive = false; };
        }, [])
    );

    const [messages, setMessages] = useState<Message[]>([]);

    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [typingMessage, setTypingMessage] = useState('');
    const flatListRef = useRef<FlatList>(null);
    const inputRef = useRef<TextInput>(null);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        if (messages.length > 0) {
            setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
        }
    }, [messages]);


    const sendMessage = () => {
        console.log('Sending message:', inputText.trim());
        if ((inputText.trim() || pendingAttachment) && isConnected && !isUploading) {
            // const newMessage: Message = {
            //     _id: Date.now().toString(),
            //     message: inputText.trim(),
            //     room,
            //     receiverId: friend?._id,
            //     senderId: myProfile?._id,
            //     timestamp: new Date(),
            //     isSeen: false,
            // };

            // Add message to local state immediately for optimistic UI
            setInputText('');

            // Send message through socket
            emit('sendMessage', {
                room,
                senderId: myProfile?._id,
                receiverId: friend?._id,
                message: inputText.trim(),
                attachment: pendingAttachment || undefined,
                parent: replyingTo?._id || false,
                tempId: Date.now().toString(),
                timestamp: new Date().toISOString()
            });

            console.log('Message sent:', inputText.trim());
            setPendingAttachment(null);
            setPendingAttachmentLocal(null);
            setUploadProgress(null);
            setIsUploading(false);
            setReplyingTo(null);
            if (activeSwipeId) {
                const ref = swipeableRefs.current.get(activeSwipeId);
                try { ref?.close && ref.close(); } catch (e) { }
                setActiveSwipeId(null);
            }
        }
    };

    const handleTyping = () => {
        emit('typing', { room, isTyping: true, type: inputText.trim(), receiverId: friend?._id });

        setTimeout(() => {

            emit('typing', { room, isTyping: false, type: '', receiverId: friend?._id });
        }, 5000);
    };

    const handleEmojiPress = () => {
        setInputText('');
        // Send message through socket
        emit('sendMessage', {
            room,
            senderId: myProfile?._id,
            receiverId: friend?._id,
            message: '👍',
            timestamp: new Date().toISOString()
        });
    };

    const formatTime = (date: Date) => {
        return moment(date).fromNow();
    };

    // Add function to handle long press
    const handleMessageLongPress = (message: Message, event: any) => {
        setSelectedMessage(message);
        setIsReactedByMe(message?.reacts?.includes(myProfile?._id) || false);
        setContextMenuVisible(true);

        const { pageY } = event.nativeEvent;
        const screenHeight = Dimensions.get('window').height;
        const CONTEXT_MENU_HEIGHT = 360; // approximate menu height (safer)
        const TOP_MARGIN = 20;
        // If opening near bottom, anchor using bottom so it stays fully visible
        if (pageY + 20 + CONTEXT_MENU_HEIGHT > screenHeight) {
            setContextMenuUseBottom(true);
            setContextMenuBottom(20);
            setContextMenuPosition({ x: 20, y: 0 });
        } else {
            const y = Math.max(
                TOP_MARGIN,
                Math.min(pageY - 100, screenHeight - CONTEXT_MENU_HEIGHT - TOP_MARGIN)
            );
            setContextMenuUseBottom(false);
            setContextMenuPosition({ x: 20, y });
        }
    };

    const playSound = () => {
        console.log('Playing sound:', selectedMessage?.attachment);
        emit('speak_message', { msgId: selectedMessage?._id, friendId: friend?._id });

    }

    // Add function to copy message
    const copyMessage = () => {
        if (selectedMessage) {
            // You'll need to implement clipboard functionality
            // For now, we'll just show an alert
            Alert.alert('Copied!', 'Message copied to clipboard');
            setContextMenuVisible(false);
        }
    };

    // Add function to reply to message
    const replyToMessage = () => {
        if (selectedMessage) {
            setReplyingTo(selectedMessage);
            setContextMenuVisible(false);
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        }
    };

    // Add function to delete message
    const deleteMessage = () => {
        if (selectedMessage) {
            Alert.alert(
                'Delete Message',
                'Are you sure you want to delete this message?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                            // Emit delete message event
                            emit('deleteMessage', selectedMessage._id);

                            // Remove from local state
                            setContextMenuVisible(false);
                        }
                    }
                ]
            );
        }
    };

    const likeOrUnlikeMessage = () => {
        if (!selectedMessage) return;
        const messageId = selectedMessage._id;
        if (isReactedByMe) {
            emit('removeReactMessage', { messageId, profileId: myProfile?._id });
            setIsReactedByMe(false);
        } else {
            emit('reactMessage', { messageId, profileId: myProfile?._id });
            setIsReactedByMe(true);
        }
        setContextMenuVisible(false);
    };

    const viewImage = () => {
        if (selectedMessage?.attachment && isValidImageUrl(selectedMessage.attachment)) {
            openImageModal(selectedMessage.attachment);
        }
        setContextMenuVisible(false);
    };

    // Add function to forward message
    const forwardMessage = () => {
        if (selectedMessage) {
            Alert.alert('Forward', 'Forward feature coming soon!');
            setContextMenuVisible(false);
        }
    };

    // Image modal functions
    const openImageModal = (imageUrl: string) => {
        setSelectedImage(imageUrl);
        setImageModalVisible(true);
        setImageScale(1);
    };

    const closeImageModal = () => {
        setImageModalVisible(false);
        setSelectedImage('');
        setImageScale(1);
    };

    const zoomIn = () => {
        setImageScale(prev => Math.min(prev + 0.5, 3));
    };

    const zoomOut = () => {
        setImageScale(prev => Math.max(prev - 0.5, 0.5));
    };

    const resetZoom = () => {
        setImageScale(1);
    };

    const downloadImage = () => {
        // For React Native, you might want to use react-native-fs or similar library
        // For now, we'll show an alert
        Alert.alert('Download', 'Download feature coming soon!');
    };

    const removePendingAttachment = () => {
        setPendingAttachment(null);
        setPendingAttachmentLocal(null);
        setUploadProgress(null);
        setIsUploading(false);
    };

    // Handle video call
    const handleVideoCall = () => {
        if (!friend?._id || !myProfile?._id) {
            Alert.alert('Error', 'Unable to start call. Please try again.');
            return;
        }

        const channelName = `${myProfile._id}-${friend._id}`;
        navigation.navigate('Message', {
            screen: 'OutgoingCall',
            params: {
                calleeId: friend._id,
                calleeName: friend.fullName,
                calleeProfilePic: friend.profilePic,
                channelName,
                isAudio: false,
            }
        });
    };

    // Handle audio call
    const handleAudioCall = () => {
        if (!friend?._id || !myProfile?._id) {
            Alert.alert('Error', 'Unable to start call. Please try again.');
            return;
        }

        const channelName = `${myProfile._id}-${friend._id}`;
        navigation.navigate('Message', {
            screen: 'OutgoingCall',
            params: {
                calleeId: friend._id,
                calleeName: friend.fullName,
                calleeProfilePic: friend.profilePic,
                channelName,
                isAudio: true,
            }
        });
    };

    const handleAttachmentPress = async () => {
        try {
            if (!isConnected) {
                return Alert.alert('Not connected', 'Please wait for connection.');
            }

            const result: any = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });

            if (result.didCancel) return;
            const asset = result.assets && result.assets[0];
            if (!asset?.uri) return;

            setIsUploading(true);
            setUploadProgress(0);
            setPendingAttachmentLocal(asset.uri);

            const formData: any = new FormData();
            formData.append('image', {
                uri: asset.uri,
                name: asset.fileName || 'photo.jpg',
                type: asset.type || 'image/jpeg',
            } as any);

            const uploadRes = await api.post('/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent: any) => {
                    try {
                        const total = progressEvent.total;
                        const loaded = progressEvent.loaded || 0;
                        if (total) {
                            const percent = Math.floor((loaded / total) * 100);
                            setUploadProgress(percent);
                        }
                    } catch (e) {
                        // noop
                    }
                }
            } as any);

            const secureUrl = uploadRes?.data?.secure_url || uploadRes?.data?.url;
            if (!secureUrl) {
                throw new Error('Upload failed');
            }

            setUploadProgress(100);
            setPendingAttachment(secureUrl);
            setPendingAttachmentLocal(asset.uri);
        } catch (err: any) {
            console.error('Attachment upload error:', err?.message || err);
            Alert.alert('Upload failed', 'Could not upload the image.');
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    };

    const startReply = (message: Message) => {
        setSelectedMessage(message);
        setReplyingTo(message);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const scrollToMessage = (messageId: string) => {
        const index = messages.findIndex(m => m._id === messageId);
        if (index !== -1) {
            setHighlightedMessageId(messageId);
            try {
                flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
            } catch (e) {
                // Fallback handled by onScrollToIndexFailed
            }
            setTimeout(() => setHighlightedMessageId(null), 2000);
        } else {
            Alert.alert('Not found', 'Original message is not loaded.');
        }
    };

    const renderLeftReplyAction = () => (
        <View style={{ width: 64, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: themeColors.gray[200], borderRadius: 20, padding: 8 }}>
                <Icon name="reply" size={20} color={themeColors.primary} />
            </View>
        </View>
    );

    const renderMessage = ({ item }: { item: Message }) => (
        <Swipeable
            ref={(ref) => {
                if (ref) {
                    swipeableRefs.current.set(item._id, ref);
                } else {
                    swipeableRefs.current.delete(item._id);
                }
            }}
            renderLeftActions={() => (item.senderId !== myProfile?._id ? renderLeftReplyAction() : null)}
            onSwipeableOpen={(direction) => {
                if (direction === 'left' && item.senderId !== myProfile?._id) {
                    startReply(item);
                    setActiveSwipeId(item._id);
                }
            }}
        >
            <Pressable onLongPress={(event) => handleMessageLongPress(item, event)} delayLongPress={250}>
                <View key={item._id} style={{
                    marginBottom: 8,
                    alignItems: item.senderId === myProfile?._id ? 'flex-end' : 'flex-start',
                }}>
                    <View style={{
                        backgroundColor: item.messageType === 'call'
                            ? (item.callEvent === 'missed' ? (isDarkMode ? '#3a0d12' : '#fee2e2') : (isDarkMode ? '#0f172a' : '#e2e8f0'))
                            : (item.senderId === myProfile?._id ? themeColors.primary : themeColors.gray[200]),
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 20,
                        maxWidth: '80%',
                        borderBottomLeftRadius: item.senderId === myProfile._id ? 20 : 4,
                        borderBottomRightRadius: item.senderId === myProfile._id ? 4 : 20,
                        borderWidth: highlightedMessageId === item._id ? 2 : 0,
                        borderColor: highlightedMessageId === item._id ? themeColors.primary : 'transparent',
                    }}>
                        {item.parent && (
                            <TouchableOpacity onPress={() => item.parent?._id && scrollToMessage(item.parent._id)} style={{
                                marginBottom: 8,
                                padding: 8,
                                borderLeftWidth: 3,
                                borderLeftColor: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.primary,
                                backgroundColor: item.senderId === myProfile?._id ? 'rgba(255,255,255,0.12)' : themeColors.gray[300],
                                borderRadius: 6
                            }}>
                                <Text style={{
                                    color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                                    opacity: 0.8,
                                    fontSize: 12,
                                    fontStyle: 'italic',
                                }}>
                                    {item.parent.message || 'Message'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        {item.messageType === 'call' ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Icon
                                    name={item.callType === 'video' ? 'videocam' : 'call'}
                                    size={18}
                                    color={item.callEvent === 'missed' ? '#ef4444' : themeColors.text.primary}
                                />
                                <Text style={{
                                    color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                                    fontSize: 16,
                                    lineHeight: 20,
                                }}>
                                    {item.message || (item.callEvent === 'missed' ? (item.callType === 'video' ? 'Missed video call' : 'Missed audio call') : (item.callType === 'video' ? 'Video call' : 'Audio call'))}
                                </Text>
                            </View>
                        ) : (
                            <Text style={{
                                color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                                fontSize: 16,
                                lineHeight: 20,
                            }}>
                                {item.message}
                            </Text>
                        )}
                        {item.attachment && isValidImageUrl(item.attachment) && (
                            <Image
                                source={{ uri: item.attachment }}
                                style={{ width: 200, height: 200, borderRadius: 8, marginTop: 8 }}
                                resizeMode="cover"
                            />
                        )}


                        {item.senderId == myProfile?._id && <>
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                marginTop: 4,
                            }}>
                                <Icon
                                    name={item.isSeen ? 'done-all' : 'check'}
                                    size={16}
                                    color={item.isSeen ? themeColors.text.primary : themeColors.text.inverse}
                                    style={{ marginLeft: 4 }}
                                />
                                <Text style={{
                                    color: themeColors.text.primary,
                                    fontSize: 12,
                                    opacity: 0.7,
                                    marginLeft: 4,
                                }}>
                                    {moment(item.timestamp).format('hh:mm')}
                                </Text>
                            </View>
                        </>}


                    </View>
                    {item.senderId !== myProfile?._id && (
                        <Text style={{
                            color: item.senderId === myProfile?._id ? themeColors.primary : themeColors.text.secondary,
                            fontSize: 12,
                            opacity: 0.7,
                            marginTop: 4,
                            marginLeft: 8,
                        }}>
                            {moment(item.timestamp).fromNow()}
                        </Text>
                    )}
                </View>
            </Pressable>
        </Swipeable>
    );

    const renderTypingIndicator = () => {
        if (!isTyping) return null;

        return (
            <View style={{
                marginVertical: 4,
                marginHorizontal: 16,
                alignItems: 'center',
                display: 'flex',
                flexDirection: 'row',
                gap: 8,
            }}>
                <UserPP image={friend?.profilePic} isActive={false} size={30} />

                <View style={{
                    backgroundColor: themeColors.gray[200],
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 20,
                    borderBottomLeftRadius: 4,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>

                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                        }}>
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: themeColors.gray[500],
                                marginRight: 4,
                                opacity: 0.6,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: themeColors.gray[500],
                                marginRight: 4,
                                opacity: 0.8,
                            }} />
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: themeColors.gray[500],
                                opacity: 1,
                            }} />
                        </View>
                        <Text style={{
                            color: themeColors.text.secondary,
                            fontSize: 14,
                            marginLeft: 8,
                        }}>
                            typing...
                        </Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>

            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                backgroundColor: themeColors.surface.header,
                borderBottomWidth: 1,
                borderBottomColor: themeColors.border.primary,
            }}>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Message', { screen: 'MessageList' })}
                    style={{
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        marginRight: 5,
                    }}
                >
                    <Icon name="arrow-back" size={22} color={themeColors.text.primary} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>

                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                        <UserPP image={friend?.profilePic} isActive={false} size={35} />


                        <View style={{ flex: 1 }}>
                            <Text
                                style={{
                                    fontSize: 16,
                                    fontWeight: '600',
                                    color: themeColors.text.primary,
                                }}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                            >
                                {friend?.fullName || <Text>Friend</Text>}
                            </Text>
                            <Text style={{
                                fontSize: 14,
                                color: themeColors.text.secondary,
                                marginTop: -3,
                            }}>
                                {isTyping ? (
                                    typingMessage.length > 0 ? (
                                        <Text>{typingMessage}</Text>
                                    ) : (
                                        <Text>typing...</Text>
                                    )
                                ) : friend?.isActive ? (
                                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <View style={{ height: 10, width: 10, borderRadius: 5, backgroundColor: 'green' }}></View>
                                        <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>Online</Text>
                                        {
                                            friendEmotion && (
                                                <><Text style={{ fontSize: 12, color: themeColors.text.secondary }}>|</Text><Text style={{ fontSize: 12, color: themeColors.text.secondary }}>{friendEmotion}</Text></>
                                            )
                                        }
                                    </View>
                                ) : (
                                    <Text>Away</Text>
                                )}

                                {/* <Text style={{ fontSize: 12, color: themeColors.text.secondary }}>Last seen {moment(friend?.lastSeen).fromNow()}</Text> */}

                            </Text>
                        </View>
                    </View>

                </View>

                <TouchableOpacity
                    onPress={() => emit('bump', { friendProfile: friend?._id, myProfile: myProfile?._id })}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: themeColors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="notifications" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleAudioCall}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: themeColors.primary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="call" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleVideoCall}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: themeColors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="videocam" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setInfoMenuVisible(true)}
                    style={{
                        width: 35,
                        height: 35,
                        borderRadius: 20,
                        backgroundColor: themeColors.secondary,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 5,
                    }}
                >
                    <Icon name="info" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                </TouchableOpacity>
            </View>


            {chatBackground ? (
                <ImageBackground
                    source={{ uri: chatBackground }}
                    style={{ flex: 1 }}
                    imageStyle={{ opacity: isDarkMode ? 0.2 : 0.35 }}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item._id}
                        style={{ flex: 1 }}
                        contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
                        showsVerticalScrollIndicator={false}
                        ListFooterComponent={renderTypingIndicator}
                        onScrollToIndexFailed={(info) => {
                            const wait = new Promise(resolve => setTimeout(resolve, 200));
                            wait.then(() => {
                                flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                            });
                        }}
                    />
                </ImageBackground>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item._id}
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
                    showsVerticalScrollIndicator={false}
                    ListFooterComponent={renderTypingIndicator}
                    onScrollToIndexFailed={(info) => {
                        const wait = new Promise(resolve => setTimeout(resolve, 200));
                        wait.then(() => {
                            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                        });
                    }}
                />
            )}


            <Modal
                visible={contextMenuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setContextMenuVisible(false)}
            >
                <Pressable
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    }}
                    onPress={() => setContextMenuVisible(false)}
                >
                    <View
                        style={{
                            position: 'absolute',
                            left: contextMenuPosition.x,
                            top: contextMenuUseBottom ? undefined : contextMenuPosition.y,
                            bottom: contextMenuUseBottom ? contextMenuBottom : undefined,
                            backgroundColor: themeColors.surface.primary,
                            borderRadius: 12,
                            paddingVertical: 8,
                            paddingHorizontal: 4,
                            shadowColor: '#000',
                            shadowOffset: {
                                width: 0,
                                height: 2,
                            },
                            shadowOpacity: 0.25,
                            shadowRadius: 3.84,
                            elevation: 5,
                            minWidth: 160,
                            maxHeight: Dimensions.get('window').height - 80,
                        }}
                    >

                        {selectedMessage?.senderId === myProfile?._id && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                }}
                                onPress={playSound}
                            >
                                <Icon name="speaker" size={20} color={themeColors.text.primary} />
                                <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                    Play Sound
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={likeOrUnlikeMessage}
                        >
                            <Icon name={isReactedByMe ? 'thumb-down' : 'thumb-up'} size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                {isReactedByMe ? 'Unlike' : 'Like'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={copyMessage}
                        >
                            <Icon name="content-copy" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Copy
                            </Text>
                        </TouchableOpacity>
                        {selectedMessage?.attachment && isValidImageUrl(selectedMessage.attachment) && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                }}
                                onPress={viewImage}
                            >
                                <Icon name="photo" size={20} color={themeColors.text.primary} />
                                <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                    View Image
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={replyToMessage}
                        >
                            <Icon name="reply" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Reply
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 12,
                                paddingHorizontal: 16,
                            }}
                            onPress={forwardMessage}
                        >
                            <Icon name="forward" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Forward
                            </Text>
                        </TouchableOpacity>

                        {selectedMessage?.senderId === myProfile?._id && (
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderTopWidth: 1,
                                    borderTopColor: themeColors.border.primary,
                                }}
                                onPress={deleteMessage}
                            >
                                <Icon name="delete" size={20} color={themeColors.status.error} />
                                <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.status.error }}>
                                    Delete
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </Pressable>
            </Modal>


            <Modal
                visible={imageModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeImageModal}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.9)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>

                    <TouchableOpacity
                        onPress={closeImageModal}
                        style={{
                            position: 'absolute',
                            top: 50,
                            right: 20,
                            zIndex: 1000,
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}
                    >
                        <Icon name="close" size={24} color="white" />
                    </TouchableOpacity>


                    <ScrollView
                        horizontal={true}
                        contentContainerStyle={{
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: Dimensions.get('window').height,
                        }}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                    >
                        <Image
                            source={{ uri: selectedImage }}
                            style={{
                                width: Dimensions.get('window').width * imageScale,
                                height: Dimensions.get('window').height * imageScale,
                                resizeMode: 'contain',
                            }}
                        />
                    </ScrollView>


                    <View style={{
                        position: 'absolute',
                        bottom: 50,
                        flexDirection: 'row',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        borderRadius: 25,
                        paddingHorizontal: 20,
                        paddingVertical: 10,
                    }}>
                        <TouchableOpacity
                            onPress={zoomOut}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                            }}
                        >
                            <Icon name="zoom-out" size={20} color={themeColors.text.inverse} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={resetZoom}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                            }}
                        >
                            <Icon name="center-focus-strong" size={20} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={zoomIn}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 10,
                            }}
                        >
                            <Icon name="zoom-in" size={20} color={themeColors.text.inverse} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={downloadImage}
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                            }}
                        >
                            <Icon name="download" size={20} color={themeColors.text.inverse} />
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={infoMenuVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setInfoMenuVisible(false)}
            >
                <TouchableOpacity
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        justifyContent: 'flex-end',
                    }}
                    onPress={() => setInfoMenuVisible(false)}
                    activeOpacity={1}
                >
                    <View style={{
                        backgroundColor: themeColors.surface.primary,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        paddingTop: 20,
                        paddingHorizontal: 20,
                        maxHeight: '80%',
                        minHeight: '40%',
                    }}>
                        <View style={{
                            alignSelf: 'center',
                            width: 40,
                            height: 4,
                            backgroundColor: themeColors.border.primary,
                            borderRadius: 2,
                            marginBottom: 20,
                        }} />

                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            marginBottom: 20,
                        }}>
                            <UserPP image={friend?.profilePic} isActive={friend?.isActive} size={50} />
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={{
                                    fontSize: 18,
                                    fontWeight: '600',
                                    color: themeColors.text.primary,
                                }}>
                                    {friend?.fullName || 'Friend'}
                                </Text>
                                <Text style={{
                                    fontSize: 14,
                                    color: themeColors.text.secondary,
                                    marginTop: 2,
                                }}>
                                    {friend?.isActive ? 'Online' : 'Away'}
                                </Text>
                            </View>
                        </View>

                        <ScrollView
                            style={{ flex: 1 }}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            showsVerticalScrollIndicator={false}
                        >
                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setInfoMenuVisible(false);
                                    navigation.navigate('FriendProfile', { friendId: friend?._id });
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="person" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        View Profile
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        See {friend?.fullName?.split(' ')[0]}'s profile
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setInfoMenuVisible(false);
                                    Alert.alert('Search', 'Search in conversation feature coming soon!');
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="search" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Search in Conversation
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        Find messages in this chat
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setInfoMenuVisible(false);
                                    Alert.alert('Media', 'View shared media feature coming soon!');
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.primary + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="photo-library" size={20} color={themeColors.primary} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Media & Files
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        View shared photos and files
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setInfoMenuVisible(false);
                                    Alert.alert('Mute', 'Mute conversation feature coming soon!');
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: '#FFA50015',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="volume-off" size={20} color="#FFA500" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.text.primary,
                                    }}>
                                        Mute Notifications
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.text.secondary,
                                        marginTop: 2,
                                    }}>
                                        Stop getting notifications from this chat
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                    borderBottomWidth: 1,
                                    borderBottomColor: themeColors.border.primary,
                                }}
                                onPress={() => {
                                    setInfoMenuVisible(false);
                                    Alert.alert('Block', `Are you sure you want to block ${friend?.fullName}?`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Block', style: 'destructive', onPress: () => {
                                                Alert.alert('Block', 'Block user feature coming soon!');
                                            }
                                        }
                                    ]);
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.status.error + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="block" size={20} color={themeColors.status.error} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.status.error,
                                    }}>
                                        Block User
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.status.error + '80',
                                        marginTop: 2,
                                    }}>
                                        Block and report this user
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingVertical: 15,
                                }}
                                onPress={() => {
                                    setInfoMenuVisible(false);
                                    Alert.alert('Report', `Report ${friend?.fullName}?`, [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Report', style: 'destructive', onPress: () => {
                                                Alert.alert('Report', 'Report user feature coming soon!');
                                            }
                                        }
                                    ]);
                                }}
                            >
                                <View style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    backgroundColor: themeColors.status.error + '15',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginRight: 15,
                                }}>
                                    <Icon name="flag" size={20} color={themeColors.status.error} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{
                                        fontSize: 16,
                                        fontWeight: '500',
                                        color: themeColors.status.error,
                                    }}>
                                        Report User
                                    </Text>
                                    <Text style={{
                                        fontSize: 12,
                                        color: themeColors.status.error + '80',
                                        marginTop: 2,
                                    }}>
                                        Report inappropriate behavior
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{
                    backgroundColor: themeColors.surface.header,
                    borderTopWidth: 1,
                    borderTopColor: themeColors.border.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 14
                }}
            >
                {replyingTo && (
                    <View style={{
                        marginBottom: 8,
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 12,
                        padding: 10,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ color: themeColors.text.secondary, fontSize: 12 }}>Replying to</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                {typeof replyingTo.attachment === 'string' && isValidImageUrl(replyingTo.attachment) && (
                                    <Image source={{ uri: replyingTo.attachment as string }} style={{ width: 28, height: 28, borderRadius: 4, marginRight: 8 }} />
                                )}
                                <Text numberOfLines={1} style={{ color: themeColors.text.primary }}>
                                    {replyingTo.message || 'Message'}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setReplyingTo(null)} style={{ marginLeft: 8 }}>
                            <Icon name="close" size={18} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                )}
                {(isUploading || pendingAttachmentLocal || pendingAttachment) && (
                    <View style={{
                        marginBottom: 8,
                        marginHorizontal: 0,
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 12,
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                        {(pendingAttachmentLocal || pendingAttachment) && (
                            <Image
                                source={{ uri: pendingAttachmentLocal || pendingAttachment || '' }}
                                style={{ width: 48, height: 48, borderRadius: 8, marginRight: 8 }}
                            />
                        )}
                        <View style={{ flex: 1 }}>
                            {isUploading && (
                                <View style={{ height: 6, backgroundColor: themeColors.gray[300], borderRadius: 3, overflow: 'hidden' }}>
                                    <View style={{ width: `${uploadProgress || 0}%`, height: 6, backgroundColor: themeColors.primary }} />
                                </View>
                            )}
                            {!isUploading && pendingAttachment && (
                                <Text style={{ color: themeColors.text.secondary, fontSize: 12 }}>Attachment ready</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={removePendingAttachment} style={{ marginLeft: 8 }}>
                            <Icon name="close" size={18} color={themeColors.text.secondary} />
                        </TouchableOpacity>
                    </View>
                )}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                }}>
                    <TouchableOpacity
                        onPress={handleAttachmentPress}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: themeColors.gray[100],
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginRight: 8,
                        }}
                    >
                        <Icon name="add" size={24} color={themeColors.text.secondary} />
                    </TouchableOpacity>

                    <View style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 20,
                        paddingHorizontal: 12,
                        paddingVertical: 0,
                        marginRight: 8,
                    }}>
                        <TextInput
                            ref={inputRef}
                            value={inputText}
                            onChangeText={setInputText}
                            onSubmitEditing={sendMessage}
                            onKeyPress={handleTyping}
                            placeholder="Type a message..."
                            placeholderTextColor={themeColors.text.secondary}
                            underlineColorAndroid="transparent"
                            style={{
                                flex: 1,
                                fontSize: 16,
                                color: themeColors.text.primary,
                                maxHeight: 80,
                                height: 40,
                                paddingVertical: 3,
                            }}
                            multiline
                            textAlignVertical="center"
                        />
                    </View>

                    <TouchableOpacity
                        onPress={sendMessage}
                        disabled={(!inputText.trim() && !pendingAttachment) || isUploading}
                        style={{
                            width: 35,
                            height: 35,
                            borderRadius: 20,
                            backgroundColor: (inputText.trim() || pendingAttachment) && !isUploading ? themeColors.primary : themeColors.gray[300],
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >

                        {
                            (inputText.length === 0 && !pendingAttachment) ? (
                                <View style={{ width: 35, height: 35, borderRadius: 20, backgroundColor: themeColors.gray[300], alignItems: 'center', justifyContent: 'center' }}>
                                    <TouchableOpacity onPress={handleEmojiPress}>
                                        <Text style={{ fontSize: 16, color: themeColors.text.secondary }}>👍</Text>
                                    </TouchableOpacity>

                                </View>
                            ) : (
                                <Icon
                                    name="send"
                                    style={{ marginRight: -2 }}
                                    size={20}
                                    color={(inputText.trim() || pendingAttachment) && !isUploading ? themeColors.text.inverse : themeColors.text.secondary}
                                />)
                        }

                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {/* Video and Audio Call Components */}
            {/* VideoCall and AudioCall components now rendered globally in App.tsx */}
        </SafeAreaView>
    );
};

export default SingleMessage;