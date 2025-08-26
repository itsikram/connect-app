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
    StatusBar,
    Alert,
    Modal,
    Pressable,
    Image,
    Dimensions,
    ScrollView,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../contexts/ThemeContext';
import UserPP from '../components/UserPP';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { useSocket } from '../contexts/SocketContext';
import moment from 'moment';
import { launchImageLibrary } from 'react-native-image-picker';
import api from '../lib/api';

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
    const { connect, isConnected, emit, on, off } = useSocket();
    const { colors: themeColors, isDarkMode } = useTheme();

    // Add state for context menu
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

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
                message: updatedMessage.message || 'No message',
                receiverId: updatedMessage.receiverId,
                senderId: updatedMessage.senderId,
                timestamp: new Date(updatedMessage.timestamp || Date.now()),
                isSeen: false,
                room,
                attachment: updatedMessage.attachment,
                parent: updatedMessage.parent || null,
            };

            if (messageData.chatPage === true) {
                setMessages(prev => [...prev, newMessage]);
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

    // Early return if required data is not available
    if (!friend?._id || !myProfile?._id) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.background.primary }}>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Loading...</Text>
                </View>
            </SafeAreaView>
        );
    }

    // Hide tab bar when focused
    useFocusEffect(
        React.useCallback(() => {
            // Hide the bottom tab bar when SingleMessage screen is focused
            const hideTabBar = () => {
                const parent = navigation.getParent();
                if (parent) {
                    parent.setOptions({
                        tabBarStyle: { 
                            height: 0,
                            overflow: 'hidden',
                            position: 'absolute',
                            bottom: 0,
                        },
                        tabBarShowLabel: false,
                    });
                }
            };

            // Small delay to ensure navigation transition is complete
            const timer = setTimeout(hideTabBar, 100);

            return () => {
                clearTimeout(timer);
                // Show the bottom tab bar when leaving SingleMessage screen
                const showTabBar = () => {
                    const parent = navigation.getParent();
                    if (parent) {
                        parent.setOptions({
                            tabBarStyle: {
                                backgroundColor: themeColors.surface.header,
                                borderTopColor: themeColors.border.primary,
                                height: 60,
                                paddingBottom: 8,
                                paddingTop: 8,
                                position: 'relative',
                            },
                            tabBarShowLabel: true,
                        });
                    }
                };
                
                // Small delay to ensure navigation transition is complete
                setTimeout(showTabBar, 100);
            };
        }, [navigation, themeColors.surface.header, themeColors.border.primary])
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
                timestamp: new Date().toISOString()
            });

            console.log('Message sent:', inputText.trim());
            setPendingAttachment(null);
            setPendingAttachmentLocal(null);
            setUploadProgress(null);
            setIsUploading(false);
            setReplyingTo(null);
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
        setContextMenuVisible(true);

        // Get position for context menu (you might need to adjust this based on your layout)
        const { pageY } = event.nativeEvent;
        setContextMenuPosition({ x: 20, y: pageY - 100 });
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

    const renderMessage = ({ item }: { item: Message }) => (
        <View key={item._id} style={{
            marginBottom: 8,
            alignItems: item.senderId === myProfile?._id ? 'flex-end' : 'flex-start',
        }}>
            <View style={{
                backgroundColor: item.senderId === myProfile?._id ? themeColors.primary : themeColors.gray[200],
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                maxWidth: '80%',
                borderBottomLeftRadius: item.senderId === myProfile._id ? 20 : 4,
                borderBottomRightRadius: item.senderId === myProfile._id ? 4 : 20,
                borderWidth: highlightedMessageId === item._id ? 2 : 0,
                borderColor: highlightedMessageId === item._id ? themeColors.primary : 'transparent',
            }}>
                {item.parent && (
                    <View style={{
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
                    </View>
                )}
                <Text style={{
                    color: item.senderId === myProfile?._id ? themeColors.text.inverse : themeColors.text.primary,
                    fontSize: 16,
                    lineHeight: 20,
                }}>
                    {item.message}
                </Text>
                {item.attachment && isValidImageUrl(item.attachment) && (
                    <Image
                        source={{ uri: item.attachment }}
                        style={{ width: 200, height: 200, borderRadius: 8, marginTop: 8 }}
                        resizeMode="cover"
                    />
                )}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    marginTop: 4,
                }}>
                    <Icon
                        name={item.isSeen ? 'done-all' : 'check'}
                        size={16}
                        color={item.isSeen ? themeColors.status.info : themeColors.text.inverse}
                        style={{ marginLeft: 4 }}
                    />
                    <Text style={{
                        color: themeColors.text.inverse,
                        fontSize: 12,
                        opacity: 0.7,
                        marginLeft: 4,
                    }}>
                        {moment(item.timestamp).format('HH:mm')}
                    </Text>
                </View>
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
                <UserPP image={friend?.profilePic} isActive={true} size={30} />

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
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor={themeColors.background.primary} />
            {/* Header */}
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

                        <UserPP image={friend?.profilePic} isActive={friend?.isActive} size={35} />


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
                                    </View>
                                ) : (
                                    <Text>Away</Text>
                                )}
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
                    <Icon name="notifications" size={20} color={themeColors.text.inverse} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => Alert.alert('Call', 'Call feature coming soon!')}
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
                    <Icon name="call" size={20} color={themeColors.text.inverse} />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => Alert.alert('Video Call', 'Video call feature coming soon!')}
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
                    <Icon name="videocam" size={20} color={themeColors.text.inverse} />
                </TouchableOpacity>
            </View>

            {/* Messages */}
            <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item._id}
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 16 }}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={renderTypingIndicator}
            />

            {/* Context Menu Modal */}
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
                            top: contextMenuPosition.y,
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
                            minWidth: 150,
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
                            onPress={copyMessage}
                        >
                            <Icon name="content-copy" size={20} color={themeColors.text.primary} />
                            <Text style={{ marginLeft: 12, fontSize: 16, color: themeColors.text.primary }}>
                                Copy
                            </Text>
                        </TouchableOpacity>

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

            {/* Image Modal */}
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
                    {/* Close button */}
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

                    {/* Image with zoom */}
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

                    {/* Control buttons */}
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

            {/* Input Area */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{
                    backgroundColor: themeColors.surface.header,
                    borderTopWidth: 1,
                    borderTopColor: themeColors.border.primary,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
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
                { (isUploading || pendingAttachmentLocal || pendingAttachment) && (
                    <View style={{
                        marginBottom: 8,
                        marginHorizontal: 0,
                        backgroundColor: themeColors.gray[100],
                        borderRadius: 12,
                        padding: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}>
                        { (pendingAttachmentLocal || pendingAttachment) && (
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
        </SafeAreaView>
    );
};

export default SingleMessage;